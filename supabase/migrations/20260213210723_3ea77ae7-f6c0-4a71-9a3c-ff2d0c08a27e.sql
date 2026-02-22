
-- Function to trigger snapshot rebuild
CREATE OR REPLACE FUNCTION public.trigger_rebuild_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  -- Rebuild snapshot asynchronously via pg_net if available, otherwise sync
  PERFORM public.rebuild_user_snapshot(v_user_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Transactions: INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trg_rebuild_snapshot_transactions ON public.transactions;
CREATE TRIGGER trg_rebuild_snapshot_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_rebuild_snapshot();

-- Categories: INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trg_rebuild_snapshot_categories ON public.categories;
CREATE TRIGGER trg_rebuild_snapshot_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_rebuild_snapshot();

-- Subcategories: INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trg_rebuild_snapshot_subcategories ON public.subcategories;
CREATE TRIGGER trg_rebuild_snapshot_subcategories
  AFTER INSERT OR UPDATE OR DELETE ON public.subcategories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_rebuild_snapshot();

-- Persons: INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trg_rebuild_snapshot_persons ON public.persons;
CREATE TRIGGER trg_rebuild_snapshot_persons
  AFTER INSERT OR UPDATE OR DELETE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.trigger_rebuild_snapshot();

-- Assets: INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trg_rebuild_snapshot_assets ON public.assets;
CREATE TRIGGER trg_rebuild_snapshot_assets
  AFTER INSERT OR UPDATE OR DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.trigger_rebuild_snapshot();
