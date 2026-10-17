# WA JEUN — Supabase Production Persistence & Security Guide

**Market:** Ijebu Ode, Ogun State, Nigeria  
**Platform Stage:** Pre-Launch Food Discovery & Ordering Marketplace  
**Core Standard:** Uncompromising truthfulness; zero manufactured traction or fake reviews.

---

## 1. Overview & Security Architecture

WA JEUN uses Supabase (PostgreSQL) for persistent production data storage. The integration guarantees:
1. **Durable Persistence:** Submissions are stored directly in PostgreSQL tables (`customer_interest`, `vendor_interest`, `contact_inquiries`).
2. **Server-Side Security:** Supabase operations use `SUPABASE_SECRET_KEY` exclusively on the Node.js/Express backend (`server.ts` & `src/server/db.ts`). `SUPABASE_SERVICE_ROLE_KEY` is accepted only as a legacy fallback. Neither secret is bundled into the client application, returned by APIs, or printed in logs.
3. **Data Privacy (Zero-Leak Policy):** Row-Level Security (RLS) is enabled on private tables, with direct table privileges revoked from anonymous and authenticated clients where appropriate. Public vendor storefronts are returned only through `/api/vendors` and public menu routes, which use explicit public-field allowlists and exclude private application and account fields.
4. **Environment Separation:** 
   - **Production:** If Supabase credentials are missing or disconnected, the backend refuses to falsely claim success and responds with HTTP `503 Service Unavailable`.
   - **Development:** When running in local development mode (`NODE_ENV !== 'production'`) without credentials, atomic local JSON storage in `./data/interest_records.json` is used for testing, clearly tagged in server logs as `[DEV ONLY]`.

---

## 2. Supabase Setup Instructions

### Step 1: Create a Supabase Project
1. Go to [database.new](https://database.new) and create a new project.
2. Choose a project name (e.g. `wajeun-production`) and a strong database password.
3. Select your preferred AWS/GCP region.

### Step 2: Apply the Database Schema
1. In the Supabase Dashboard, open the **SQL Editor** from the left navigation.
2. Open `docs/database_schema.sql` from this repository.
3. Copy the entire contents of `docs/database_schema.sql` into the SQL editor and click **Run**.
4. Verify that the following 3 tables were created under `public`:
   - `customer_interest`
   - `vendor_interest`
   - `contact_inquiries`
5. Verify that RLS (Row Level Security) is marked **Enabled** for all 3 tables in the Table Editor.

### Step 3: Retrieve API Credentials
1. In the Supabase Dashboard, navigate to **Project Settings** > **API**.
2. Locate the following values:
   - **Project URL:** e.g., `https://xyzcompany.supabase.co`
   - **Secret key:** Copy the project secret key for server-side use.
3. **CRITICAL SECURITY NOTE:** Never share or commit the secret key. It is intended only for trusted backend servers and must never use a `VITE_` prefix.

---

## 3. Environment Variables Configuration

In your deployment hosting environment (e.g. Cloud Run, Vercel, Railway, Render, or local `.env`):

```bash
# Server Port
PORT=3000

# Node Environment
NODE_ENV=production

# Supabase Production Database Secrets (SERVER-SIDE ONLY)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SECRET_KEY=your_server_secret_key_here

# Supabase browser authentication (publishable key only)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here

# App URL
APP_URL=https://wajeun.ng
```

---

## 4. Authentication Foundation (Manual Setup)

The first authentication milestone uses Supabase email/password Auth. Before enabling the account UI:

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the frontend. The publishable key is browser-safe; never put `SUPABASE_SECRET_KEY` or the legacy service role key in a `VITE_` variable.
2. Enable the Email provider in Supabase Authentication settings. Choose whether email confirmation is required; the UI handles both a returned session and a confirmation-required signup.
3. Set the Supabase Site URL and allowlist the exact local and production redirect URLs used by the app. Signup returns to `/account`; password recovery returns to `/auth?mode=recovery`.
4. Configure email delivery and templates appropriate for the environment. This repository does not claim that confirmation email delivery is configured.
5. After the base schema exists, review and manually apply `docs/migrations/20261017_authentication_foundation.sql`. It creates owner-scoped profiles and adds nullable ownership to vendor applications. Anonymous vendor interest remains supported; only applications submitted while signed in are linked to that account.

The `/account` page is protected in the client and its vendor application endpoint verifies the Supabase access token server-side. RLS also restricts authenticated direct reads to the matching `auth.uid()`.

### Super Admin vendor review (manual setup)

1. Review and apply `docs/migrations/20261017_super_admin_vendor_review.sql` only after the base schema and authentication foundation migration. It adds the private admin membership and review audit tables, the `under_review` status, and a database function that updates status and writes the audit event in one transaction.
2. Create the first administrator as an ordinary user through the existing `/auth` flow. Do not add a role through browser metadata.
3. In the Supabase Dashboard, open **Authentication > Users** and copy that account's UUID. In **Table Editor > admin_users**, insert a row with that UUID in `user_id`. This table has RLS enabled and no client-facing policies; only a trusted project owner should provision membership in the dashboard.
4. Sign out and back in, then visit `/admin`. Every admin API request revalidates the Supabase access token and checks `admin_users`; manually navigating to the page does not grant access.

The review workflow maps **Request more information** to existing `contacted`, **Decline** to existing `declined`, **Approve** to `approved`, and **Mark under review** to the migration's new `under_review`. Rejection and information-request actions require a reason. Each review is atomically recorded in `vendor_review_audit`. A member cannot review an application linked to their own account. No additional environment variables are required.

### Vendor dashboard, storefront, menu, and image bucket (manual setup)

After the base schema, authentication foundation, and Super Admin review migrations have been applied, inspect and manually apply `docs/migrations/20261018_vendor_dashboard_menu.sql`.

**Before applying it, run these read-only preflight queries in the intended Supabase project:**

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'vendor-menu-images';

SELECT name, metadata ->> 'mimetype' AS mime_type, created_at
FROM storage.objects
WHERE bucket_id = 'vendor-menu-images'
ORDER BY created_at;
```

The bucket query must return no row for this migration to proceed. The migration checks for an existing `vendor-menu-images` bucket before changing schema, then creates it with public reads and a 5 MiB JPEG/PNG/WebP allowlist. If a bucket with that ID exists, the migration raises an exception and its explicit transaction rolls back all migration changes. **Do not make an existing bucket public or assume its objects are food photos.** Manually inventory and review every object, including its purpose and sensitivity. If the ID is already in use, choose a new unused bucket ID and coordinate that ID across the migration, server upload code, URL validation, and this guide before applying; do not alter or reuse the existing bucket to bypass the check.

The bucket is public so customers can display uploaded menu photos. The app has no public client-upload policy: uploads go through the server, which verifies the Supabase session, business ownership, approved status, MIME type, and image-byte signature before using the server-only Supabase key. Keep CAC documents and all other private files in a separate private storage bucket; never upload them to `vendor-menu-images`.

The migration adds storefront description, opening hours, and accepting-orders fields, adds `suspended` to the application status constraint, and creates `vendor_menu_items` with RLS enabled and direct `anon`/`authenticated` privileges revoked. Vendor menu reads and writes are performed by the server after it derives and checks the owner from the verified Supabase user. Review the migration as SQL before execution; it is not run by the application.

---

## 5. Database Table Specifications

### A. `public.customer_interest`
Stores early access expressions from residents in Ijebu Ode.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `DEFAULT gen_random_uuid()` |
| `name` | `VARCHAR(150)` | Customer's full name (min 2 chars) |
| `contact_method` | `VARCHAR(20)` | `'phone'` or `'email'` |
| `phone` | `VARCHAR(30)` | Normalized E.164 phone number (`+234...`), unique where not null |
| `email` | `VARCHAR(255)` | Normalized lowercase email, unique where not null |
| `neighborhood` | `VARCHAR(150)` | Area in Ijebu Ode (e.g. Molipa, Igbeba, Folagbade) |
| `favorite_categories`| `TEXT[]` | Optional list of favorite food categories |
| `consent_accepted` | `BOOLEAN` | Must be `TRUE` |
| `created_at` | `TIMESTAMPTZ` | Automated UTC timestamp |

### B. `public.vendor_interest`
Stores onboarding interest applications from local food businesses.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `DEFAULT gen_random_uuid()` |
| `business_name` | `VARCHAR(200)` | Name of the restaurant, buka, or caterer |
| `contact_name` | `VARCHAR(150)` | Name of owner or primary manager |
| `phone` | `VARCHAR(30)` | Normalized phone/WhatsApp number |
| `email` | `VARCHAR(255)` | Optional contact email |
| `neighborhood` | `VARCHAR(150)` | Business location in Ijebu Ode |
| `business_type` | `VARCHAR(50)` | Category (`restaurant`, `local_buka`, `fast_food`, etc.) |
| `current_ordering_methods`| `TEXT[]` | Channels used (`walk_in`, `whatsapp`, etc.) |
| `fulfillment_options` | `VARCHAR(50)` | Capability (`pickup_only`, `vendor_delivery`, etc.) |
| `message` | `TEXT` | Optional signature dishes or business details |
| `consent_accepted` | `BOOLEAN` | Must be `TRUE` |
| `status` | `VARCHAR(30)` | Defaults to `'pending_review'`. **Never auto-approved.** |
| `created_at` | `TIMESTAMPTZ` | Automated UTC timestamp |

### C. `public.contact_inquiries`
Stores general questions, press inquiries, and privacy requests.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `DEFAULT gen_random_uuid()` |
| `name` | `VARCHAR(150)` | Sender's name |
| `contact_info` | `VARCHAR(255)` | Sender's phone or email |
| `subject` | `VARCHAR(200)` | Inquiry topic |
| `message` | `TEXT` | Message body (min 10 chars) |
| `created_at` | `TIMESTAMPTZ` | Automated UTC timestamp |

---

## 6. Security Controls & Abuse Prevention

1. **Strict Input Sanitization & Normalization:**
   - Phone numbers are normalized to E.164 (`+234803...`).
   - Emails are trimmed and lowercased.
   - Text inputs are bounded by max length constraints.
2. **Database Level Duplicate Prevention:**
   - PostgreSQL unique indexes (`idx_customer_phone`, `idx_customer_email`, `idx_vendor_unique_business`) enforce concurrency safety.
   - Race conditions or simultaneous duplicate requests are safely caught via Postgres code `23505` and returned as clean `409 Conflict` errors.
3. **Rate Limiting:**
   - In-memory sliding window rate limiter protects endpoints against spam (15 requests per 10 minutes per IP).
4. **PII Masking:**
   - Server logs never print raw phone numbers or emails (`redactPii` utility masks personal identifiers).
5. **No Public Discovery Leaks:**
   - `/api/vendors` and `/api/vendors/:businessId/menu` return only businesses that are approved, have a non-empty description and valid opening hours, have at least one available menu item, and have enabled accepting orders. Public vendor fields are `id`, `business_name`, `neighborhood`, `business_type`, `fulfillment_options`, `description`, and `opening_hours`. The `menu` array includes only available items and returns `id`, `name`, `description`, `price_ngn`, `category`, and `image_url`. Private contact details, account IDs, review history, application messages, and verification documents are not returned.

---

## 7. How to Verify Persistence

1. **Verify Backend Health:**
   ```bash
   curl -s http://localhost:3000/api/health
   ```
   Confirm that `storageMode` is `'supabase-production'` when credentials are set, or `'dev-local-json'` in development.
2. **Submit a Customer Registration:**
   Fill the form at `/customer-register`. Upon submission, check the Supabase Dashboard > Table Editor > `customer_interest` to see the newly inserted row with its database-generated UUID.
3. **Test Duplicate Prevention:**
   Submit the same phone or email again. The backend will return `409` with a friendly duplicate notice.
4. **Verify RLS Security:**
   Attempt to query `https://<your-project>.supabase.co/rest/v1/customer_interest` using the public `anon` key. Supabase will return an empty array `[]` or access denied, confirming that customer data cannot be harvested.
