-- wá jẹun customer orders, order history, and vendor inbox foundation.
-- Review and apply manually after the existing authentication, vendor review,
-- and vendor menu migrations. This migration is never run by the application.

BEGIN;

ALTER TABLE public.vendor_interest
    ADD COLUMN IF NOT EXISTS delivery_fee_ngn NUMERIC(10,2),
    ADD CONSTRAINT vendor_delivery_fee_nonnegative CHECK (delivery_fee_ngn IS NULL OR delivery_fee_ngn >= 0);

CREATE TABLE public.customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_reference TEXT NOT NULL UNIQUE,
    customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    vendor_interest_id UUID NOT NULL REFERENCES public.vendor_interest(id) ON DELETE RESTRICT,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    fulfillment_method TEXT NOT NULL CHECK (fulfillment_method IN ('pickup', 'vendor_delivery')),
    delivery_address VARCHAR(300),
    currency CHAR(3) NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    subtotal_ngn NUMERIC(12,2) NOT NULL CHECK (subtotal_ngn > 0),
    delivery_fee_ngn NUMERIC(10,2),
    total_ngn NUMERIC(12,2) NOT NULL CHECK (total_ngn > 0),
    status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'accepted', 'rejected', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed')),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('not_configured', 'pending', 'paid', 'failed', 'refunded', 'test_unpaid')),
    payment_reference TEXT,
    is_test_order BOOLEAN NOT NULL DEFAULT FALSE,
    idempotency_key UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    preparing_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    out_for_delivery_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE (customer_user_id, idempotency_key),
    CHECK ((fulfillment_method = 'pickup' AND delivery_address IS NULL) OR (fulfillment_method = 'vendor_delivery' AND delivery_address IS NOT NULL AND length(btrim(delivery_address)) BETWEEN 3 AND 300)),
    CHECK ((fulfillment_method = 'pickup' AND delivery_fee_ngn IS NULL) OR (fulfillment_method = 'vendor_delivery' AND delivery_fee_ngn IS NOT NULL)),
    CHECK ((is_test_order AND payment_status = 'test_unpaid' AND payment_reference IS NULL) OR (NOT is_test_order AND payment_status <> 'test_unpaid')),
    CHECK (total_ngn = subtotal_ngn + COALESCE(delivery_fee_ngn, 0))
);

CREATE TABLE public.customer_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.vendor_menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(120) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    unit_price_ngn NUMERIC(10,2) NOT NULL CHECK (unit_price_ngn > 0),
    line_total_ngn NUMERIC(12,2) NOT NULL CHECK (line_total_ngn = unit_price_ngn * quantity),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_id, menu_item_id)
);

CREATE INDEX customer_orders_customer_created_idx ON public.customer_orders(customer_user_id, created_at DESC);
CREATE INDEX customer_orders_vendor_created_idx ON public.customer_orders(vendor_interest_id, created_at DESC);
CREATE INDEX customer_order_items_order_idx ON public.customer_order_items(order_id);

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_orders, public.customer_order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.customer_orders, public.customer_order_items TO authenticated;
GRANT ALL ON public.customer_orders, public.customer_order_items TO service_role;

CREATE OR REPLACE FUNCTION public.is_wajeun_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_wajeun_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_wajeun_admin() TO authenticated;

CREATE POLICY customer_orders_read_owner_or_vendor_or_admin ON public.customer_orders
    FOR SELECT TO authenticated USING (
        customer_user_id = (SELECT auth.uid()) OR
        EXISTS (SELECT 1 FROM public.vendor_interest v WHERE v.id = vendor_interest_id AND v.user_id = (SELECT auth.uid())) OR
        public.is_wajeun_admin()
    );
CREATE POLICY customer_order_items_read_owner_or_vendor_or_admin ON public.customer_order_items
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.customer_orders o WHERE o.id = order_id)
    );

-- Server-only atomic checkout. Prices and item names are read from current menu
-- rows under lock; no browser price, subtotal, vendor ID, or status is accepted.
CREATE OR REPLACE FUNCTION public.create_customer_order(
    p_customer_user_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_fulfillment_method TEXT,
    p_delivery_address TEXT,
    p_items JSONB,
    p_idempotency_key UUID,
    p_is_test_order BOOLEAN
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
    IF p_customer_user_id IS NULL OR p_idempotency_key IS NULL OR p_is_test_order IS DISTINCT FROM TRUE THEN
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
    ) OR (SELECT count(DISTINCT entries.item->>'menuItemId') FROM pg_catalog.jsonb_array_elements(p_items) AS entries(item)) <> jsonb_array_length(p_items) THEN
        RAISE EXCEPTION 'Invalid cart item or quantity' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_existing FROM public.customer_orders o
     WHERE o.customer_user_id = p_customer_user_id AND o.idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN QUERY SELECT v_existing.id, v_existing.order_reference, v_existing.total_ngn, FALSE;
        RETURN;
    END IF;

    SELECT m.vendor_interest_id INTO v_vendor_id
      FROM public.vendor_menu_items m
      JOIN pg_catalog.jsonb_array_elements(p_items) AS entries(item) ON m.id = (entries.item->>'menuItemId')::UUID
     ORDER BY m.id LIMIT 1;
    IF v_vendor_id IS NULL THEN RAISE EXCEPTION 'Menu item unavailable' USING ERRCODE = 'P0002'; END IF;

    SELECT v.* INTO v_vendor FROM public.vendor_interest v WHERE v.id = v_vendor_id FOR SHARE;
    IF NOT FOUND OR v_vendor.status <> 'approved' OR v_vendor.accepting_orders IS DISTINCT FROM TRUE OR
       length(pg_catalog.btrim(v_vendor.business_name)) < 2 OR length(pg_catalog.btrim(v_vendor.neighborhood)) < 2 OR
       length(pg_catalog.btrim(COALESCE(v_vendor.description, ''))) < 20 OR v_vendor.opening_hours IS NULL THEN
        RAISE EXCEPTION 'Food business is not currently eligible' USING ERRCODE = 'P0002';
    END IF;
    IF (p_fulfillment_method = 'pickup' AND v_vendor.fulfillment_options NOT IN ('pickup_only', 'pickup_and_delivery')) OR
       (p_fulfillment_method = 'vendor_delivery' AND v_vendor.fulfillment_options NOT IN ('vendor_delivery', 'pickup_and_delivery', 'delivery_varies')) THEN
        RAISE EXCEPTION 'Fulfillment option unavailable' USING ERRCODE = '22023';
    END IF;

    PERFORM m.id FROM public.vendor_menu_items m
      JOIN pg_catalog.jsonb_array_elements(p_items) AS entries(item) ON m.id = (entries.item->>'menuItemId')::UUID
     WHERE m.vendor_interest_id = v_vendor_id AND m.available = TRUE ORDER BY m.id FOR SHARE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> jsonb_array_length(p_items) THEN RAISE EXCEPTION 'One or more menu items are no longer available' USING ERRCODE = 'P0002'; END IF;

    SELECT pg_catalog.sum(m.price_ngn * (entries.item->>'quantity')::INTEGER)::NUMERIC(12,2) INTO v_subtotal
      FROM public.vendor_menu_items m
      JOIN pg_catalog.jsonb_array_elements(p_items) AS entries(item) ON m.id = (entries.item->>'menuItemId')::UUID
     WHERE m.vendor_interest_id = v_vendor_id AND m.available = TRUE;
    v_fee := CASE WHEN p_fulfillment_method = 'vendor_delivery' THEN v_vendor.delivery_fee_ngn ELSE NULL END;
    IF p_fulfillment_method = 'vendor_delivery' AND v_fee IS NULL THEN
        RAISE EXCEPTION 'Delivery fee is not configured' USING ERRCODE = '22023';
    END IF;

    v_order_id := gen_random_uuid();
    v_reference := 'WJ-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10));
    INSERT INTO public.customer_orders (
        id, order_reference, customer_user_id, vendor_interest_id, customer_name, customer_phone,
        fulfillment_method, delivery_address, subtotal_ngn, delivery_fee_ngn, total_ngn, status,
        payment_status, is_test_order, idempotency_key
    ) VALUES (
        v_order_id, v_reference, p_customer_user_id, v_vendor_id, pg_catalog.btrim(p_customer_name), p_customer_phone,
        p_fulfillment_method, NULLIF(pg_catalog.btrim(p_delivery_address), ''), v_subtotal,
        v_fee, v_subtotal + COALESCE(v_fee, 0), 'placed', 'test_unpaid', TRUE, p_idempotency_key
    ) ON CONFLICT (customer_user_id, idempotency_key) DO NOTHING;
    IF NOT FOUND THEN
        SELECT * INTO v_existing FROM public.customer_orders o WHERE o.customer_user_id = p_customer_user_id AND o.idempotency_key = p_idempotency_key;
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

CREATE OR REPLACE FUNCTION public.transition_vendor_order(
    p_vendor_user_id UUID, p_order_id UUID, p_next_status TEXT
)
RETURNS TABLE (id UUID, status TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_order public.customer_orders%ROWTYPE;
    v_now TIMESTAMPTZ := now();
    v_allowed BOOLEAN := FALSE;
BEGIN
    SELECT o.* INTO v_order FROM public.customer_orders o
      JOIN public.vendor_interest v ON v.id = o.vendor_interest_id
     WHERE o.id = p_order_id AND v.user_id = p_vendor_user_id
     FOR UPDATE OF o;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002'; END IF;
    v_allowed := CASE v_order.status
      WHEN 'placed' THEN p_next_status IN ('accepted', 'rejected')
      WHEN 'accepted' THEN p_next_status = 'preparing'
      WHEN 'preparing' THEN (v_order.fulfillment_method = 'pickup' AND p_next_status = 'ready_for_pickup') OR (v_order.fulfillment_method = 'vendor_delivery' AND p_next_status = 'out_for_delivery')
      WHEN 'ready_for_pickup' THEN p_next_status = 'completed'
      WHEN 'out_for_delivery' THEN p_next_status = 'completed'
      ELSE FALSE END;
    IF NOT v_allowed THEN RAISE EXCEPTION 'Invalid order status transition' USING ERRCODE = '22023'; END IF;
    UPDATE public.customer_orders SET status = p_next_status, updated_at = v_now,
      accepted_at = CASE WHEN p_next_status = 'accepted' THEN v_now ELSE accepted_at END,
      rejected_at = CASE WHEN p_next_status = 'rejected' THEN v_now ELSE rejected_at END,
      preparing_at = CASE WHEN p_next_status = 'preparing' THEN v_now ELSE preparing_at END,
      ready_at = CASE WHEN p_next_status = 'ready_for_pickup' THEN v_now ELSE ready_at END,
      out_for_delivery_at = CASE WHEN p_next_status = 'out_for_delivery' THEN v_now ELSE out_for_delivery_at END,
      completed_at = CASE WHEN p_next_status = 'completed' THEN v_now ELSE completed_at END
      WHERE customer_orders.id = p_order_id;
    RETURN QUERY SELECT p_order_id, p_next_status, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_vendor_order(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_vendor_order(UUID, UUID, TEXT) TO service_role;

COMMIT;
