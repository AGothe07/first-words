
-- Add function_key to webhook_configs
ALTER TABLE public.webhook_configs ADD COLUMN function_key text UNIQUE;

-- Insert all hardcoded webhooks
INSERT INTO public.webhook_configs (url, description, function_key, is_active, created_by)
SELECT 
  'https://n8n-n8n.czby9f.easypanel.host/webhook/saasLendscopeFinancial_enviarmsgAniversario',
  'Envio de mensagem de aniversário via n8n',
  'birthday_notification',
  true,
  ur.user_id
FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1
ON CONFLICT (function_key) DO NOTHING;

INSERT INTO public.webhook_configs (url, description, function_key, is_active, created_by)
SELECT 
  'https://n8n-n8n.czby9f.easypanel.host/webhook/saasLendscopeFinancial_enviarmsgLembrete',
  'Envio de lembrete de agenda via n8n',
  'event_notification',
  true,
  ur.user_id
FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1
ON CONFLICT (function_key) DO NOTHING;

INSERT INTO public.webhook_configs (url, description, function_key, is_active, created_by)
SELECT 
  'https://n8n-n8n.czby9f.easypanel.host/webhook/verificar-status-instanciaFinancial',
  'Verificar status da instância WhatsApp',
  'whatsapp_status',
  true,
  ur.user_id
FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1
ON CONFLICT (function_key) DO NOTHING;

INSERT INTO public.webhook_configs (url, description, function_key, is_active, created_by)
SELECT 
  'https://n8n-n8n.czby9f.easypanel.host/webhook/cria-instancia-uazapiFinancial',
  'Criar instância WhatsApp',
  'whatsapp_create',
  true,
  ur.user_id
FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1
ON CONFLICT (function_key) DO NOTHING;

INSERT INTO public.webhook_configs (url, description, function_key, is_active, created_by)
SELECT 
  'https://n8n-n8n.czby9f.easypanel.host/webhook/conectar-insancia-uazapiFinancial',
  'Conectar instância WhatsApp (QR Code)',
  'whatsapp_connect',
  true,
  ur.user_id
FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1
ON CONFLICT (function_key) DO NOTHING;

INSERT INTO public.webhook_configs (url, description, function_key, is_active, created_by)
SELECT 
  'https://n8n-n8n.czby9f.easypanel.host/webhook/desconectar-instancia-uazapiFinancial',
  'Desconectar instância WhatsApp',
  'whatsapp_disconnect',
  true,
  ur.user_id
FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1
ON CONFLICT (function_key) DO NOTHING;
