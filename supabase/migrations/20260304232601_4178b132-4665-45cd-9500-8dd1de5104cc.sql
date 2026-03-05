-- Allow authenticated users to SELECT webhook_configs (they need webhook URLs for WhatsApp integration)
CREATE POLICY "Authenticated users can read webhook configs"
ON public.webhook_configs
FOR SELECT
TO authenticated
USING (true);
