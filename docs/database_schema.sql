-- ==============================================================================
-- WA JEUN: Production PostgreSQL / Supabase Database Schema
-- Market: Ijebu Ode, Ogun State, Nigeria
-- Application: WA JEUN Food Marketplace
-- ==============================================================================

-- 1. Enable UUID Extension (Supported across PostgreSQL & Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Customer Early Access Registrations Table
-- Stores genuine pre-launch signups from residents of Ijebu Ode.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customer_interest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    contact_method VARCHAR(20) NOT NULL CHECK (contact_method IN ('phone', 'email')),
    phone VARCHAR(30),
    email VARCHAR(255),
    neighborhood VARCHAR(150) NOT NULL,
    favorite_categories TEXT[] DEFAULT '{}',
    consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Ensure phone or email is provided according to preferred contact method
    CONSTRAINT chk_customer_contact CHECK (
        (contact_method = 'phone' AND phone IS NOT NULL AND length(trim(phone)) >= 10) OR
        (contact_method = 'email' AND email IS NOT NULL AND length(trim(email)) >= 5)
    ),
    CONSTRAINT chk_customer_consent CHECK (consent_accepted = TRUE)
);

-- Unique indexes to prevent duplicate signups per phone or email
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_phone 
ON public.customer_interest (phone) 
WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_email 
ON public.customer_interest (email) 
WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_neighborhood 
ON public.customer_interest (neighborhood);

-- ==============================================================================
-- 3. Food Business / Vendor Onboarding Interest Table
-- Stores onboarding applications from local restaurants, bukas, and caterers.
-- Status defaults to 'pending_review'; applicants are NEVER automatically approved.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_interest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    neighborhood VARCHAR(150) NOT NULL,
    business_type VARCHAR(50) NOT NULL CHECK (
        business_type IN (
            'restaurant',
            'local_buka',
            'fast_food',
            'grill_shawarma',
            'bakery_snacks',
            'other'
        )
    ),
    current_ordering_methods TEXT[] DEFAULT '{}',
    fulfillment_options VARCHAR(50) NOT NULL CHECK (
        fulfillment_options IN (
            'pickup_only',
            'vendor_delivery',
            'pickup_and_delivery',
            'delivery_varies'
        )
    ),
    message TEXT,
    consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_review' CHECK (
        status IN ('pending_review', 'contacted', 'approved', 'declined')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT chk_vendor_phone CHECK (length(trim(phone)) >= 10),
    CONSTRAINT chk_vendor_consent CHECK (consent_accepted = TRUE)
);

CREATE INDEX IF NOT EXISTS idx_vendor_business_name ON public.vendor_interest (business_name);
CREATE INDEX IF NOT EXISTS idx_vendor_status ON public.vendor_interest (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_unique_business ON public.vendor_interest (business_name, phone);

-- ==============================================================================
-- 4. General Inquiries & Contact Table
-- Stores user questions and partnership inquiries.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    contact_info VARCHAR(255) NOT NULL,
    subject VARCHAR(200) DEFAULT 'General Inquiry',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. Row Level Security (RLS) - ACCESS CONTROL
-- Critical Security Requirement:
-- - Private customer contacts and business applications must NOT be publicly readable.
-- - The Supabase Data API (anon key) is restricted from selecting any records.
-- - Only trusted server-side code using the service_role key can read/write data.
-- - Public can only view vendors with status = 'approved' (0 at pre-launch).
-- ==============================================================================

ALTER TABLE public.customer_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Customer Interest Policies:
-- Disallow all public anon reads
CREATE POLICY "Disallow public select for customer interest" 
ON public.customer_interest 
FOR SELECT 
TO anon, authenticated
USING (false);

-- Vendor Interest Policies:
-- Public can ONLY view verified, approved vendor listings (status = 'approved')
-- (Zero records match until real onboarding occurs)
CREATE POLICY "Allow public select for approved vendors only" 
ON public.vendor_interest 
FOR SELECT 
TO anon, authenticated
USING (status = 'approved');

-- Disallow public updates/deletes to vendor applications
CREATE POLICY "Disallow public update for vendor interest" 
ON public.vendor_interest 
FOR UPDATE 
TO anon, authenticated
USING (false);

CREATE POLICY "Disallow public delete for vendor interest" 
ON public.vendor_interest 
FOR DELETE 
TO anon, authenticated
USING (false);

-- Contact Inquiries Policies:
-- Disallow public select
CREATE POLICY "Disallow public select for contact inquiries" 
ON public.contact_inquiries 
FOR SELECT 
TO anon, authenticated
USING (false);
