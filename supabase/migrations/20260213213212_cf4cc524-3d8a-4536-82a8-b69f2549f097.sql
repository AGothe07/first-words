
-- Remove duplicate trigger on transactions (trg_rebuild_snapshot is redundant with trg_rebuild_snapshot_transactions)
DROP TRIGGER IF EXISTS trg_rebuild_snapshot ON public.transactions;
