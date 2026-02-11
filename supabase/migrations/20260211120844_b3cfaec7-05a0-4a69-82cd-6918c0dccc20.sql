
-- Drop old views
DROP VIEW IF EXISTS public.vw_financial_data_by_phone;
DROP VIEW IF EXISTS public.vw_financial_summary_by_phone;

-- Create consolidated snapshot table
CREATE TABLE public.user_financial_snapshot (
  phone TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_financial_snapshot ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) should read/write this table
CREATE POLICY "Service role full access" ON public.user_financial_snapshot
  FOR ALL USING (true) WITH CHECK (true);

-- Function to rebuild a user's snapshot
CREATE OR REPLACE FUNCTION public.rebuild_financial_snapshot(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone TEXT;
  v_data JSONB;
BEGIN
  -- Get validated phone
  SELECT phone INTO v_phone FROM profiles WHERE id = p_user_id AND phone IS NOT NULL;
  IF v_phone IS NULL THEN
    -- No validated phone, remove any existing snapshot for this user
    DELETE FROM user_financial_snapshot WHERE user_id = p_user_id;
    RETURN;
  END IF;

  -- Build consolidated JSON
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'phone', v_phone,
    'generated_at', now(),
    'summary', (
      SELECT jsonb_build_object(
        'total_transactions', COUNT(*),
        'total_income', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0),
        'total_expense', COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0),
        'balance', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0),
        'first_transaction_date', MIN(t.date),
        'last_transaction_date', MAX(t.date)
      ) FROM transactions t WHERE t.user_id = p_user_id
    ),
    'monthly', (
      SELECT COALESCE(jsonb_agg(m ORDER BY m->>'month' DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'month', to_char(t.date::date, 'YYYY-MM'),
          'income', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0),
          'expense', COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0),
          'balance', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0),
          'count', COUNT(*)
        ) AS m
        FROM transactions t WHERE t.user_id = p_user_id
        GROUP BY to_char(t.date::date, 'YYYY-MM')
      ) sub
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(c ORDER BY (c->>'total')::numeric DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'name', UPPER(cat.name),
          'type', t.type,
          'total', SUM(t.amount),
          'count', COUNT(*),
          'subcategories', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'name', INITCAP(sub.name),
              'total', sub_agg.total,
              'count', sub_agg.cnt
            ) ORDER BY sub_agg.total DESC)
            FROM (
              SELECT sc.name, SUM(t2.amount) AS total, COUNT(*) AS cnt
              FROM transactions t2
              JOIN subcategories sc ON sc.id = t2.subcategory_id
              WHERE t2.user_id = p_user_id AND t2.category_id = cat.id
              GROUP BY sc.name
            ) sub_agg
            JOIN subcategories sub ON sub.name = sub_agg.name AND sub.category_id = cat.id
          ), '[]'::jsonb)
        ) AS c
        FROM transactions t
        JOIN categories cat ON cat.id = t.category_id
        WHERE t.user_id = p_user_id
        GROUP BY cat.id, cat.name, t.type
      ) sub
    ),
    'persons', (
      SELECT COALESCE(jsonb_agg(p ORDER BY (p->>'total')::numeric DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'name', per.name,
          'total', SUM(t.amount),
          'count', COUNT(*),
          'income', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0),
          'expense', COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0)
        ) AS p
        FROM transactions t
        JOIN persons per ON per.id = t.person_id
        WHERE t.user_id = p_user_id
        GROUP BY per.name
      ) sub
    ),
    'transactions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'date', t.date,
        'type', t.type,
        'amount', t.amount,
        'category', UPPER(cat.name),
        'subcategory', INITCAP(COALESCE(sc.name, '')),
        'person', per.name,
        'notes', t.notes
      ) ORDER BY t.date DESC), '[]'::jsonb)
      FROM transactions t
      JOIN categories cat ON cat.id = t.category_id
      JOIN persons per ON per.id = t.person_id
      LEFT JOIN subcategories sc ON sc.id = t.subcategory_id
      WHERE t.user_id = p_user_id
    )
  ) INTO v_data;

  -- Upsert snapshot (phone is PK, handles ownership transfer)
  INSERT INTO user_financial_snapshot (phone, user_id, data, updated_at)
  VALUES (v_phone, p_user_id, v_data, now())
  ON CONFLICT (phone) DO UPDATE SET
    user_id = p_user_id,
    data = v_data,
    updated_at = now();
END;
$$;

-- Trigger function on transactions
CREATE OR REPLACE FUNCTION public.trigger_rebuild_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM rebuild_financial_snapshot(OLD.user_id);
  ELSE
    PERFORM rebuild_financial_snapshot(NEW.user_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_rebuild_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trigger_rebuild_snapshot();
