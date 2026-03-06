INSERT INTO webhook_configs (url, function_key, description, is_active, created_by, payload_fields)
SELECT 
  '',
  'whatsapp_delete',
  'Deletar instância WhatsApp',
  true,
  ur.user_id,
  '{}'::jsonb
FROM user_roles ur
WHERE ur.role = 'admin'
LIMIT 1;