
-- 1. Normalize existing categories to UPPERCASE
UPDATE public.categories SET name = UPPER(name);

-- 2. Normalize existing subcategories to Title Case (first letter upper, rest lower)
UPDATE public.subcategories SET name = CONCAT(UPPER(LEFT(name, 1)), LOWER(SUBSTRING(name FROM 2)));

-- 3. Trigger function: auto-normalize category name to UPPERCASE on insert/update
CREATE OR REPLACE FUNCTION public.normalize_category_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := UPPER(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_normalize_category_name
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_category_name();

-- 4. Trigger function: auto-normalize subcategory name to Title Case on insert/update
CREATE OR REPLACE FUNCTION public.normalize_subcategory_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := CONCAT(UPPER(LEFT(NEW.name, 1)), LOWER(SUBSTRING(NEW.name FROM 2)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_normalize_subcategory_name
  BEFORE INSERT OR UPDATE ON public.subcategories
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_subcategory_name();

-- 5. Create view for external financial data consumption by phone
CREATE OR REPLACE VIEW public.vw_financial_data_by_phone AS
SELECT
  p.phone,
  p.id AS user_id,
  p.ai_enabled,
  t.id AS transaction_id,
  t.type,
  t.date,
  t.amount,
  t.notes,
  t.created_at AS transaction_created_at,
  per.name AS person_name,
  c.name AS category_name,
  sc.name AS subcategory_name,
  TO_CHAR(t.date::date, 'YYYY-MM') AS month_year
FROM public.profiles p
JOIN public.transactions t ON t.user_id = p.id
JOIN public.persons per ON per.id = t.person_id
JOIN public.categories c ON c.id = t.category_id
LEFT JOIN public.subcategories sc ON sc.id = t.subcategory_id
WHERE p.phone IS NOT NULL AND p.ai_enabled = true;

-- 6. Create aggregated summary view
CREATE OR REPLACE VIEW public.vw_financial_summary_by_phone AS
SELECT
  p.phone,
  p.id AS user_id,
  COUNT(t.id) AS total_transactions,
  COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS total_income,
  COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS total_expense,
  COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS balance,
  MIN(t.date) AS first_transaction_date,
  MAX(t.date) AS last_transaction_date
FROM public.profiles p
JOIN public.transactions t ON t.user_id = p.id
WHERE p.phone IS NOT NULL AND p.ai_enabled = true
GROUP BY p.phone, p.id;
