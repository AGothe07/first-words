
-- Create a PL/pgSQL function to normalize Brazilian phones to canonical format: 55 + DDD + 9 + number(8)
CREATE OR REPLACE FUNCTION public.normalize_brazilian_phone(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
  local_part text;
BEGIN
  -- Strip non-digits
  digits := regexp_replace(input, '\D', '', 'g');
  
  -- Extract local part (without country code)
  IF digits LIKE '55%' AND length(digits) >= 12 THEN
    local_part := substring(digits FROM 3);
  ELSIF length(digits) <= 11 THEN
    local_part := digits;
  ELSE
    RETURN NULL;
  END IF;
  
  -- DDD(2) + 9 + number(8) = 11 digits
  IF length(local_part) = 11 AND substring(local_part FROM 3 FOR 1) = '9' THEN
    RETURN '55' || local_part;
  END IF;
  
  -- DDD(2) + number(8) = 10 digits → insert 9
  IF length(local_part) = 10 THEN
    RETURN '55' || substring(local_part FROM 1 FOR 2) || '9' || substring(local_part FROM 3);
  END IF;
  
  -- 11 digits but third digit isn't 9 — keep as-is
  IF length(local_part) = 11 THEN
    RETURN '55' || local_part;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Retroactively normalize all existing phones in profiles
UPDATE public.profiles
SET phone = public.normalize_brazilian_phone(phone)
WHERE phone IS NOT NULL
  AND public.normalize_brazilian_phone(phone) IS NOT NULL
  AND phone != public.normalize_brazilian_phone(phone);

-- Retroactively normalize all existing phones in user_financial_snapshot
UPDATE public.user_financial_snapshot
SET phone = public.normalize_brazilian_phone(phone)
WHERE public.normalize_brazilian_phone(phone) IS NOT NULL
  AND phone != public.normalize_brazilian_phone(phone);

-- Update rebuild_user_snapshot to normalize phone before saving
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
  
  -- Ensure canonical format
  v_phone := public.normalize_brazilian_phone(v_phone);
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
