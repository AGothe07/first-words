
-- Remove CPF column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cpf;
