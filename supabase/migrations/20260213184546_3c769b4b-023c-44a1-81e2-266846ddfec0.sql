
-- =============================================
-- REFATORAÇÃO: user_financial_snapshot
-- Adicionar 8 colunas JSON especializadas para consumo otimizado por IA
-- =============================================

-- 1. Adicionar novas colunas
ALTER TABLE public.user_financial_snapshot
  ADD COLUMN IF NOT EXISTS overview jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_month jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS category_trends jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS patrimony jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recent_transactions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS insights jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_version integer DEFAULT 1;

-- 2. Reescrever rebuild_user_snapshot para popular todas as 8 colunas
CREATE OR REPLACE FUNCTION public.rebuild_user_snapshot(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_overview jsonb;
  v_current_month jsonb;
  v_monthly_history jsonb;
  v_categories jsonb;
  v_category_trends jsonb;
  v_patrimony jsonb;
  v_recent_tx jsonb;
  v_insights jsonb;
  v_legacy_summary jsonb;
  v_legacy_transactions jsonb;
  v_now_month text;
  v_total_income numeric;
  v_total_expense numeric;
  v_total_tx integer;
  v_first_date text;
  v_last_date text;
  v_months_tracked integer;
BEGIN
  -- Get canonical phone
  SELECT phone INTO v_phone FROM public.profiles WHERE id = p_user_id;
  IF v_phone IS NULL THEN RETURN; END IF;
  v_phone := public.normalize_brazilian_phone(v_phone);
  IF v_phone IS NULL THEN RETURN; END IF;

  v_now_month := to_char(now(), 'YYYY-MM');

  -- ============ OVERVIEW ============
  SELECT
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0),
    COUNT(*),
    MIN(t.date),
    MAX(t.date)
  INTO v_total_income, v_total_expense, v_total_tx, v_first_date, v_last_date
  FROM public.transactions t WHERE t.user_id = p_user_id;

  -- Count distinct months
  SELECT COUNT(DISTINCT to_char(t.date::date, 'YYYY-MM'))
  INTO v_months_tracked
  FROM public.transactions t WHERE t.user_id = p_user_id;

  v_overview := jsonb_build_object(
    'status', 'active',
    'balance', round(v_total_income - v_total_expense, 2),
    'total_income', round(v_total_income, 2),
    'total_expense', round(v_total_expense, 2),
    'total_transactions', v_total_tx,
    'first_date', v_first_date,
    'last_date', v_last_date,
    'months_tracked', v_months_tracked,
    'avg_monthly_income', CASE WHEN v_months_tracked > 0 THEN round(v_total_income / v_months_tracked, 2) ELSE 0 END,
    'avg_monthly_expense', CASE WHEN v_months_tracked > 0 THEN round(v_total_expense / v_months_tracked, 2) ELSE 0 END,
    'savings_rate', CASE WHEN v_total_income > 0 THEN round(((v_total_income - v_total_expense) / v_total_income) * 100, 2) ELSE 0 END
  );

  -- ============ CURRENT_MONTH ============
  SELECT jsonb_build_object(
    'month', v_now_month,
    'income', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0),
    'expense', COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0),
    'balance', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0),
    'tx_count', COUNT(*),
    'daily_avg_expense', CASE 
      WHEN EXTRACT(DAY FROM now()) > 0 
      THEN round(COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) / GREATEST(EXTRACT(DAY FROM now()), 1), 2)
      ELSE 0 
    END
  )
  INTO v_current_month
  FROM public.transactions t
  WHERE t.user_id = p_user_id AND to_char(t.date::date, 'YYYY-MM') = v_now_month;

  -- Add top expenses/incomes for current month
  v_current_month := v_current_month || jsonb_build_object(
    'top_expenses', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY row_data->>'total' DESC)
      FROM (
        SELECT jsonb_build_object('category', c.name, 'total', round(SUM(t.amount), 2), 'count', COUNT(*)) as row_data
        FROM public.transactions t
        JOIN public.categories c ON c.id = t.category_id
        WHERE t.user_id = p_user_id AND t.type = 'expense' AND to_char(t.date::date, 'YYYY-MM') = v_now_month
        GROUP BY c.name
        ORDER BY SUM(t.amount) DESC
        LIMIT 5
      ) sub
    ), '[]'::jsonb),
    'top_incomes', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY row_data->>'total' DESC)
      FROM (
        SELECT jsonb_build_object('category', c.name, 'total', round(SUM(t.amount), 2), 'count', COUNT(*)) as row_data
        FROM public.transactions t
        JOIN public.categories c ON c.id = t.category_id
        WHERE t.user_id = p_user_id AND t.type = 'income' AND to_char(t.date::date, 'YYYY-MM') = v_now_month
        GROUP BY c.name
        ORDER BY SUM(t.amount) DESC
        LIMIT 5
      ) sub
    ), '[]'::jsonb)
  );

  -- ============ MONTHLY_HISTORY (last 12 months, short keys) ============
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'm', sub.month,
    'i', sub.income,
    'e', sub.expense,
    'b', sub.balance
  ) ORDER BY sub.month DESC), '[]'::jsonb)
  INTO v_monthly_history
  FROM (
    SELECT
      to_char(t.date::date, 'YYYY-MM') as month,
      round(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 2) as income,
      round(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 2) as expense,
      round(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 2) as balance
    FROM public.transactions t
    WHERE t.user_id = p_user_id
    GROUP BY to_char(t.date::date, 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12
  ) sub;

  -- ============ CATEGORIES (with subcategories) ============
  v_categories := jsonb_build_object(
    'expense', COALESCE((
      SELECT jsonb_agg(cat_row ORDER BY (cat_row->>'total')::numeric DESC)
      FROM (
        SELECT jsonb_build_object(
          'cat', c.name,
          'total', round(SUM(t.amount), 2),
          'count', COUNT(*),
          'avg', round(AVG(t.amount), 2),
          'subs', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('name', sc.name, 'total', round(sub_sum.s, 2), 'count', sub_sum.c))
            FROM (
              SELECT t2.subcategory_id, SUM(t2.amount) as s, COUNT(*) as c
              FROM public.transactions t2
              WHERE t2.user_id = p_user_id AND t2.category_id = c.id AND t2.subcategory_id IS NOT NULL
              GROUP BY t2.subcategory_id
            ) sub_sum
            JOIN public.subcategories sc ON sc.id = sub_sum.subcategory_id
          ), '[]'::jsonb)
        ) as cat_row
        FROM public.transactions t
        JOIN public.categories c ON c.id = t.category_id
        WHERE t.user_id = p_user_id AND t.type = 'expense'
        GROUP BY c.id, c.name
      ) cats
    ), '[]'::jsonb),
    'income', COALESCE((
      SELECT jsonb_agg(cat_row ORDER BY (cat_row->>'total')::numeric DESC)
      FROM (
        SELECT jsonb_build_object(
          'cat', c.name,
          'total', round(SUM(t.amount), 2),
          'count', COUNT(*),
          'avg', round(AVG(t.amount), 2)
        ) as cat_row
        FROM public.transactions t
        JOIN public.categories c ON c.id = t.category_id
        WHERE t.user_id = p_user_id AND t.type = 'income'
        GROUP BY c.id, c.name
      ) cats
    ), '[]'::jsonb)
  );

  -- ============ CATEGORY_TRENDS (top 5 expense categories x 6 months) ============
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'cat', sub.cat_name,
    'trend', sub.trend_data
  )), '[]'::jsonb)
  INTO v_category_trends
  FROM (
    SELECT c.name as cat_name,
      (SELECT jsonb_agg(jsonb_build_object('m', m.month, 'v', m.val) ORDER BY m.month DESC)
       FROM (
         SELECT to_char(t2.date::date, 'YYYY-MM') as month, round(SUM(t2.amount), 2) as val
         FROM public.transactions t2
         WHERE t2.user_id = p_user_id AND t2.category_id = c.id
           AND t2.date::date >= (now() - interval '6 months')::date
         GROUP BY to_char(t2.date::date, 'YYYY-MM')
       ) m
      ) as trend_data
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = p_user_id AND t.type = 'expense'
    GROUP BY c.id, c.name
    ORDER BY SUM(t.amount) DESC
    LIMIT 5
  ) sub
  WHERE sub.trend_data IS NOT NULL;

  -- ============ PATRIMONY (from assets table) ============
  v_patrimony := jsonb_build_object(
    'total', COALESCE((
      SELECT round(SUM(a.value), 2)
      FROM public.assets a
      WHERE a.user_id = p_user_id
        AND a.date = (SELECT MAX(a2.date) FROM public.assets a2 WHERE a2.user_id = p_user_id)
    ), 0),
    'breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('category', a.category, 'value', round(a.value, 2)))
      FROM public.assets a
      WHERE a.user_id = p_user_id
        AND a.date = (SELECT MAX(a2.date) FROM public.assets a2 WHERE a2.user_id = p_user_id)
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('m', sub.month, 'total', sub.total) ORDER BY sub.month DESC)
      FROM (
        SELECT to_char(a.date::date, 'YYYY-MM') as month, round(SUM(a.value), 2) as total
        FROM public.assets a
        WHERE a.user_id = p_user_id
        GROUP BY to_char(a.date::date, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 6
      ) sub
    ), '[]'::jsonb)
  );

  -- Calculate patrimony growth
  DECLARE
    v_current_total numeric;
    v_prev_total numeric;
  BEGIN
    SELECT SUM(a.value) INTO v_current_total
    FROM public.assets a WHERE a.user_id = p_user_id
      AND a.date = (SELECT MAX(a2.date) FROM public.assets a2 WHERE a2.user_id = p_user_id);

    SELECT SUM(a.value) INTO v_prev_total
    FROM public.assets a WHERE a.user_id = p_user_id
      AND to_char(a.date::date, 'YYYY-MM') = to_char((now() - interval '3 months')::date, 'YYYY-MM');

    IF v_current_total IS NOT NULL AND v_prev_total IS NOT NULL AND v_prev_total > 0 THEN
      v_patrimony := v_patrimony || jsonb_build_object(
        'growth_pct_3m', round(((v_current_total - v_prev_total) / v_prev_total) * 100, 2)
      );
    ELSE
      v_patrimony := v_patrimony || jsonb_build_object('growth_pct_3m', 0);
    END IF;
  END;

  -- ============ RECENT_TRANSACTIONS (last 15, short keys) ============
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'd', t.date,
    't', t.type,
    'a', t.amount,
    'cat', c.name,
    'sub', sc.name,
    'p', p.name
  ) ORDER BY t.date DESC, t.created_at DESC), '[]'::jsonb)
  INTO v_recent_tx
  FROM (
    SELECT * FROM public.transactions
    WHERE user_id = p_user_id
    ORDER BY date DESC, created_at DESC
    LIMIT 15
  ) t
  LEFT JOIN public.categories c ON c.id = t.category_id
  LEFT JOIN public.subcategories sc ON sc.id = t.subcategory_id
  LEFT JOIN public.persons p ON p.id = t.person_id;

  -- ============ INSIGHTS (pre-calculated) ============
  DECLARE
    v_alerts jsonb := '[]'::jsonb;
    v_suggestions jsonb := '[]'::jsonb;
    v_health_score integer;
    v_spending_control integer;
    v_top_cat_name text;
    v_top_cat_total numeric;
    v_top_cat_pct numeric;
    v_neg_months integer;
    v_avg_exp numeric;
    v_curr_exp numeric;
  BEGIN
    -- Check consecutive negative balance months
    SELECT COUNT(*) INTO v_neg_months
    FROM (
      SELECT to_char(t.date::date, 'YYYY-MM') as month
      FROM public.transactions t
      WHERE t.user_id = p_user_id
      GROUP BY to_char(t.date::date, 'YYYY-MM')
      HAVING SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END) < 0
      ORDER BY month DESC
      LIMIT 3
    ) sub;

    IF v_neg_months >= 3 THEN
      v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
        'type', 'deficit', 'msg', v_neg_months || ' meses consecutivos com saldo negativo', 'severity', 'high'
      ));
    END IF;

    -- Top expense category percentage
    SELECT c.name, SUM(t.amount), 
           CASE WHEN v_total_expense > 0 THEN round((SUM(t.amount) / v_total_expense) * 100, 1) ELSE 0 END
    INTO v_top_cat_name, v_top_cat_total, v_top_cat_pct
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = p_user_id AND t.type = 'expense'
    GROUP BY c.name
    ORDER BY SUM(t.amount) DESC
    LIMIT 1;

    IF v_top_cat_pct > 30 THEN
      v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
        'type', 'concentration', 'msg', v_top_cat_name || ' representa ' || v_top_cat_pct || '% dos gastos totais', 'severity', 'medium'
      ));
    END IF;

    -- Current month vs average
    v_avg_exp := CASE WHEN v_months_tracked > 0 THEN v_total_expense / v_months_tracked ELSE 0 END;
    SELECT COALESCE(SUM(t.amount), 0) INTO v_curr_exp
    FROM public.transactions t
    WHERE t.user_id = p_user_id AND t.type = 'expense' AND to_char(t.date::date, 'YYYY-MM') = v_now_month;

    IF v_avg_exp > 0 AND v_curr_exp > v_avg_exp * 1.3 THEN
      v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
        'type', 'overspend', 'msg', 'Gastos do mês atual ' || round(((v_curr_exp - v_avg_exp) / v_avg_exp) * 100) || '% acima da média', 'severity', 'high'
      ));
    END IF;

    -- Suggestions
    IF v_top_cat_name IS NOT NULL THEN
      v_suggestions := v_suggestions || jsonb_build_array(v_top_cat_name || ' é o maior gasto — ' || v_top_cat_pct || '% do total');
    END IF;

    -- Financial health score (0-100)
    v_health_score := GREATEST(0, LEAST(100,
      50
      + (CASE WHEN v_total_income > v_total_expense THEN 20 ELSE -20 END)
      + (CASE WHEN v_neg_months = 0 THEN 15 ELSE -v_neg_months * 5 END)
      + (CASE WHEN v_top_cat_pct < 30 THEN 10 ELSE -5 END)
      + (CASE WHEN (v_patrimony->>'total')::numeric > 0 THEN 10 ELSE 0 END)
    ));

    v_spending_control := GREATEST(0, LEAST(100,
      CASE WHEN v_avg_exp > 0 THEN round((1 - LEAST(v_curr_exp / v_avg_exp, 2)) * 100)::integer ELSE 50 END
    ));

    v_insights := jsonb_build_object(
      'alerts', v_alerts,
      'suggestions', v_suggestions,
      'scores', jsonb_build_object(
        'financial_health', v_health_score,
        'spending_control', v_spending_control,
        'savings_rate', CASE WHEN v_total_income > 0 THEN round(((v_total_income - v_total_expense) / v_total_income) * 100, 1) ELSE 0 END
      )
    );
  END;

  -- ============ LEGACY COLUMNS (backward compat) ============
  v_legacy_summary := v_overview || jsonb_build_object(
    'phone', v_phone,
    'user_status', 'active',
    'current_month', v_current_month,
    'monthly', v_monthly_history,
    'categories', COALESCE(v_categories->'expense', '[]'::jsonb) || COALESCE(v_categories->'income', '[]'::jsonb),
    'top_expense_categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', e->>'cat', 'total', (e->>'total')::numeric))
      FROM jsonb_array_elements(v_categories->'expense') e
      LIMIT 3
    ), '[]'::jsonb),
    'top_income_categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', e->>'cat', 'total', (e->>'total')::numeric))
      FROM jsonb_array_elements(v_categories->'income') e
      LIMIT 3
    ), '[]'::jsonb)
  );

  v_legacy_transactions := v_recent_tx;

  -- ============ UPSERT ============
  INSERT INTO public.user_financial_snapshot (
    user_id, phone, updated_at, snapshot_version,
    overview, current_month, monthly_history, categories,
    category_trends, patrimony, recent_transactions, insights,
    summary, transactions
  ) VALUES (
    p_user_id, v_phone, now(), 2,
    v_overview, v_current_month, v_monthly_history, v_categories,
    v_category_trends, v_patrimony, v_recent_tx, v_insights,
    v_legacy_summary, v_legacy_transactions
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = EXCLUDED.phone,
    updated_at = now(),
    snapshot_version = 2,
    overview = EXCLUDED.overview,
    current_month = EXCLUDED.current_month,
    monthly_history = EXCLUDED.monthly_history,
    categories = EXCLUDED.categories,
    category_trends = EXCLUDED.category_trends,
    patrimony = EXCLUDED.patrimony,
    recent_transactions = EXCLUDED.recent_transactions,
    insights = EXCLUDED.insights,
    summary = EXCLUDED.summary,
    transactions = EXCLUDED.transactions;
END;
$$;
