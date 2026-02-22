
-- Add unique constraint on user_id for ON CONFLICT support
ALTER TABLE public.user_financial_snapshot ADD CONSTRAINT user_financial_snapshot_user_id_key UNIQUE (user_id);
