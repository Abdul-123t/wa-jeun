# WA JEUN — Supabase Production Persistence & Security Guide

**Market:** Ijebu Ode, Ogun State, Nigeria  
**Platform Stage:** Pre-Launch Food Discovery & Ordering Marketplace  
**Core Standard:** Uncompromising truthfulness; zero manufactured traction or fake reviews.

---

## 1. Overview & Security Architecture

WA JEUN uses Supabase (PostgreSQL) for persistent production data storage. The integration guarantees:
1. **Durable Persistence:** Submissions are stored directly in PostgreSQL tables (`customer_interest`, `vendor_interest`, `contact_inquiries`).
2. **Server-Side Security:** Supabase operations use `SUPABASE_SERVICE_ROLE_KEY` exclusively on the Node.js/Express backend (`server.ts` & `src/server/db.ts`). The key is **never bundled** into the client application, network responses, or public logs.
3. **Data Privacy (Zero-Leak Policy):** Row-Level Security (RLS) is enabled on all tables. Anonymous or unauthorized clients querying the Supabase Data API cannot read any customer or applicant records.
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
   - **service_role secret (secret):** Click *Reveal* to copy this privileged key.
3. **CRITICAL SECURITY NOTE:** Never share the `service_role` key or commit it to Git. It bypasses RLS and is intended only for trusted backend servers.

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
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key_here

# App URL
APP_URL=https://wajeun.ng
```

---

## 4. Database Table Specifications

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

## 5. Security Controls & Abuse Prevention

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
   - The `/api/vendors` endpoint strictly queries vendors with `status = 'approved'`. At pre-launch, this correctly and truthfully yields `0` records.

---

## 6. How to Verify Persistence

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
