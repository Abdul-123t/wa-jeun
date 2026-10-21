-- Flutterwave Standard TEST MODE payment lifecycle for explicit development
-- test orders only. Review and apply manually after the customer-orders and
-- order-reliability migrations. The application never executes this file.
-- Production order creation and real payments remain disabled.

BEGIN;

-- Replace only the existing payment-state / test-order consistency checks.
DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conname
          FROM pg_catalog.pg_constraint
         WHERE conrelid = 'public.customer_orders'::regclass
           AND contype = 'c'
           AND (pg_catalog.pg_get_constraintdef(oid) LIKE '%payment_status%'
                OR pg_catalog.pg_get_constraintdef(oid) LIKE '%is_test_order%')
    LOOP
        EXECUTE pg_catalog.format('ALTER TABLE public.customer_orders DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;
END;
$$;

ALTER TABLE public.customer_orders
    ADD CONSTRAINT customer_orders_payment_status_check
        CHECK (payment_status IN ('not_configured', 'pending', 'paid', 'failed', 'refunded', 'test_unpaid', 'test_pending', 'test_paid', 'test_failed', 'test_cancelled')),
    ADD CONSTRAINT customer_orders_test_payment_state_check
        CHECK (
            (is_test_order AND payment_status IN ('test_unpaid', 'test_pending', 'test_paid', 'test_failed', 'test_cancelled')
                AND ((payment_status = 'test_unpaid' AND payment_reference IS NULL)
                     OR (payment_status <> 'test_unpaid' AND payment_reference IS NOT NULL)))
            OR (NOT is_test_order AND payment_status NOT IN ('test_unpaid', 'test_pending', 'test_paid', 'test_failed', 'test_cancelled'))
        );

CREATE TABLE public.flutterwave_test_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
    customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    tx_ref TEXT NOT NULL UNIQUE,
    transaction_id TEXT UNIQUE,
    amount_ngn NUMERIC(12,2) NOT NULL CHECK (amount_ngn > 0),
    currency CHAR(3) NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    customer_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('initializing', 'checkout_ready', 'successful', 'failed', 'cancelled', 'mismatched', 'init_failed')),
    checkout_url TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((status = 'checkout_ready' AND checkout_url IS NOT NULL) OR (status <> 'checkout_ready'))
);

CREATE INDEX flutterwave_test_payments_order_created_idx
    ON public.flutterwave_test_payments(order_id, created_at DESC);
CREATE INDEX flutterwave_test_payments_customer_created_idx
    ON public.flutterwave_test_payments(customer_user_id, created_at DESC);

ALTER TABLE public.flutterwave_test_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flutterwave_test_payments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.flutterwave_test_payments TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_flutterwave_test_payment(
    p_order_id UUID,
    p_customer_user_id UUID,
    p_tx_ref TEXT,
    p_customer_email TEXT
)
RETURNS TABLE (tx_ref TEXT, amount_ngn NUMERIC, currency CHAR(3), status TEXT, checkout_url TEXT, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_order public.customer_orders%ROWTYPE;
    v_attempt public.flutterwave_test_payments%ROWTYPE;
BEGIN
    IF p_order_id IS NULL OR p_customer_user_id IS NULL OR p_tx_ref !~ '^WJTEST-[0-9a-fA-F-]{36}$'
       OR p_customer_email IS NULL OR length(pg_catalog.btrim(p_customer_email)) NOT BETWEEN 3 AND 254 THEN
        RAISE EXCEPTION 'Invalid sandbox checkout details' USING ERRCODE = '22023';
    END IF;

    SELECT o.* INTO v_order FROM public.customer_orders o
     WHERE o.id = p_order_id AND o.customer_user_id = p_customer_user_id
     FOR UPDATE;
    IF NOT FOUND OR v_order.is_test_order IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Development test order not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT p.* INTO v_attempt FROM public.flutterwave_test_payments p
     WHERE p.order_id = v_order.id ORDER BY p.created_at DESC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
        IF v_attempt.status = 'checkout_ready' AND v_attempt.expires_at > now() THEN
            RETURN QUERY SELECT v_attempt.tx_ref, v_attempt.amount_ngn, v_attempt.currency, v_attempt.status, v_attempt.checkout_url, FALSE;
            RETURN;
        ELSIF v_attempt.status = 'checkout_ready' THEN
            UPDATE public.flutterwave_test_payments SET status = 'cancelled', updated_at = now() WHERE id = v_attempt.id;
            UPDATE public.customer_orders SET payment_status = 'test_cancelled', updated_at = now()
             WHERE id = v_order.id AND payment_status = 'test_pending' AND payment_reference = v_attempt.tx_ref;
        ELSIF v_attempt.status = 'initializing' AND v_attempt.created_at > now() - INTERVAL '2 minutes' THEN
            RETURN QUERY SELECT v_attempt.tx_ref, v_attempt.amount_ngn, v_attempt.currency, v_attempt.status, v_attempt.checkout_url, FALSE;
            RETURN;
        ELSIF v_attempt.status = 'successful' THEN
            RETURN QUERY SELECT v_attempt.tx_ref, v_attempt.amount_ngn, v_attempt.currency, v_attempt.status, v_attempt.checkout_url, FALSE;
            RETURN;
        ELSIF v_attempt.status = 'initializing' THEN
            UPDATE public.flutterwave_test_payments SET status = 'init_failed', updated_at = now() WHERE id = v_attempt.id;
            UPDATE public.customer_orders SET payment_status = 'test_failed', updated_at = now()
             WHERE id = v_order.id AND payment_status = 'test_pending' AND payment_reference = v_attempt.tx_ref;
        END IF;
    END IF;

    IF v_order.payment_status NOT IN ('test_unpaid', 'test_pending', 'test_failed', 'test_cancelled') THEN
        RAISE EXCEPTION 'Order is not eligible for a sandbox payment' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.flutterwave_test_payments (order_id, customer_user_id, tx_ref, amount_ngn, currency, customer_email, status)
    VALUES (v_order.id, p_customer_user_id, p_tx_ref, v_order.total_ngn, 'NGN', pg_catalog.lower(pg_catalog.btrim(p_customer_email)), 'initializing');
    UPDATE public.customer_orders
       SET payment_status = 'test_pending', payment_reference = p_tx_ref, updated_at = now()
     WHERE id = v_order.id;
    RETURN QUERY SELECT p_tx_ref, v_order.total_ngn, 'NGN'::CHAR(3), 'initializing'::TEXT, NULL::TEXT, TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_flutterwave_test_checkout_url(p_tx_ref TEXT, p_checkout_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_order_id UUID;
BEGIN
    UPDATE public.flutterwave_test_payments
       SET checkout_url = p_checkout_url, status = 'checkout_ready', updated_at = now()
     WHERE tx_ref = p_tx_ref AND status = 'initializing'
       AND p_checkout_url LIKE 'https://checkout.flutterwave.com/%';
    IF NOT FOUND THEN RETURN FALSE; END IF;
    SELECT order_id INTO v_order_id FROM public.flutterwave_test_payments WHERE tx_ref = p_tx_ref;
    UPDATE public.customer_orders SET payment_status = 'test_pending', payment_reference = p_tx_ref, updated_at = now()
     WHERE id = v_order_id AND is_test_order = TRUE;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_flutterwave_test_payment_initialization(p_tx_ref TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_order_id UUID;
BEGIN
    UPDATE public.flutterwave_test_payments SET status = 'init_failed', updated_at = now()
     WHERE tx_ref = p_tx_ref AND status = 'initializing'
     RETURNING order_id INTO v_order_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    UPDATE public.customer_orders SET payment_status = 'test_failed', updated_at = now()
     WHERE id = v_order_id AND is_test_order = TRUE AND payment_status = 'test_pending' AND payment_reference = p_tx_ref;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_flutterwave_test_payment(
    p_tx_ref TEXT,
    p_transaction_id TEXT,
    p_verified_status TEXT,
    p_amount_ngn NUMERIC(12,2),
    p_currency TEXT
)
RETURNS TABLE (processed BOOLEAN, status TEXT, order_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_attempt public.flutterwave_test_payments%ROWTYPE;
    v_order public.customer_orders%ROWTYPE;
    v_next_attempt_status TEXT;
    v_next_order_status TEXT;
BEGIN
    IF p_tx_ref IS NULL OR p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{1,20}$'
       OR p_verified_status IS NULL OR p_verified_status NOT IN ('successful', 'failed', 'cancelled') THEN
        RETURN QUERY SELECT FALSE, 'invalid'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    SELECT p.* INTO v_attempt FROM public.flutterwave_test_payments p WHERE p.tx_ref = p_tx_ref FOR UPDATE;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'not_found'::TEXT, NULL::UUID; RETURN; END IF;
    SELECT o.* INTO v_order FROM public.customer_orders o WHERE o.id = v_attempt.order_id FOR UPDATE;
    IF v_order.is_test_order IS DISTINCT FROM TRUE THEN RETURN QUERY SELECT FALSE, 'not_test_order'::TEXT, v_order.id; RETURN; END IF;

    IF v_attempt.status = 'successful' THEN
        RETURN QUERY SELECT (v_attempt.transaction_id = p_transaction_id), 'successful'::TEXT, v_order.id;
        RETURN;
    END IF;
    IF v_attempt.status NOT IN ('initializing', 'checkout_ready') THEN
        RETURN QUERY SELECT FALSE, v_attempt.status, v_order.id;
        RETURN;
    END IF;
    IF EXISTS (SELECT 1 FROM public.flutterwave_test_payments p WHERE p.transaction_id = p_transaction_id AND p.tx_ref <> p_tx_ref) THEN
        RETURN QUERY SELECT FALSE, 'transaction_already_used'::TEXT, v_order.id;
        RETURN;
    END IF;

    IF p_verified_status = 'successful' AND (p_currency IS DISTINCT FROM 'NGN' OR p_currency IS DISTINCT FROM v_attempt.currency OR p_amount_ngn IS DISTINCT FROM v_attempt.amount_ngn OR v_order.payment_reference IS DISTINCT FROM p_tx_ref OR v_order.payment_status <> 'test_pending') THEN
        UPDATE public.flutterwave_test_payments SET status = 'mismatched', transaction_id = p_transaction_id, updated_at = now() WHERE id = v_attempt.id;
        UPDATE public.customer_orders SET payment_status = 'test_failed', updated_at = now() WHERE id = v_order.id AND payment_status = 'test_pending' AND payment_reference = p_tx_ref;
        RETURN QUERY SELECT FALSE, 'mismatched'::TEXT, v_order.id;
        RETURN;
    END IF;

    v_next_attempt_status := p_verified_status;
    v_next_order_status := CASE p_verified_status WHEN 'successful' THEN 'test_paid' WHEN 'cancelled' THEN 'test_cancelled' ELSE 'test_failed' END;
    UPDATE public.flutterwave_test_payments SET status = v_next_attempt_status, transaction_id = p_transaction_id, updated_at = now() WHERE id = v_attempt.id;
    UPDATE public.customer_orders SET payment_status = v_next_order_status, payment_reference = p_tx_ref, updated_at = now()
     WHERE id = v_order.id AND payment_status = 'test_pending' AND payment_reference = p_tx_ref;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'order_state_changed'::TEXT, v_order.id; RETURN; END IF;
    RETURN QUERY SELECT TRUE, v_next_attempt_status, v_order.id;
END;
$$;

-- The server uses these RPCs with its service-role client only.
REVOKE ALL ON FUNCTION public.prepare_flutterwave_test_payment(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_flutterwave_test_checkout_url(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_flutterwave_test_payment_initialization(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_flutterwave_test_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_flutterwave_test_payment(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_flutterwave_test_checkout_url(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_flutterwave_test_payment_initialization(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_flutterwave_test_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

-- Vendor workflow must never advance an order until payment is confirmed.
CREATE OR REPLACE FUNCTION public.transition_vendor_order(
    p_vendor_user_id UUID,
    p_order_id UUID,
    p_next_status TEXT
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
    IF v_order.payment_status NOT IN ('paid', 'test_paid') THEN
        RAISE EXCEPTION 'Order payment is not confirmed' USING ERRCODE = 'PZ003';
    END IF;
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

REVOKE ALL ON FUNCTION public.transition_vendor_order(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_vendor_order(UUID, UUID, TEXT) TO service_role;

COMMIT;
