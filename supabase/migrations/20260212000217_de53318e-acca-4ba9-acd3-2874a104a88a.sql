
-- FIX CRITICAL: user_financial_snapshot RLS allows any authenticated user full access
DROP POLICY IF EXISTS "Service role access" ON public.user_financial_snapshot;

-- Only allow users to read their own snapshot
CREATE POLICY "Users can view own snapshot"
ON public.user_financial_snapshot
FOR SELECT
USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for regular users
-- Edge functions use service_role which bypasses RLS
