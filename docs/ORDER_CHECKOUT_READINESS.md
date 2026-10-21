# Order checkout readiness

Production order submission and real payments are intentionally disabled. The production order API remains a `503` safety guard. A Flutterwave Standard TEST MODE path is available only to an authenticated customer in a local `NODE_ENV=development` server with test credentials and the reviewed test-payment migration applied.

## Decisions required

- Payment provider and account ownership (for example, a platform merchant account or vendor-owned accounts).
- Whether customers pay in the app or pay vendors directly at pickup or delivery.
- Settlement timing, fees, refunds, chargebacks, failed payments, and reconciliation ownership.
- Whether orders may be placed when a store is closed and how long a vendor has to accept.
- Delivery coverage, vendor delivery pricing, and what happens when the address is outside coverage.
- Customer and vendor cancellation, rejection, and refund rules.
- Customer communications and order support responsibilities.

Do not change a production order to `paid` without verified provider evidence and a trusted webhook or equivalent server-side verification flow. The sandbox path verifies successful transactions on the server and records only `test_paid`; it does not enable live collection, settlement, refunds, chargebacks, or rider dispatch.

## Development test path

`POST /api/customer/orders` is authenticated and guarded by `isDevelopment`. Its server parses the cart and customer details, checks current menu prices and vendor eligibility, and calls the service-role-only `create_customer_order` RPC. That function explicitly rejects any `p_is_test_order` value other than `TRUE`; it locks vendor/menu rows, calculates the subtotal and delivery fee from database values, snapshots the order lines, and sets `is_test_order = true` and `payment_status = 'test_unpaid'`. Production cannot call this endpoint.

The additional `POST /api/customer/orders/flutterwave-test` route is also authenticated and local-development-only. It calls that same test-only order function, then creates a unique server-generated `WJTEST-...` transaction reference and saves a payment attempt before requesting a Flutterwave Standard hosted checkout URL. The amount comes from the saved order. The callback and webhook both fetch the transaction from Flutterwave using the server-only secret key and compare its reference, final status, NGN currency, and exact amount to the saved attempt. A database function locks the payment and order rows and idempotently records `test_paid`, `test_failed`, or `test_cancelled`. A payment status guard prevents vendor order transitions until payment is confirmed. All such orders remain test orders; the production API and production vendor views continue to reject/exclude them.

No menu items or currently order-accepting vendors are confirmed, so there is no real cart to submit today. Do not create sample vendors or menu items to exercise this flow.

The application never runs SQL migrations automatically. The reviewed sandbox-payment migration is `docs/migrations/20261021_flutterwave_test_payments.sql`; it has not been executed. It requires the existing customer order tables, the fingerprint-aware `create_customer_order` RPC, and the `transition_vendor_order` RPC. Do not apply it to production.

## Local reliability follow-up (not applied)

`docs/migrations/20261020_order_reliability.sql` adds request fingerprints to customer-scoped idempotency keys, replaces the server-only checkout RPC signature, checks quotes and Lagos opening hours inside the transaction while vendor and menu rows are locked, and disables the old RPC signature. Existing orders have no fingerprint; retrying one of those legacy keys is rejected safely and should be checked in order history.

## Manual migration order and sandbox configuration

For an isolated development Supabase project, verify that its history includes these prerequisites in order:

1. `20261017_authentication_foundation.sql` for authenticated owner relationships.
2. `20261017_super_admin_vendor_review.sql` before the vendor dashboard/menu migration, as required by that migration's documented setup.
3. `20261018_vendor_dashboard_menu.sql` for `vendor_menu_items` and the storefront fields referenced by order creation.
4. `20261019_customer_orders.sql` for `customer_orders`, `customer_order_items`, their RLS, and the original test-only RPC.
5. `20261020_ijagun_market_area.sql` for the `market_area`, address, and delivery-coverage columns selected by the current order service.
6. `20261020_order_reliability.sql` for the exact fingerprint-aware RPC signature required by the current server.
7. Review `20261021_flutterwave_test_payments.sql`, then apply it manually only to the isolated development project after confirming the project reference in the dashboard.

The new migration widens the test-order payment-state constraints, adds a private `flutterwave_test_payments` table with transaction-reference and provider-transaction uniqueness, and creates service-role-only RPCs to prepare an attempt, save its hosted link, mark initialization failure, and atomically process verified results. It replaces `transition_vendor_order` so unpaid, pending, failed, cancelled, or mismatched orders cannot advance. RLS is enabled with no browser policies. The migration is a one-time manual migration and is not safe to rerun as-is; review the target schema and migration history first. No SQL in this repository task has been executed.

Set these **server-only** variables in a local `.env` file; keep them out of `VITE_` variables and source control:

- `FLW_MODE=test`
- `FLW_SECRET_KEY` — Flutterwave test secret key only (expected `FLWSECK_TEST-` prefix)
- `FLW_SECRET_HASH` — random webhook secret hash configured in Flutterwave's test dashboard
- `APP_URL` — the callback base URL. Flutterwave cannot reach `localhost`; for callback/webhook testing use a temporary HTTPS tunnel to the local development server, and set this to that tunnel URL.

Configure Flutterwave Standard callback as `${APP_URL}/api/payments/flutterwave/callback` and the test webhook as `${APP_URL}/api/payments/flutterwave/webhook`. For the v3 endpoint used by Standard, webhook verification checks Flutterwave's `verif-hash` header using constant-time comparison. The server independently verifies every transaction with the transaction verification API. The sandbox endpoint refuses requests outside local development even if test credentials are present; never provide live keys or add a production-mode switch.

The project has no automated schema migration history table; record the migration filename and application date in the team's approved change log after a human applies it. The manual database change, Flutterwave dashboard webhook setup, and any public tunnel setup all require an authorized operator. Production checkout remains disabled regardless of migration state.
