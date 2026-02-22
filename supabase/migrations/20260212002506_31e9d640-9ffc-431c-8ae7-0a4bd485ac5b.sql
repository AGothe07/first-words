
-- Fix search_path for has_role
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Fix search_path for rebuild_user_snapshot
CREATE OR REPLACE FUNCTION public.rebuild_user_snapshot(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_summary jsonb;
  v_transactions jsonb;
BEGIN
  SELECT phone INTO v_phone FROM public.profiles WHERE id = p_user_id;
  IF v_phone IS NULL THEN RETURN; END IF;

  SELECT jsonb_build_object(
    'phone', v_phone,
    'balance', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0),
    'total_income', COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0),
    'total_expense', COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0),
    'total_transactions', COUNT(*)
  ) INTO v_summary
  FROM public.transactions t
  WHERE t.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'type', t.type, 'date', t.date,
    'amount', t.amount, 'notes', t.notes
  ) ORDER BY t.date DESC), '[]'::jsonb)
  INTO v_transactions
  FROM public.transactions t
  WHERE t.user_id = p_user_id;

  INSERT INTO public.user_financial_snapshot (user_id, phone, summary, transactions, updated_at)
  VALUES (p_user_id, v_phone, v_summary, v_transactions, now())
  ON CONFLICT (user_id) DO UPDATE SET
    phone = EXCLUDED.phone,
    summary = EXCLUDED.summary,
    transactions = EXCLUDED.transactions,
    updated_at = now();
END;
$$;

-- Fix search_path for rebuild_financial_snapshot
CREATE OR REPLACE FUNCTION public.rebuild_financial_snapshot(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rebuild_user_snapshot(p_user_id);
END;
$$;
