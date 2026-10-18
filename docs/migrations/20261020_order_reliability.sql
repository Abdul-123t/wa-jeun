-- Production order reliability follow-up. Review and apply manually after the base orders migration.
-- This migration is never run by application startup. No remote database is changed by this repository task.
BEGIN;

ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT;

CREATE OR REPLACE FUNCTION public.create_customer_order(
    p_customer_user_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_fulfillment_method TEXT,
    p_delivery_address TEXT,
    p_items JSONB,
    p_idempotency_key UUID,
    p_is_test_order BOOLEAN,
    p_request_fingerprint TEXT,
    p_expected_delivery_fee_ngn NUMERIC(10,2)
)
RETURNS TABLE (order_id UUID, order_reference TEXT, total_ngn NUMERIC, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_vendor_id UUID;
    v_vendor RECORD;
    v_count INTEGER;
    v_subtotal NUMERIC(12,2);
    v_fee NUMERIC(10,2);
    v_order_id UUID;
    v_reference TEXT;
    v_existing public.customer_orders%ROWTYPE;
    v_line JSONB;
BEGIN
    IF p_customer_user_id IS NULL OR p_idempotency_key IS NULL OR p_is_test_order IS DISTINCT FROM TRUE OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'Only explicit development test orders are enabled' USING ERRCODE = '22023';
    END IF;
    IF p_customer_name IS NULL OR p_customer_phone IS NULL OR length(pg_catalog.btrim(p_customer_name)) NOT BETWEEN 2 AND 120 OR length(p_customer_phone) NOT BETWEEN 8 AND 20 THEN
        RAISE EXCEPTION 'Invalid customer details' USING ERRCODE = '22023';
    END IF;
    IF p_fulfillment_method IS NULL OR p_fulfillment_method NOT IN ('pickup', 'vendor_delivery') OR
       (p_fulfillment_method = 'pickup' AND p_delivery_address IS NOT NULL) OR
       (p_fulfillment_method = 'vendor_delivery' AND (p_delivery_address IS NULL OR length(pg_catalog.btrim(p_delivery_address)) NOT BETWEEN 3 AND 300)) THEN
        RAISE EXCEPTION 'Invalid fulfillment details' USING ERRCODE = '22023';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid cart' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 30 THEN
        RAISE EXCEPTION 'Invalid cart' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(p_items) AS entries(item)
        WHERE (entries.item->>'quantity') IS NULL OR (entries.item->>'quantity') !~ '^[1-9][0-9]{0,1}$'
           OR CASE WHEN (entries.item->>'quantity') ~ '^[1-9][0-9]{0,1}$' THEN (entries.item->>'quantity')::INTEGER NOT BETWEEN 1 AND 99 ELSE FALSE END
           OR (entries.item->>'menuItemId') IS NULL OR (entries.item->>'menuItemId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR (entries.item->>'expectedPriceNgn') IS NULL OR (entries.item->>'expectedPriceNgn') !~ '^[0-9]+(\.[0-9]{1,2})?$'
    ) OR (SELECT count(DISTINCT entries.item->>'menuItemId') FROM pg_catalog.jsonb_array_elements(p_items) AS entries(item)) <> jsonb_array_length(p_items) THEN
        RAISE EXCEPTION 'Invalid cart item or quantity' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_existing FROM public.customer_orders o
     WHERE o.customer_user_id = p_customer_user_id AND o.idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_existing.idempotency_fingerprint IS DISTINCT FROM p_request_fingerprint THEN RAISE EXCEPTION 'Checkout key used with different request' USING ERRCODE = 'PZ002'; END IF;
        RETURN QUERY SELECT v_existing.id, v_existing.order_reference, v_existing.total_ngn, FALSE;
        RETURN;
    END IF;

    SELECT m.vendor_interest_id INTO v_vendor_id
      FROM public.vendor_menu_items m
      JOIN pg_catalog.jsonb_array_elements(p_items) AS entries(item) ON m.id = (entries.item->>'menuItemId')::UUID
     ORDER BY m.id LIMIT 1;
    IF v_vendor_id IS NULL THEN RAISE EXCEPTION 'Menu item unavailable' USING ERRCODE = 'P0002'; END IF;

    SELECT v.* INTO v_vendor FROM public.vendor_interest v WHERE v.id = v_vendor_id FOR SHARE;
    IF NOT FOUND OR v_vendor.status IS DISTINCT FROM 'approved' OR v_vendor.accepting_orders IS DISTINCT FROM TRUE OR
       v_vendor.business_type IS NULL OR v_vendor.business_type NOT IN ('restaurant', 'local_buka', 'fast_food', 'grill_shawarma', 'bakery_snacks', 'other') OR
       length(pg_catalog.btrim(COALESCE(v_vendor.business_name, ''))) < 2 OR length(pg_catalog.btrim(COALESCE(v_vendor.neighborhood, ''))) < 2 OR
       length(pg_catalog.btrim(COALESCE(v_vendor.description, ''))) < 20 OR v_vendor.opening_hours IS NULL THEN
        RAISE EXCEPTION 'Food business is not currently eligible' USING ERRCODE = 'P0002';
    END IF;
    IF v_vendor.fulfillment_options IS NULL OR
       (p_fulfillment_method = 'pickup' AND v_vendor.fulfillment_options NOT IN ('pickup_only', 'pickup_and_delivery')) OR
       (p_fulfillment_method = 'vendor_delivery' AND v_vendor.fulfillment_options NOT IN ('vendor_delivery', 'pickup_and_delivery')) THEN
        RAISE EXCEPTION 'Fulfillment option unavailable' USING ERRCODE = '22023';
    END IF;
    IF p_fulfillment_method = 'vendor_delivery' AND (v_vendor.delivery_fee_ngn IS NULL OR v_vendor.delivery_fee_ngn < 0) THEN
        RAISE EXCEPTION 'Delivery fee is not configured' USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(v_vendor.opening_hours) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Business hours are incomplete' USING ERRCODE = 'P0002'; END IF;
    IF NOT COALESCE((
        SELECT count(*) = 7 AND bool_or(day.value->>'closed' = 'false') AND bool_and(
            COALESCE(day.value->>'closed' = 'true' OR (
                day.value->>'closed' = 'false' AND day.value->>'open' ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND
                day.value->>'close' ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND day.value->>'open' < day.value->>'close'
            ), FALSE)
        ) FROM jsonb_each(v_vendor.opening_hours) AS day(key, value)
        WHERE day.key IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ), FALSE) THEN RAISE EXCEPTION 'Business hours are incomplete' USING ERRCODE = 'P0002'; END IF;

    -- Opening hours are evaluated using Lagos local day/time while the vendor row is locked.
    IF NOT EXISTS (
        SELECT 1 FROM (SELECT timezone('Africa/Lagos', now()) AS local_now) n
        CROSS JOIN LATERAL (SELECT CASE extract(isodow FROM n.local_now)::INTEGER
            WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday' WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday'
            WHEN 5 THEN 'friday' WHEN 6 THEN 'saturday' ELSE 'sunday' END AS day_name,
            to_char(n.local_now, 'HH24:MI') AS local_time) t
        WHERE COALESCE((v_vendor.opening_hours->t.day_name->>'closed')::BOOLEAN, TRUE) = FALSE
          AND t.local_time >= v_vendor.opening_hours->t.day_name->>'open'
          AND t.local_time < v_vendor.opening_hours->t.day_name->>'close'
    ) THEN RAISE EXCEPTION 'Business currently closed' USING ERRCODE = 'P0002'; END IF;

    PERFORM m.id FROM public.vendor_menu_items m
      JOIN pg_catalog.jsonb_array_elements(p_items) AS entries(item) ON m.id = (entries.item->>'menuItemId')::UUID
     WHERE m.vendor_interest_id = v_vendor_id AND m.available = TRUE
       AND round(m.price_ngn, 2) = round((entries.item->>'expectedPriceNgn')::NUMERIC, 2)
     ORDER BY m.id FOR SHARE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Menu item unavailable or price changed' USING ERRCODE = 'PZ001'; END IF;

    SELECT pg_catalog.sum(m.price_ngn * (entries.item->>'quantity')::INTEGER)::NUMERIC(12,2) INTO v_subtotal
      FROM public.vendor_menu_items m
      JOIN pg_catalog.jsonb_array_elements(p_items) AS entries(item) ON m.id = (entries.item->>'menuItemId')::UUID
     WHERE m.vendor_interest_id = v_vendor_id AND m.available = TRUE;
    v_fee := CASE WHEN p_fulfillment_method = 'vendor_delivery' THEN v_vendor.delivery_fee_ngn ELSE NULL END;
    IF p_fulfillment_method = 'vendor_delivery' AND (v_fee IS NULL OR v_fee IS DISTINCT FROM p_expected_delivery_fee_ngn) THEN
        RAISE EXCEPTION 'Delivery fee changed or is not configured' USING ERRCODE = 'PZ001';
    END IF;
    IF p_fulfillment_method = 'pickup' AND p_expected_delivery_fee_ngn IS NOT NULL THEN RAISE EXCEPTION 'Pickup must not include a delivery fee' USING ERRCODE = '22023'; END IF;

    v_order_id := gen_random_uuid();
    v_reference := 'WJ-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10));
    INSERT INTO public.customer_orders (
        id, order_reference, customer_user_id, vendor_interest_id, customer_name, customer_phone,
        fulfillment_method, delivery_address, subtotal_ngn, delivery_fee_ngn, total_ngn, status,
        payment_status, is_test_order, idempotency_key, idempotency_fingerprint
    ) VALUES (
        v_order_id, v_reference, p_customer_user_id, v_vendor_id, pg_catalog.btrim(p_customer_name), p_customer_phone,
        p_fulfillment_method, NULLIF(pg_catalog.btrim(p_delivery_address), ''), v_subtotal,
        v_fee, v_subtotal + COALESCE(v_fee, 0), 'placed', 'test_unpaid', TRUE, p_idempotency_key, p_request_fingerprint
    ) ON CONFLICT (customer_user_id, idempotency_key) DO NOTHING;
    IF NOT FOUND THEN
        SELECT * INTO v_existing FROM public.customer_orders o WHERE o.customer_user_id = p_customer_user_id AND o.idempotency_key = p_idempotency_key;
        IF v_existing.idempotency_fingerprint IS DISTINCT FROM p_request_fingerprint THEN RAISE EXCEPTION 'Checkout key used with different request' USING ERRCODE = 'PZ002'; END IF;
        RETURN QUERY SELECT v_existing.id, v_existing.order_reference, v_existing.total_ngn, FALSE;
        RETURN;
    END IF;

    INSERT INTO public.customer_order_items (order_id, menu_item_id, item_name, quantity, unit_price_ngn, line_total_ngn)
    SELECT v_order_id, m.id, m.name, (entries.item->>'quantity')::INTEGER, m.price_ngn,
           m.price_ngn * (entries.item->>'quantity')::INTEGER
      FROM public.vendor_menu_items m
      JOIN pg_catalog.jsonb_array_elements(p_items) AS entries(item) ON m.id = (entries.item->>'menuItemId')::UUID
     WHERE m.vendor_interest_id = v_vendor_id AND m.available = TRUE;
    RETURN QUERY SELECT v_order_id, v_reference, v_subtotal + COALESCE(v_fee, 0), TRUE;
END;
$$;


REVOKE ALL ON FUNCTION public.create_customer_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_customer_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, BOOLEAN, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, BOOLEAN, TEXT, NUMERIC) TO service_role;

COMMIT;
