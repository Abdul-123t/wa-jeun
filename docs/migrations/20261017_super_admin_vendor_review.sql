-- wá jẹun Super Admin vendor review workflow
-- Review and apply manually after database_schema.sql and
-- 20261017_authentication_foundation.sql. Never run from the application.

BEGIN;

-- Membership is provisioned only by a trusted project owner through Supabase.
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.admin_users TO service_role;

-- Keep client access to review history completely disabled.
CREATE TABLE IF NOT EXISTS public.vendor_review_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_interest_id UUID NOT NULL REFERENCES public.vendor_interest (id) ON DELETE RESTRICT,
    actor_user_id UUID NOT NULL,
    action VARCHAR(30) NOT NULL CHECK (action IN ('under_review', 'approve', 'reject', 'request_information')),
    previous_status VARCHAR(30) NOT NULL,
    new_status VARCHAR(30) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vendor_review_reason_length CHECK (reason IS NULL OR length(reason) <= 2000)
);
CREATE INDEX IF NOT EXISTS idx_vendor_review_audit_application_date
    ON public.vendor_review_audit (vendor_interest_id, created_at DESC);
ALTER TABLE public.vendor_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.vendor_review_audit FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.vendor_review_audit TO service_role;

-- Existing supported statuses are preserved; add under_review for the explicit
-- review action. Replacing this known base-schema constraint is repeatable.
ALTER TABLE public.vendor_interest
    DROP CONSTRAINT IF EXISTS vendor_interest_status_check;
ALTER TABLE public.vendor_interest
    ADD CONSTRAINT vendor_interest_status_check
    CHECK (status IN ('pending_review', 'under_review', 'contacted', 'approved', 'declined'));

-- A single database function performs status update and audit insertion in one
-- transaction. The API passes only an identity it has independently verified.
CREATE OR REPLACE FUNCTION public.admin_review_vendor_application(
    p_application_id UUID,
    p_actor_user_id UUID,
    p_action TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, status TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_owner_user_id UUID;
    v_previous_status VARCHAR(30);
    v_new_status VARCHAR(30);
    v_reason TEXT := NULLIF(pg_catalog.btrim(p_reason), '');
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users AS admins
        WHERE admins.user_id = p_actor_user_id
    ) THEN
        RAISE EXCEPTION 'Administrator membership required' USING ERRCODE = '42501';
    END IF;

    IF p_action NOT IN ('under_review', 'approve', 'reject', 'request_information')
       OR pg_catalog.length(COALESCE(v_reason, '')) > 2000
       OR (p_action IN ('reject', 'request_information') AND v_reason IS NULL) THEN
        RAISE EXCEPTION 'Invalid review action or reason' USING ERRCODE = '22023';
    END IF;

    SELECT vendor.user_id, vendor.status
      INTO v_owner_user_id, v_previous_status
      FROM public.vendor_interest AS vendor
     WHERE vendor.id = p_application_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vendor application not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_owner_user_id = p_actor_user_id THEN
        RAISE EXCEPTION 'Administrators cannot review their own application' USING ERRCODE = '42501';
    END IF;

    v_new_status := CASE p_action
        WHEN 'under_review' THEN 'under_review'
        WHEN 'approve' THEN 'approved'
        WHEN 'reject' THEN 'declined'
        WHEN 'request_information' THEN 'contacted'
    END;

    UPDATE public.vendor_interest AS vendor
       SET status = v_new_status,
           updated_at = pg_catalog.now()
     WHERE vendor.id = p_application_id;

    INSERT INTO public.vendor_review_audit (
        vendor_interest_id, actor_user_id, action, previous_status, new_status, reason
    ) VALUES (
        p_application_id, p_actor_user_id, p_action, v_previous_status, v_new_status, v_reason
    );

    RETURN QUERY
    SELECT p_application_id, v_new_status::TEXT, pg_catalog.now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_vendor_application(UUID, UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_vendor_application(UUID, UUID, TEXT, TEXT)
    TO service_role;

COMMIT;
