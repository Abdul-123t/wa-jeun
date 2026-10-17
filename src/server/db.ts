import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { redactPii } from './validation';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DbResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isDuplicate?: boolean;
  statusCode?: number;
}

// 1. Supabase Client Initialization (Server-side Only)
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[WA JEUN DB] Supabase persistent client initialized successfully.');
  } catch (err: any) {
    console.error('[WA JEUN DB] Failed to initialize Supabase client:', err.message);
  }
} else {
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[WA JEUN DB WARNING] Production environment detected without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Submissions will be rejected with 503 until persistent credentials are provided.'
    );
  } else {
    console.log('[WA JEUN DB] Running in development mode with local JSON persistence.');
  }
}

export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}

export function getStorageMode(): 'supabase-production' | 'dev-local-json' | 'unconfigured-production' {
  if (supabaseClient) return 'supabase-production';
  if (process.env.NODE_ENV === 'production') return 'unconfigured-production';
  return 'dev-local-json';
}

// 2. Development-Only Local JSON Fallback (Strictly blocked in production)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'interest_records.json');

function ensureDevStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const init = {
      customers: [],
      vendors: [],
      contacts: [],
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.1.0',
        market: 'Ijebu Ode, Ogun State, Nigeria'
      }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2), 'utf-8');
  }
}

function readDevDb() {
  ensureDevStorage();
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return { customers: [], vendors: [], contacts: [] };
  }
}

function writeDevDb(data: any) {
  try {
    ensureDevStorage();
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
    return true;
  } catch (err) {
    console.error('[WA JEUN DB] Failed to write dev storage:', err);
    return false;
  }
}

// 3. Customer Early Access Insert
export async function insertCustomerInterest(record: {
  name: string;
  contact_method: 'phone' | 'email';
  phone?: string | null;
  email?: string | null;
  neighborhood: string;
  favorite_categories: string[];
  consent_accepted: boolean;
}): Promise<DbResult<{ id: string }>> {
  const mode = getStorageMode();

  // In production, refuse to proceed if Supabase is unconfigured
  if (mode === 'unconfigured-production') {
    console.error('[WA JEUN DB SECURITY] Form submission rejected: Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    return {
      success: false,
      statusCode: 503,
      error: 'Service temporarily unavailable. Persistent database configuration is required in production.'
    };
  }

  // Supabase Persistent Route
  if (supabaseClient) {
    try {
      // Direct insertion into public.customer_interest
      const { data, error } = await supabaseClient
        .from('customer_interest')
        .insert({
          name: record.name,
          contact_method: record.contact_method,
          phone: record.phone || null,
          email: record.email || null,
          neighborhood: record.neighborhood,
          favorite_categories: record.favorite_categories,
          consent_accepted: record.consent_accepted
        })
        .select('id')
        .single();

      if (error) {
        // Handle PostgreSQL unique constraint violation (code 23505)
        if (error.code === '23505') {
          return {
            success: false,
            statusCode: 409,
            isDuplicate: true,
            error: 'These contact details have already been registered for the launch list. Thank you for your support!'
          };
        }

        console.error('[WA JEUN DB] Supabase customer insert error:', error.message);
        return {
          success: false,
          statusCode: 500,
          error: 'Could not record your early-access registration. Please try again shortly.'
        };
      }

      console.log(`[WA JEUN DB] Customer interest registered successfully. ID: ${data?.id}`);
      return {
        success: true,
        statusCode: 201,
        data: { id: data.id }
      };
    } catch (err: any) {
      console.error('[WA JEUN DB] Network or unexpected error calling Supabase:', err.message);
      return {
        success: false,
        statusCode: 500,
        error: 'Unable to reach the database. Please check your connection and retry.'
      };
    }
  }

  // Development Only JSON Fallback
  console.log(`[WA JEUN DB DEV ONLY] Storing customer interest locally: ${record.name} (${redactPii(record.phone || record.email)})`);
  const devDb = readDevDb();
  if (!devDb.customers) devDb.customers = [];

  const isDuplicate = devDb.customers.some((c: any) => {
    if (record.phone && c.phone === record.phone) return true;
    if (record.email && c.email === record.email) return true;
    return false;
  });

  if (isDuplicate) {
    return {
      success: false,
      statusCode: 409,
      isDuplicate: true,
      error: 'These contact details have already been registered for the launch list. Thank you for your support!'
    };
  }

  const generatedId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  devDb.customers.push({
    id: generatedId,
    ...record,
    created_at: new Date().toISOString()
  });

  if (!writeDevDb(devDb)) {
    return {
      success: false,
      statusCode: 500,
      error: 'Internal storage error. Please retry.'
    };
  }

  return {
    success: true,
    statusCode: 201,
    data: { id: generatedId }
  };
}

// 4. Food Business Onboarding Insert
export async function insertVendorInterest(record: {
  business_name: string;
  contact_name: string;
  phone: string;
  email?: string | null;
  neighborhood: string;
  business_type: string;
  current_ordering_methods: string[];
  fulfillment_options: string;
  message?: string | null;
  consent_accepted: boolean;
}): Promise<DbResult<{ id: string }>> {
  const mode = getStorageMode();

  if (mode === 'unconfigured-production') {
    console.error('[WA JEUN DB SECURITY] Vendor submission rejected: Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    return {
      success: false,
      statusCode: 503,
      error: 'Service temporarily unavailable. Persistent database configuration is required in production.'
    };
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('vendor_interest')
        .insert({
          business_name: record.business_name,
          contact_name: record.contact_name,
          phone: record.phone,
          email: record.email || null,
          neighborhood: record.neighborhood,
          business_type: record.business_type,
          current_ordering_methods: record.current_ordering_methods,
          fulfillment_options: record.fulfillment_options,
          message: record.message || null,
          consent_accepted: record.consent_accepted,
          status: 'pending_review' // Explicitly classified as interest, never auto-approved
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return {
            success: false,
            statusCode: 409,
            isDuplicate: true,
            error: 'An onboarding interest application has already been submitted for this business. Our team will reach out to you shortly!'
          };
        }

        console.error('[WA JEUN DB] Supabase vendor insert error:', error.message);
        return {
          success: false,
          statusCode: 500,
          error: 'Could not record food business interest. Please try again shortly.'
        };
      }

      console.log(`[WA JEUN DB] Food business interest registered successfully. ID: ${data?.id}`);
      return {
        success: true,
        statusCode: 201,
        data: { id: data.id }
      };
    } catch (err: any) {
      console.error('[WA JEUN DB] Network error calling Supabase for vendor interest:', err.message);
      return {
        success: false,
        statusCode: 500,
        error: 'Unable to reach the database. Please check your connection and retry.'
      };
    }
  }

  // Dev fallback
  console.log(`[WA JEUN DB DEV ONLY] Storing vendor interest locally: ${record.business_name}`);
  const devDb = readDevDb();
  if (!devDb.vendors) devDb.vendors = [];

  const isDuplicate = devDb.vendors.some((v: any) => {
    return v.phone === record.phone && v.business_name.toLowerCase() === record.business_name.toLowerCase();
  });

  if (isDuplicate) {
    return {
      success: false,
      statusCode: 409,
      isDuplicate: true,
      error: 'An onboarding interest application has already been submitted for this business. Our team will reach out to you shortly!'
    };
  }

  const generatedId = `vnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  devDb.vendors.push({
    id: generatedId,
    ...record,
    status: 'pending_review',
    created_at: new Date().toISOString()
  });

  if (!writeDevDb(devDb)) {
    return {
      success: false,
      statusCode: 500,
      error: 'Internal storage error. Please retry.'
    };
  }

  return {
    success: true,
    statusCode: 201,
    data: { id: generatedId }
  };
}

// 5. Contact Inquiries Insert
export async function insertContactInquiry(record: {
  name: string;
  contact_info: string;
  subject: string;
  message: string;
}): Promise<DbResult<{ id: string }>> {
  const mode = getStorageMode();

  if (mode === 'unconfigured-production') {
    return {
      success: false,
      statusCode: 503,
      error: 'Service temporarily unavailable. Persistent database configuration is required in production.'
    };
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('contact_inquiries')
        .insert({
          name: record.name,
          contact_info: record.contact_info,
          subject: record.subject,
          message: record.message
        })
        .select('id')
        .single();

      if (error) {
        console.error('[WA JEUN DB] Supabase contact insert error:', error.message);
        return {
          success: false,
          statusCode: 500,
          error: 'Could not deliver your inquiry. Please try again shortly.'
        };
      }

      return {
        success: true,
        statusCode: 201,
        data: { id: data.id }
      };
    } catch (err: any) {
      console.error('[WA JEUN DB] Network error calling Supabase for contact:', err.message);
      return {
        success: false,
        statusCode: 500,
        error: 'Unable to reach the database. Please try again.'
      };
    }
  }

  // Dev fallback
  const devDb = readDevDb();
  if (!devDb.contacts) devDb.contacts = [];
  const generatedId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  devDb.contacts.push({
    id: generatedId,
    ...record,
    created_at: new Date().toISOString()
  });
  writeDevDb(devDb);

  return {
    success: true,
    statusCode: 201,
    data: { id: generatedId }
  };
}

// 6. Verified Food Businesses Query (Truthful: only returns APPROVED vendors)
export async function getVerifiedVendors(filters: {
  category?: string;
  search?: string;
}): Promise<{ vendors: any[]; total: number }> {
  // If Supabase is connected, query only status === 'approved'
  if (supabaseClient) {
    try {
      let query = supabaseClient
        .from('vendor_interest')
        .select('id, business_name, neighborhood, business_type, fulfillment_options, message')
        .eq('status', 'approved');

      if (filters.category) {
        query = query.eq('business_type', filters.category);
      }
      if (filters.search) {
        query = query.ilike('business_name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[WA JEUN DB] Error fetching verified vendors:', error.message);
        return { vendors: [], total: 0 };
      }

      return {
        vendors: data || [],
        total: data ? data.length : 0
      };
    } catch (err) {
      return { vendors: [], total: 0 };
    }
  }

  // Dev mode: check local db for any approved vendors (default none)
  const devDb = readDevDb();
  const approved = (devDb.vendors || []).filter((v: any) => v.status === 'approved');
  return {
    vendors: approved,
    total: approved.length
  };
}

// 7. Health Statistics Query (Never exposes PII or private lists)
export async function getHealthStats(): Promise<{
  status: string;
  storageMode: string;
  registeredCustomers: number;
  registeredVendors: number;
}> {
  const mode = getStorageMode();

  if (supabaseClient) {
    try {
      const [custCount, vendCount] = await Promise.all([
        supabaseClient.from('customer_interest').select('id', { count: 'exact', head: true }),
        supabaseClient.from('vendor_interest').select('id', { count: 'exact', head: true })
      ]);

      return {
        status: 'online',
        storageMode: 'supabase-production',
        registeredCustomers: custCount.count || 0,
        registeredVendors: vendCount.count || 0
      };
    } catch (err) {
      return {
        status: 'degraded',
        storageMode: 'supabase-error',
        registeredCustomers: 0,
        registeredVendors: 0
      };
    }
  }

  const devDb = readDevDb();
  return {
    status: mode === 'unconfigured-production' ? 'configuration-required' : 'online',
    storageMode: mode,
    registeredCustomers: (devDb.customers || []).length,
    registeredVendors: (devDb.vendors || []).length
  };
}
