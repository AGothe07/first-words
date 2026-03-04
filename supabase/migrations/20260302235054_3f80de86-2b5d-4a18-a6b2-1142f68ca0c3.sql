
-- Add CPF column to profiles (unique, one per account)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles (cpf) WHERE cpf IS NOT NULL;
