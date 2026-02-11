
-- Fix security definer views by setting them to SECURITY INVOKER
ALTER VIEW public.vw_financial_data_by_phone SET (security_invoker = on);
ALTER VIEW public.vw_financial_summary_by_phone SET (security_invoker = on);
