-- wá jẹun authentication foundation
-- Review and apply manually in the Supabase SQL Editor. Do not run from the app.
-- This migration adds user profiles and optional ownership for vendor applications.

BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_interest
    ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vendor_interest_user_id_fkey'
          AND conrelid = 'public.vendor_interest'::regclass
    ) THEN
        ALTER TABLE public.vendor_interest
            ADD CONSTRAINT vendor_interest_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_vendor_interest_user_id
    ON public.vendor_interest (user_id)
    WHERE user_id IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_interest ENABLE ROW LEVEL SECURITY;

-- Explicitly reset only policies owned by this migration.
DROP POLICY IF EXISTS "Profiles are readable by their owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are editable by their owner" ON public.profiles;
DROP POLICY IF EXISTS "Vendor applications are readable by their owner" ON public.vendor_interest;

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- Existing interest-table grants deny client writes. Allow only owner-scoped reads.
GRANT SELECT ON TABLE public.vendor_interest TO authenticated;

CREATE POLICY "Profiles are readable by their owner"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()));

CREATE POLICY "Vendor applications are readable by their owner"
    ON public.vendor_interest
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Create a profile on Auth user creation. Only a display name is copied from
-- user metadata; roles and authorization claims are never sourced from metadata.
CREATE OR REPLACE FUNCTION public.create_profile_for_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_for_auth_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS create_profile_after_auth_signup ON auth.users;
CREATE TRIGGER create_profile_after_auth_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_auth_user();

-- Backfill users that may already exist before this migration is applied.
INSERT INTO public.profiles (id, full_name)
SELECT id, NULLIF(raw_user_meta_data ->> 'full_name', '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

COMMIT;
