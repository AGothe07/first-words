
-- Enum para status de assinatura
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'pending', 'cancelled', 'overdue', 'trial_active', 'trial_expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum para status de pagamento
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'chargeback');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum para tipo de plano
DO $$ BEGIN
  CREATE TYPE plan_type AS ENUM ('monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  asaas_subscription_id TEXT,
  asaas_customer_id TEXT,
  plan_type plan_type NOT NULL DEFAULT 'monthly',
  status subscription_status NOT NULL DEFAULT 'pending',
  value NUMERIC NOT NULL DEFAULT 0,
  next_due_date DATE,
  started_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  access_expires_at TIMESTAMPTZ,
  last_payment_confirmed_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  trial_used BOOLEAN DEFAULT false,
  manual_access_expires_at TIMESTAMPTZ,
  customer_email TEXT,
  customer_name TEXT,
  customer_cpf_cnpj TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage all subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tabela de pagamentos de assinatura
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  asaas_payment_id TEXT,
  asaas_subscription_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  net_value NUMERIC,
  status payment_status NOT NULL DEFAULT 'pending',
  billing_type TEXT,
  due_date DATE,
  confirmed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON public.subscription_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert payments"
  ON public.subscription_payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage all payments"
  ON public.subscription_payments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tabela de logs de webhook (idempotência)
CREATE TABLE IF NOT EXISTS public.asaas_webhook_logs (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs"
  ON public.asaas_webhook_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage webhook logs"
  ON public.asaas_webhook_logs FOR ALL
  WITH CHECK (true);

-- Triggers de updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: has_valid_access
CREATE OR REPLACE FUNCTION public.has_valid_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Super admin sempre tem acesso
  IF public.has_role(_user_id, 'admin'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Verifica trial ativo
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = _user_id
      AND status = 'trial_active'
      AND trial_ends_at > now()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verifica assinatura ativa
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND access_expires_at > now()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verifica acesso manual concedido por admin
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = _user_id
      AND manual_access_expires_at > now()
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- RPC: email_has_used_trial
CREATE OR REPLACE FUNCTION public.email_has_used_trial(_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE customer_email = lower(trim(_email))
      AND trial_used = true
  );
END;
$$;

-- RPC: check_cpf_email_uniqueness
CREATE OR REPLACE FUNCTION public.check_cpf_email_uniqueness(_cpf TEXT, _email TEXT, _user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cpf_exists BOOLEAN;
  email_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE customer_cpf_cnpj = _cpf
      AND (_user_id IS NULL OR user_id != _user_id)
      AND status NOT IN ('cancelled', 'inactive')
  ) INTO cpf_exists;

  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE customer_email = lower(trim(_email))
      AND (_user_id IS NULL OR user_id != _user_id)
      AND status NOT IN ('cancelled', 'inactive')
  ) INTO email_exists;

  RETURN jsonb_build_object('cpf_exists', cpf_exists, 'email_exists', email_exists);
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription_id ON subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_customer_id ON subscriptions(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_email ON subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_user_id ON subscription_payments(user_id);
