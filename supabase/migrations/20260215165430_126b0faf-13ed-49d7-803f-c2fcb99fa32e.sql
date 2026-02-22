
-- =============================================
-- FINANCIAL DIMENSIONS SYSTEM
-- =============================================

-- 1. Dimension settings per user (which dimensions are active)
CREATE TABLE public.dimension_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dimension_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_required BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, dimension_key)
);

ALTER TABLE public.dimension_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dimension settings" ON public.dimension_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Payment Methods
CREATE TABLE public.payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own payment methods" ON public.payment_methods
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Accounts (bank accounts, cards)
CREATE TABLE public.accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT DEFAULT 'checking',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own accounts" ON public.accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Projects / Cost Centers
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Tags (free-form labels)
CREATE TABLE public.tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Transaction-Tags junction (many-to-many)
CREATE TABLE public.transaction_tags (
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transaction tags" ON public.transaction_tags
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));

-- 7. Add dimension columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.payment_methods(id),
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);

-- 8. Function to seed default dimensions for new users
CREATE OR REPLACE FUNCTION public.seed_default_dimensions(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Default dimension settings (all optional, all inactive)
  INSERT INTO public.dimension_settings (user_id, dimension_key, is_active, is_required, display_order) VALUES
    (p_user_id, 'payment_method', false, false, 1),
    (p_user_id, 'account', false, false, 2),
    (p_user_id, 'project', false, false, 3),
    (p_user_id, 'tags', false, false, 4)
  ON CONFLICT (user_id, dimension_key) DO NOTHING;

  -- Pre-defined payment methods (inactive by default)
  INSERT INTO public.payment_methods (user_id, name, is_active, is_system) VALUES
    (p_user_id, 'PIX', false, true),
    (p_user_id, 'Cartão de Crédito', false, true),
    (p_user_id, 'Cartão de Débito', false, true),
    (p_user_id, 'Dinheiro', false, true),
    (p_user_id, 'Boleto', false, true),
    (p_user_id, 'Transferência', false, true)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Auto-seed dimensions when a new profile is created
CREATE OR REPLACE FUNCTION public.trigger_seed_dimensions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_default_dimensions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_profile_created_seed_dimensions
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_dimensions();

-- 10. Updated_at triggers for new tables
CREATE TRIGGER update_dimension_settings_updated_at
  BEFORE UPDATE ON public.dimension_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
