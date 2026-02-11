
-- 1. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 2. AI tokens table
CREATE TABLE public.ai_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.ai_tokens ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_ai_tokens_active_user ON public.ai_tokens(user_id) WHERE is_active = true;
CREATE INDEX idx_ai_tokens_token_hash ON public.ai_tokens(token_hash) WHERE is_active = true;

CREATE POLICY "Users can view own ai_tokens"
ON public.ai_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can do everything on ai_tokens"
ON public.ai_tokens FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own ai_tokens"
ON public.ai_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai_tokens"
ON public.ai_tokens FOR UPDATE
USING (auth.uid() = user_id);

-- 3. Webhook configs table
CREATE TABLE public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhooks"
ON public.webhook_configs FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Webhook logs (metadata only, no sensitive data)
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id UUID REFERENCES public.webhook_configs(id) ON DELETE SET NULL,
  status_code INT,
  response_time_ms INT,
  event_type TEXT NOT NULL DEFAULT 'ai_enablement',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_webhook_logs_called_at ON public.webhook_logs(called_at DESC);

CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Security events table
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_security_events_created_at ON public.security_events(created_at DESC);

CREATE POLICY "Admins can view security events"
ON public.security_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Add AI and activity columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;

-- 7. Auto-assign roles on profile creation
CREATE OR REPLACE FUNCTION public.auto_assign_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT;
BEGIN
  _email := COALESCE(NEW.email, (SELECT email FROM auth.users WHERE id = NEW.id));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _email = 'arthurgothe@icloud.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_assign_roles
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_roles();

-- 8. Ensure update_updated_at_column exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_webhook_configs_updated_at
BEFORE UPDATE ON public.webhook_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Index for user_roles
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- 10. Assign roles to all existing users
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'user'::app_role FROM public.profiles p
ON CONFLICT (user_id, role) DO NOTHING;

-- Assign admin to existing admin user
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role FROM auth.users u
WHERE u.email = 'arthurgothe@icloud.com'
ON CONFLICT (user_id, role) DO NOTHING;
