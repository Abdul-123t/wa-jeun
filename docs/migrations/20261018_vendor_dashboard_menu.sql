-- wá jẹun vendor dashboard, storefront, and menu foundation
-- Apply manually after database_schema.sql, 20261017_authentication_foundation.sql,
-- and 20261017_super_admin_vendor_review.sql. Never run from the application.

BEGIN;

-- Fail closed before any schema changes if this bucket ID is already present.
-- The exception aborts this transaction, rolling back all later migration work.
-- Existing buckets and their objects require manual review; do not assume they
-- contain only public food images. The INSERT below also has no conflict handler,
-- so a concurrent bucket creation aborts and rolls back the transaction too.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'vendor-menu-images'
    ) THEN
        RAISE EXCEPTION 'Bucket vendor-menu-images already exists. Review its settings and every object manually; no migration changes were applied.';
    END IF;
END;
$$;

ALTER TABLE public.vendor_interest
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS opening_hours JSONB,
    ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.vendor_interest
    DROP CONSTRAINT IF EXISTS vendor_interest_status_check;
ALTER TABLE public.vendor_interest
    ADD CONSTRAINT vendor_interest_status_check
    CHECK (status IN ('pending_review', 'under_review', 'contacted', 'approved', 'declined', 'suspended'));

CREATE OR REPLACE FUNCTION public.disable_vendor_store_when_unapproved()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.status <> 'approved' THEN
        NEW.accepting_orders := FALSE;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS disable_vendor_store_when_unapproved ON public.vendor_interest;
CREATE TRIGGER disable_vendor_store_when_unapproved
    BEFORE UPDATE OF status ON public.vendor_interest
    FOR EACH ROW EXECUTE FUNCTION public.disable_vendor_store_when_unapproved();
REVOKE ALL ON FUNCTION public.disable_vendor_store_when_unapproved() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.vendor_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_interest_id UUID NOT NULL REFERENCES public.vendor_interest(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
    description VARCHAR(1000) NOT NULL DEFAULT '',
    price_ngn NUMERIC(10,2) NOT NULL CHECK (price_ngn > 0 AND price_ngn <= 10000000),
    category VARCHAR(30) NOT NULL CHECK (category IN ('rice', 'swallow', 'soup', 'grills', 'fast_food', 'snacks', 'drinks', 'other')),
    image_url TEXT,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_menu_items_vendor_available
    ON public.vendor_menu_items(vendor_interest_id, available);
ALTER TABLE public.vendor_menu_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.vendor_menu_items FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.vendor_menu_items TO service_role;

-- All writes are made by the server using its secret key after verifying both
-- the Supabase user and ownership. The bucket contains public food photos only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vendor-menu-images', 'vendor-menu-images', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

DROP POLICY IF EXISTS "Public may view vendor menu images" ON storage.objects;
CREATE POLICY "Public may view vendor menu images"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'vendor-menu-images');

COMMIT;
