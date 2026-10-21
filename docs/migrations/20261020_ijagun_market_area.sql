-- Add Ijagun as a second discoverable market area while preserving current
-- Ijebu Ode records and their existing neighborhood labels. Apply manually
-- after reviewing the target database; this migration is not run by the app.
BEGIN;

CREATE TABLE IF NOT EXISTS public.market_areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO public.market_areas (id, name, display_name) VALUES
    ('ijebu-ode', 'Ijebu Ode', 'Ijebu Ode'),
    ('ijagun', 'Ijagun', 'Ijagun (TASUED area)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, active = TRUE;
ALTER TABLE public.market_areas ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.market_areas FROM PUBLIC, anon, authenticated;

ALTER TABLE public.customer_interest
    ADD COLUMN IF NOT EXISTS market_area TEXT NOT NULL DEFAULT 'ijebu-ode';

ALTER TABLE public.vendor_interest
    ADD COLUMN IF NOT EXISTS market_area TEXT NOT NULL DEFAULT 'ijebu-ode',
    ADD COLUMN IF NOT EXISTS street_address VARCHAR(250),
    ADD COLUMN IF NOT EXISTS nearby_landmark VARCHAR(250),
    ADD COLUMN IF NOT EXISTS delivery_coverage TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.customer_interest
    DROP CONSTRAINT IF EXISTS customer_interest_market_area_check,
    DROP CONSTRAINT IF EXISTS customer_interest_market_area_fkey;
ALTER TABLE public.customer_interest
    ADD CONSTRAINT customer_interest_market_area_fkey
    FOREIGN KEY (market_area) REFERENCES public.market_areas(id);

ALTER TABLE public.vendor_interest
    DROP CONSTRAINT IF EXISTS vendor_interest_market_area_check,
    DROP CONSTRAINT IF EXISTS vendor_interest_market_area_fkey;
ALTER TABLE public.vendor_interest
    ADD CONSTRAINT vendor_interest_market_area_fkey
    FOREIGN KEY (market_area) REFERENCES public.market_areas(id);

ALTER TABLE public.vendor_interest
    DROP CONSTRAINT IF EXISTS vendor_interest_delivery_coverage_check;

CREATE INDEX IF NOT EXISTS idx_vendor_market_area_status
    ON public.vendor_interest (market_area, status);
CREATE INDEX IF NOT EXISTS idx_vendor_delivery_coverage
    ON public.vendor_interest USING GIN (delivery_coverage);

COMMIT;
