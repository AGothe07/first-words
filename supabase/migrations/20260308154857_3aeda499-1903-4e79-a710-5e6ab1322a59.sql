
-- Drop old functions with CASCADE
DROP FUNCTION IF EXISTS public.is_family_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_family_summary(uuid, date, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_family_id(uuid) CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.families CASCADE;
