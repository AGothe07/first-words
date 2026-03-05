
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL DEFAULT '',
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage admin_settings"
  ON public.admin_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed the two settings
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
  ('api_key_admin', '', 'Chave de API administrativa para gerenciamento de instâncias WhatsApp'),
  ('instance_token_system', '', 'Token da instância do sistema para envios automáticos (IA, verificação, notificações)');
