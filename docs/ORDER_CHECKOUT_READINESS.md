# Order checkout readiness

Production order submission is intentionally disabled. The order API returns a service-unavailable response until the product and operations decisions below are approved and the server and database are updated together.

## Decisions required

- Payment provider and account ownership (for example, a platform merchant account or vendor-owned accounts).
- Whether customers pay in the app or pay vendors directly at pickup or delivery.
- Settlement timing, fees, refunds, chargebacks, failed payments, and reconciliation ownership.
- Whether orders may be placed when a store is closed and how long a vendor has to accept.
- Delivery coverage, vendor delivery pricing, and what happens when the address is outside coverage.
- Customer and vendor cancellation, rejection, and refund rules.
- Customer communications and order support responsibilities.

Do not change payment status to `paid` without verified provider evidence and a trusted webhook or equivalent server-side verification flow. The current code has no payment method, settlement, cancellation/refund, or rider dispatch integration.

## Development test path

Only when `NODE_ENV=development` may an authenticated customer explicitly submit a development test order. The `npm run dev` script sets this mode. The server still validates current vendor eligibility, live item availability, quantities, fulfillment, delivery fee, and prices. A database transaction snapshots the order and items. The order is marked `is_test_order = true` and `payment_status = 'test_unpaid'`; the customer and vendor views label it as a test. It is not payment evidence and must not be fulfilled as a real-world customer order.

Apply `docs/migrations/20261019_customer_orders.sql` manually to the intended development database before using this path. Review the migration and confirm the Supabase project first. The application never runs SQL migrations automatically.
