
CREATE OR REPLACE FUNCTION public.rebuild_user_snapshot(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_phone text;
  v_schema text := '';
  v_rec record;
  v_sub record;
  v_dim record;
  v_has_any boolean := false;
  v_overview jsonb;
  v_current_month jsonb;
  v_monthly_history jsonb;
  v_categories jsonb;
  v_category_trends jsonb;
  v_patrimony jsonb;
  v_recent_transactions jsonb;
  v_insights jsonb;
  v_total_income numeric;
  v_total_expense numeric;
  v_balance numeric;
  v_month_income numeric;
  v_month_expense numeric;
  v_now timestamp with time zone := now();
  v_current_month_start date;
  v_current_month_end date;
BEGIN
  SELECT phone INTO v_phone FROM profiles WHERE id = p_user_id;
  IF v_phone IS NULL THEN RETURN; END IF;

  v_current_month_start := date_trunc('month', v_now)::date;
  v_current_month_end := (date_trunc('month', v_now) + interval '1 month' - interval '1 day')::date;

  -- ══════════════════════════════════════════════
  -- BUILD INGEST SCHEMA (semantic, no IDs)
  -- ══════════════════════════════════════════════

  v_schema := '=== SCHEMA DE INGESTÃO — LINGUAGEM NATURAL ===' || E'\n';
  v_schema := v_schema || 'Última atualização: ' || to_char(v_now, 'YYYY-MM-DD HH24:MI:SS') || E'\n\n';

  v_schema := v_schema || '--- INSTRUÇÕES PARA A IA ---' || E'\n\n';
  v_schema := v_schema || 'Este schema descreve as dimensões disponíveis do usuário para classificação de transações financeiras.' || E'\n';
  v_schema := v_schema || 'A IA deve interpretar mensagens em linguagem natural e mapear para os campos abaixo.' || E'\n';
  v_schema := v_schema || 'Nenhum ID técnico é necessário na entrada — a resolução de IDs é feita internamente pelo sistema.' || E'\n';
  v_schema := v_schema || 'A IA deve enviar apenas NOMES (person, category, subcategory, etc.) e o sistema resolverá os IDs automaticamente.' || E'\n\n';

  v_schema := v_schema || '--- CAMPOS PARA ENVIO À API ---' || E'\n\n';
  v_schema := v_schema || 'type (obrigatório): "expense" ou "income". Identificar pelo contexto da mensagem (gastei/paguei/comprei = expense; recebi/ganhei/entrou = income).' || E'\n\n';
  v_schema := v_schema || 'date (opcional): Data no formato YYYY-MM-DD. Interpretar expressões como "hoje", "ontem", "segunda passada". Se não mencionado, usar data atual.' || E'\n\n';
  v_schema := v_schema || 'amount (obrigatório): Valor numérico positivo. Interpretar "20 reais", "R$150,50", "mil e quinhentos" etc.' || E'\n\n';
  v_schema := v_schema || 'person (obrigatório): Nome da pessoa associada. Deve corresponder a uma das pessoas listadas abaixo (busca case-insensitive).' || E'\n\n';
  v_schema := v_schema || 'category (obrigatório): Nome da categoria. Deve corresponder a uma categoria do mesmo tipo (expense/income) listada abaixo (busca case-insensitive).' || E'\n\n';
  v_schema := v_schema || 'subcategory (opcional): Nome da subcategoria dentro da categoria escolhida (busca case-insensitive).' || E'\n\n';
  v_schema := v_schema || 'notes (opcional): Texto livre, máximo 500 caracteres. Pode conter contexto adicional da mensagem original.' || E'\n\n';
  v_schema := v_schema || 'phone_number (obrigatório via API externa): Número de telefone brasileiro do usuário.' || E'\n\n';

  -- Pessoas
  v_schema := v_schema || '--- PESSOAS CADASTRADAS ---' || E'\n\n';
  v_has_any := false;
  FOR v_rec IN SELECT name FROM persons WHERE user_id = p_user_id AND is_active = true ORDER BY name LOOP
    v_schema := v_schema || '• ' || v_rec.name || E'\n';
    v_has_any := true;
  END LOOP;
  IF NOT v_has_any THEN
    v_schema := v_schema || 'Nenhuma pessoa cadastrada.' || E'\n';
  END IF;
  v_schema := v_schema || E'\n';

  -- Categorias de despesa
  v_schema := v_schema || '--- CATEGORIAS DE DESPESA ---' || E'\n\n';
  v_has_any := false;
  FOR v_rec IN SELECT id, name FROM categories WHERE user_id = p_user_id AND type = 'expense' AND is_active = true ORDER BY name LOOP
    v_schema := v_schema || '• ' || v_rec.name || E'\n';
    v_has_any := true;
    FOR v_sub IN SELECT name FROM subcategories WHERE category_id = v_rec.id AND user_id = p_user_id AND is_active = true ORDER BY name LOOP
      v_schema := v_schema || '  └ ' || v_sub.name || E'\n';
    END LOOP;
  END LOOP;
  IF NOT v_has_any THEN
    v_schema := v_schema || 'Nenhuma categoria de despesa cadastrada.' || E'\n';
  END IF;
  v_schema := v_schema || E'\n';

  -- Categorias de receita
  v_schema := v_schema || '--- CATEGORIAS DE RECEITA ---' || E'\n\n';
  v_has_any := false;
  FOR v_rec IN SELECT id, name FROM categories WHERE user_id = p_user_id AND type = 'income' AND is_active = true ORDER BY name LOOP
    v_schema := v_schema || '• ' || v_rec.name || E'\n';
    v_has_any := true;
    FOR v_sub IN SELECT name FROM subcategories WHERE category_id = v_rec.id AND user_id = p_user_id AND is_active = true ORDER BY name LOOP
      v_schema := v_schema || '  └ ' || v_sub.name || E'\n';
    END LOOP;
  END LOOP;
  IF NOT v_has_any THEN
    v_schema := v_schema || 'Nenhuma categoria de receita cadastrada.' || E'\n';
  END IF;
  v_schema := v_schema || E'\n';

  -- Dimensões adicionais
  v_schema := v_schema || '--- DIMENSÕES ADICIONAIS ---' || E'\n\n';

  FOR v_dim IN SELECT is_active, is_required FROM dimension_settings WHERE user_id = p_user_id AND dimension_key = 'payment_method' LIMIT 1 LOOP
    IF v_dim.is_active THEN
      v_schema := v_schema || '>> Formas de Pagamento';
      IF v_dim.is_required THEN v_schema := v_schema || ' (obrigatório)'; ELSE v_schema := v_schema || ' (opcional)'; END IF;
      v_schema := v_schema || ':' || E'\n';
      v_has_any := false;
      FOR v_rec IN SELECT name FROM payment_methods WHERE user_id = p_user_id AND is_active = true ORDER BY name LOOP
        v_schema := v_schema || '• ' || v_rec.name || E'\n';
        v_has_any := true;
      END LOOP;
      IF NOT v_has_any THEN v_schema := v_schema || 'Nenhuma forma de pagamento cadastrada.' || E'\n'; END IF;
      v_schema := v_schema || E'\n';
    END IF;
  END LOOP;

  FOR v_dim IN SELECT is_active, is_required FROM dimension_settings WHERE user_id = p_user_id AND dimension_key = 'account' LIMIT 1 LOOP
    IF v_dim.is_active THEN
      v_schema := v_schema || '>> Contas / Cartões';
      IF v_dim.is_required THEN v_schema := v_schema || ' (obrigatório)'; ELSE v_schema := v_schema || ' (opcional)'; END IF;
      v_schema := v_schema || ':' || E'\n';
      v_has_any := false;
      FOR v_rec IN SELECT name, account_type FROM accounts WHERE user_id = p_user_id AND is_active = true ORDER BY name LOOP
        v_schema := v_schema || '• ' || v_rec.name || ' [' || COALESCE(v_rec.account_type, 'outro') || ']' || E'\n';
        v_has_any := true;
      END LOOP;
      IF NOT v_has_any THEN v_schema := v_schema || 'Nenhuma conta cadastrada.' || E'\n'; END IF;
      v_schema := v_schema || E'\n';
    END IF;
  END LOOP;

  FOR v_dim IN SELECT is_active, is_required FROM dimension_settings WHERE user_id = p_user_id AND dimension_key = 'project' LIMIT 1 LOOP
    IF v_dim.is_active THEN
      v_schema := v_schema || '>> Projetos / Centros de Custo';
      IF v_dim.is_required THEN v_schema := v_schema || ' (obrigatório)'; ELSE v_schema := v_schema || ' (opcional)'; END IF;
      v_schema := v_schema || ':' || E'\n';
      v_has_any := false;
      FOR v_rec IN SELECT name FROM projects WHERE user_id = p_user_id AND is_active = true ORDER BY name LOOP
        v_schema := v_schema || '• ' || v_rec.name || E'\n';
        v_has_any := true;
      END LOOP;
      IF NOT v_has_any THEN v_schema := v_schema || 'Nenhum projeto cadastrado.' || E'\n'; END IF;
      v_schema := v_schema || E'\n';
    END IF;
  END LOOP;

  FOR v_dim IN SELECT is_active, is_required FROM dimension_settings WHERE user_id = p_user_id AND dimension_key = 'tags' LIMIT 1 LOOP
    IF v_dim.is_active THEN
      v_schema := v_schema || '>> Tags';
      IF v_dim.is_required THEN v_schema := v_schema || ' (obrigatório)'; ELSE v_schema := v_schema || ' (opcional)'; END IF;
      v_schema := v_schema || ':' || E'\n';
      v_has_any := false;
      FOR v_rec IN SELECT name FROM tags WHERE user_id = p_user_id ORDER BY name LOOP
        v_schema := v_schema || '• ' || v_rec.name || E'\n';
        v_has_any := true;
      END LOOP;
      IF NOT v_has_any THEN v_schema := v_schema || 'Nenhuma tag cadastrada.' || E'\n'; END IF;
      v_schema := v_schema || E'\n';
    END IF;
  END LOOP;

  -- Asset categories
  v_schema := v_schema || '--- CATEGORIAS DE PATRIMÔNIO ---' || E'\n\n';
  v_has_any := false;
  FOR v_rec IN SELECT DISTINCT category FROM assets WHERE user_id = p_user_id ORDER BY category LOOP
    v_schema := v_schema || '• ' || v_rec.category || E'\n';
    v_has_any := true;
  END LOOP;
  IF NOT v_has_any THEN
    v_schema := v_schema || 'Nenhum tipo de ativo cadastrado.' || E'\n';
  END IF;
  v_schema := v_schema || E'\n';

  v_schema := v_schema || '--- OBSERVAÇÕES ---' || E'\n\n';
  v_schema := v_schema || 'A IA deve usar APENAS os nomes listados acima ao enviar dados para a API.' || E'\n';
  v_schema := v_schema || 'A resolução de nomes para IDs internos é feita automaticamente pelo endpoint de ingestão.' || E'\n';
  v_schema := v_schema || 'Se um nome não corresponder a nenhum item cadastrado, a API retornará erro de validação.' || E'\n';
  v_schema := v_schema || 'Este schema é regenerado automaticamente quando há alterações nos cadastros do usuário.' || E'\n';

  -- ══════════════════════════════════════════════
  -- BUILD OTHER SNAPSHOT FIELDS
  -- ══════════════════════════════════════════════

  SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
  INTO v_total_income, v_total_expense
  FROM transactions WHERE user_id = p_user_id;
  v_balance := v_total_income - v_total_expense;

  v_overview := jsonb_build_object(
    'total_income', v_total_income,
    'total_expense', v_total_expense,
    'balance', v_balance,
    'transaction_count', (SELECT count(*) FROM transactions WHERE user_id = p_user_id)
  );

  SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
  INTO v_month_income, v_month_expense
  FROM transactions WHERE user_id = p_user_id AND date >= v_current_month_start AND date <= v_current_month_end;

  v_current_month := jsonb_build_object(
    'income', v_month_income,
    'expense', v_month_expense,
    'balance', v_month_income - v_month_expense,
    'period', to_char(v_now, 'YYYY-MM')
  );

  SELECT COALESCE(jsonb_agg(row_to_json(m)::jsonb ORDER BY m.month), '[]'::jsonb)
  INTO v_monthly_history
  FROM (
    SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month,
           SUM(amount) FILTER (WHERE type = 'income') as income,
           SUM(amount) FILTER (WHERE type = 'expense') as expense
    FROM transactions WHERE user_id = p_user_id
    GROUP BY date_trunc('month', date)
  ) m;

  SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT cat.name, cat.type, COALESCE(SUM(t.amount), 0) as total
    FROM categories cat
    LEFT JOIN transactions t ON t.category_id = cat.id AND t.user_id = p_user_id
    WHERE cat.user_id = p_user_id AND cat.is_active = true
    GROUP BY cat.name, cat.type
    ORDER BY total DESC
  ) c;

  SELECT COALESCE(jsonb_agg(row_to_json(ct)::jsonb), '[]'::jsonb)
  INTO v_category_trends
  FROM (
    SELECT cat.name as category, to_char(date_trunc('month', t.date), 'YYYY-MM') as month, SUM(t.amount) as total
    FROM transactions t
    JOIN categories cat ON cat.id = t.category_id
    WHERE t.user_id = p_user_id
    GROUP BY cat.name, date_trunc('month', t.date)
    ORDER BY month, category
  ) ct;

  SELECT COALESCE(jsonb_agg(row_to_json(a)::jsonb), '[]'::jsonb)
  INTO v_patrimony
  FROM (
    SELECT category, SUM(value) as total, MAX(date) as last_update
    FROM assets WHERE user_id = p_user_id
    GROUP BY category ORDER BY total DESC
  ) a;

  SELECT COALESCE(jsonb_agg(row_to_json(rt)::jsonb), '[]'::jsonb)
  INTO v_recent_transactions
  FROM (
    SELECT t.id, t.type, t.date, t.amount, t.notes,
           p.name as person_name, cat.name as category_name,
           sub.name as subcategory_name
    FROM transactions t
    LEFT JOIN persons p ON p.id = t.person_id
    LEFT JOIN categories cat ON cat.id = t.category_id
    LEFT JOIN subcategories sub ON sub.id = t.subcategory_id
    WHERE t.user_id = p_user_id
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 20
  ) rt;

  v_insights := jsonb_build_object(
    'avg_daily_expense', CASE WHEN v_total_expense > 0 THEN round(v_total_expense / GREATEST(1, (SELECT count(DISTINCT date) FROM transactions WHERE user_id = p_user_id AND type = 'expense')), 2) ELSE 0 END,
    'top_expense_category', (SELECT cat.name FROM transactions t JOIN categories cat ON cat.id = t.category_id WHERE t.user_id = p_user_id AND t.type = 'expense' GROUP BY cat.name ORDER BY SUM(t.amount) DESC LIMIT 1),
    'top_income_category', (SELECT cat.name FROM transactions t JOIN categories cat ON cat.id = t.category_id WHERE t.user_id = p_user_id AND t.type = 'income' GROUP BY cat.name ORDER BY SUM(t.amount) DESC LIMIT 1)
  );

  INSERT INTO user_financial_snapshot (
    user_id, phone, overview, current_month, monthly_history, categories,
    category_trends, patrimony, recent_transactions, insights, ingest_schema, updated_at
  ) VALUES (
    p_user_id, v_phone, v_overview, v_current_month, v_monthly_history, v_categories,
    v_category_trends, v_patrimony, v_recent_transactions, v_insights, v_schema, v_now
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
    updated_at = EXCLUDED.updated_at;
END;
$$;
