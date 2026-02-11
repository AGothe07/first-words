
-- Add unique constraint on phone (only one user can own a phone at a time)
CREATE UNIQUE INDEX idx_profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;
