
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
  v_ingest_schema jsonb;
  v_now_month text;
  v_total_income numeric;
  v_total_expense numeric;
  v_total_tx integer;
  v_first_date text;
  v_last_date text;
  v_months_tracked integer;
BEGIN
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

  -- ============ MONTHLY_HISTORY (last 12 months) ============
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

  -- ============ CATEGORIES (fixed nested aggregation) ============
  SELECT jsonb_build_object(
    'expense', COALESCE((
      SELECT jsonb_agg(cat_row)
      FROM (
        SELECT jsonb_build_object(
          'cat', agg.cat_name, 'total', agg.total, 'count', agg.cnt, 'avg', agg.avg_val,
          'subs', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('name', sc.name, 'total', round(ss.total, 2), 'count', ss.cnt))
            FROM (
              SELECT t2.subcategory_id, SUM(t2.amount) as total, COUNT(*) as cnt
              FROM public.transactions t2
              WHERE t2.user_id = p_user_id AND t2.category_id = agg.cat_id AND t2.type = 'expense' AND t2.subcategory_id IS NOT NULL
              GROUP BY t2.subcategory_id
            ) ss
            JOIN public.subcategories sc ON sc.id = ss.subcategory_id
          ), '[]'::jsonb)
        ) as cat_row
        FROM (
          SELECT c.id as cat_id, c.name as cat_name, round(SUM(t.amount), 2) as total, COUNT(*) as cnt, round(AVG(t.amount), 2) as avg_val
          FROM public.transactions t
          JOIN public.categories c ON c.id = t.category_id
          WHERE t.user_id = p_user_id AND t.type = 'expense'
          GROUP BY c.id, c.name
          ORDER BY SUM(t.amount) DESC
        ) agg
      ) wrapped
    ), '[]'::jsonb),
    'income', COALESCE((
      SELECT jsonb_agg(cat_row)
      FROM (
        SELECT jsonb_build_object(
          'cat', agg.cat_name, 'total', agg.total, 'count', agg.cnt, 'avg', agg.avg_val,
          'subs', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('name', sc.name, 'total', round(ss.total, 2), 'count', ss.cnt))
            FROM (
              SELECT t2.subcategory_id, SUM(t2.amount) as total, COUNT(*) as cnt
              FROM public.transactions t2
              WHERE t2.user_id = p_user_id AND t2.category_id = agg.cat_id AND t2.type = 'income' AND t2.subcategory_id IS NOT NULL
              GROUP BY t2.subcategory_id
            ) ss
            JOIN public.subcategories sc ON sc.id = ss.subcategory_id
          ), '[]'::jsonb)
        ) as cat_row
        FROM (
          SELECT c.id as cat_id, c.name as cat_name, round(SUM(t.amount), 2) as total, COUNT(*) as cnt, round(AVG(t.amount), 2) as avg_val
          FROM public.transactions t
          JOIN public.categories c ON c.id = t.category_id
          WHERE t.user_id = p_user_id AND t.type = 'income'
          GROUP BY c.id, c.name
          ORDER BY SUM(t.amount) DESC
        ) agg
      ) wrapped
    ), '[]'::jsonb)
  )
  INTO v_categories;

  -- ============ CATEGORY_TRENDS (last 6 months) ============
  SELECT COALESCE(jsonb_object_agg(sub2.cat_name, sub2.monthly_data), '{}'::jsonb)
  INTO v_category_trends
  FROM (
    SELECT sub.cat_name, jsonb_agg(jsonb_build_object('m', sub.month, 'v', sub.total) ORDER BY sub.month DESC) as monthly_data
    FROM (
      SELECT c.name as cat_name, to_char(t.date::date, 'YYYY-MM') as month, round(SUM(t.amount), 2) as total
      FROM public.transactions t
      JOIN public.categories c ON c.id = t.category_id
      WHERE t.user_id = p_user_id AND t.date::date >= (now() - interval '6 months')::date
      GROUP BY c.name, to_char(t.date::date, 'YYYY-MM')
    ) sub
    GROUP BY sub.cat_name
  ) sub2;

  -- ============ PATRIMONY ============
  SELECT jsonb_build_object(
    'total', COALESCE(SUM(a.value), 0),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cat', sub.category, 'value', sub.total, 'pct', sub.pct))
      FROM (
        SELECT a2.category, round(SUM(a2.value), 2) as total,
          round(SUM(a2.value) / NULLIF(SUM(SUM(a2.value)) OVER(), 0) * 100, 1) as pct
        FROM public.assets a2
        WHERE a2.user_id = p_user_id
        GROUP BY a2.category
        ORDER BY SUM(a2.value) DESC
      ) sub
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('m', sub.month, 'v', sub.total) ORDER BY sub.month DESC)
      FROM (
        SELECT to_char(a3.date::date, 'YYYY-MM') as month, round(SUM(a3.value), 2) as total
        FROM public.assets a3
        WHERE a3.user_id = p_user_id
        GROUP BY to_char(a3.date::date, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      ) sub
    ), '[]'::jsonb)
  )
  INTO v_patrimony
  FROM public.assets a
  WHERE a.user_id = p_user_id;

  -- ============ RECENT_TRANSACTIONS (last 20) ============
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'type', t.type, 'date', t.date, 'amount', t.amount,
    'cat', c.name, 'sub', sc.name, 'person', p.name, 'notes', t.notes
  ) ORDER BY t.date DESC, t.created_at DESC), '[]'::jsonb)
  INTO v_recent_tx
  FROM (
    SELECT * FROM public.transactions WHERE user_id = p_user_id ORDER BY date DESC, created_at DESC LIMIT 20
  ) t
  JOIN public.categories c ON c.id = t.category_id
  JOIN public.persons p ON p.id = t.person_id
  LEFT JOIN public.subcategories sc ON sc.id = t.subcategory_id;

  -- ============ INSIGHTS ============
  DECLARE
    v_alerts jsonb := '[]'::jsonb;
    v_suggestions jsonb := '[]'::jsonb;
    v_neg_months integer;
    v_top_cat_name text;
    v_top_cat_pct numeric;
    v_avg_exp numeric;
    v_curr_exp numeric;
    v_health_score integer;
    v_spending_control integer;
  BEGIN
    SELECT COUNT(*) INTO v_neg_months
    FROM (
      SELECT to_char(t.date::date, 'YYYY-MM') as month
      FROM public.transactions t WHERE t.user_id = p_user_id
      GROUP BY to_char(t.date::date, 'YYYY-MM')
      HAVING SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END) < 0
    ) sub;

    IF v_neg_months > 0 THEN
      v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
        'type', 'deficit', 'msg', v_neg_months || ' mês(es) com saldo negativo', 'severity', 'high'
      ));
    END IF;

    SELECT c.name, round(SUM(t.amount) / NULLIF(v_total_expense, 0) * 100, 1)
    INTO v_top_cat_name, v_top_cat_pct
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = p_user_id AND t.type = 'expense'
    GROUP BY c.name
    ORDER BY SUM(t.amount) DESC
    LIMIT 1;

    IF v_top_cat_pct > 40 THEN
      v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
        'type', 'concentration', 'msg', v_top_cat_name || ' representa ' || v_top_cat_pct || '% das despesas', 'severity', 'medium'
      ));
    END IF;

    IF v_months_tracked > 0 THEN
      v_avg_exp := v_total_expense / v_months_tracked;
    ELSE
      v_avg_exp := 0;
    END IF;

    SELECT COALESCE(SUM(t.amount), 0) INTO v_curr_exp
    FROM public.transactions t
    WHERE t.user_id = p_user_id AND t.type = 'expense' AND to_char(t.date::date, 'YYYY-MM') = v_now_month;

    IF v_avg_exp > 0 AND v_curr_exp > v_avg_exp * 1.2 THEN
      v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
        'type', 'overspending', 'msg', 'Gastos do mês atual ' || round((v_curr_exp / v_avg_exp - 1) * 100) || '% acima da média', 'severity', 'high'
      ));
    END IF;

    IF v_total_income > 0 THEN
      v_health_score := LEAST(100, GREATEST(0,
        CASE WHEN (v_total_income - v_total_expense) / v_total_income > 0.2 THEN 40 ELSE round((v_total_income - v_total_expense) / v_total_income * 200)::integer END
        + CASE WHEN v_neg_months = 0 THEN 30 WHEN v_neg_months <= 2 THEN 15 ELSE 0 END
        + CASE WHEN v_top_cat_pct IS NULL OR v_top_cat_pct <= 40 THEN 30 WHEN v_top_cat_pct <= 60 THEN 15 ELSE 0 END
      ));
    ELSE
      v_health_score := 0;
    END IF;

    IF v_avg_exp > 0 THEN
      v_spending_control := LEAST(100, GREATEST(0, round((1 - (v_curr_exp - v_avg_exp) / v_avg_exp) * 100)::integer));
    ELSE
      v_spending_control := 100;
    END IF;

    v_insights := jsonb_build_object(
      'health_score', v_health_score,
      'spending_control', v_spending_control,
      'alerts', v_alerts,
      'suggestions', v_suggestions
    );
  END;

  -- ============ INGEST_SCHEMA ============
  SELECT jsonb_build_object(
    'endpoint', '/ingest-transaction',
    'method', 'POST',
    'auth', 'Bearer EXTERNAL_API_ADMIN_TOKEN',
    'rules', jsonb_build_object(
      'required', jsonb_build_array('phone_number', 'type', 'amount', 'date', 'person', 'category'),
      'optional', jsonb_build_array('subcategory', 'notes'),
      'type_values', jsonb_build_array('expense', 'income'),
      'date_format', 'YYYY-MM-DD',
      'amount', 'positive number, no currency symbol'
    ),
    'persons', COALESCE((
      SELECT jsonb_agg(p.name ORDER BY p.name)
      FROM public.persons p WHERE p.user_id = p_user_id AND p.is_active = true
    ), '[]'::jsonb),
    'categories_expense', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', c.name,
        'subcategories', COALESCE((
          SELECT jsonb_agg(sc.name ORDER BY sc.name)
          FROM public.subcategories sc WHERE sc.category_id = c.id AND sc.is_active = true
        ), '[]'::jsonb)
      ) ORDER BY c.name)
      FROM public.categories c WHERE c.user_id = p_user_id AND c.type = 'expense' AND c.is_active = true
    ), '[]'::jsonb),
    'categories_income', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', c.name,
        'subcategories', COALESCE((
          SELECT jsonb_agg(sc.name ORDER BY sc.name)
          FROM public.subcategories sc WHERE sc.category_id = c.id AND sc.is_active = true
        ), '[]'::jsonb)
      ) ORDER BY c.name)
      FROM public.categories c WHERE c.user_id = p_user_id AND c.type = 'income' AND c.is_active = true
    ), '[]'::jsonb)
  )
  INTO v_ingest_schema;

  -- ============ LEGACY COLUMNS ============
  v_legacy_summary := jsonb_build_object(
    'overview', v_overview,
    'current_month', v_current_month,
    'categories', v_categories,
    'patrimony', v_patrimony,
    'insights', v_insights
  );

  v_legacy_transactions := (v_recent_tx);

  -- ============ UPSERT ============
  INSERT INTO public.user_financial_snapshot (
    user_id, phone, overview, current_month, monthly_history,
    categories, category_trends, patrimony, recent_transactions,
    insights, ingest_schema, summary, transactions, snapshot_version, updated_at
  ) VALUES (
    p_user_id, v_phone, v_overview, v_current_month, v_monthly_history,
    v_categories, v_category_trends, v_patrimony, v_recent_tx,
    v_insights, v_ingest_schema, v_legacy_summary, v_legacy_transactions, 2, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = EXCLUDED.phone,
    overview = EXCLUDED.overview,
    current_month = EXCLUDED.current_month,
    monthly_history = EXCLUDED.monthly_history,
    categories = EXCLUDED.categories,
    category_trends = EXCLUDED.category_trends,
    patrimony = EXCLUDED.patrimony,
    recent_transactions = EXCLUDED.recent_transactions,
    insights = EXCLUDED.insights,
    ingest_schema = EXCLUDED.ingest_schema,
    summary = EXCLUDED.summary,
    transactions = EXCLUDED.transactions,
    snapshot_version = 2,
    updated_at = now();
END;
$$;
