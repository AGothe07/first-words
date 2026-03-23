ALTER TABLE public.investment_entries ADD COLUMN entry_type text NOT NULL DEFAULT 'buy';

COMMENT ON COLUMN public.investment_entries.entry_type IS 'Type of entry: buy, sell, or dividend';