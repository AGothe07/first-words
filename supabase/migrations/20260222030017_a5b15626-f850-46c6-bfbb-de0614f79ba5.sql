
-- Add installment tracking columns to transactions
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS installment_group_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS installment_number INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS installment_total INTEGER DEFAULT NULL;

-- Index for quickly finding all installments in a group
CREATE INDEX IF NOT EXISTS idx_transactions_installment_group 
  ON public.transactions (installment_group_id) 
  WHERE installment_group_id IS NOT NULL;
