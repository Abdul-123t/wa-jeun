import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { redactPii } from './validation';
import { verifyAccessToken } from './authTokens';
import { randomUUID } from 'crypto';
import { isVendorSellEligible, isVendorOwner, canManageMenu, isTrustedMenuImageUrl, type OpeningHours } from './vendorRules';
import { resolveAvailableOrderItems, type CheckoutLine, type FulfillmentMethod } from './orderRules';
import { getPublicStoreAvailability } from '../services/storeHours';
import { isProductionRuntime } from './runtimeMode';
import { MARKET_AREAS, isMarketAreaId } from '../data/marketAreas';

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
export function resolveSupabaseCredentials(env: NodeJS.ProcessEnv = process.env) {
  return {
    url: env.SUPABASE_URL?.trim() || '',
    secretKey: env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''
  };
}

const { url: supabaseUrl, secretKey: supabaseSecretKey } = resolveSupabaseCredentials();

let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseSecretKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[WA JEUN DB] Supabase persistent client initialized successfully.');
  } catch (err: any) {
    // Do not print configuration values or raw client initialization errors.
    console.error('[WA JEUN DB] Failed to initialize Supabase client. Check server-side Supabase configuration.');
  }
} else {
  if (isProductionRuntime()) {
    console.warn(
      '[WA JEUN DB WARNING] Production environment detected without SUPABASE_URL and SUPABASE_SECRET_KEY. Submissions will be rejected with 503 until persistent credentials are provided.'
    );
  } else {
    console.log('[WA JEUN DB] Running in development mode with local JSON persistence.');
  }
}

export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<DbResult<{ userId: string }>> {
  if (!supabaseClient) {
    return { success: false, statusCode: 503, error: 'Authentication service is unavailable.' };
  }
  const result = await verifyAccessToken(supabaseClient, accessToken);
  if (!result.userId) {
    return {
      success: false,
      statusCode: result.statusCode || 401,
      error: result.statusCode === 503 ? 'Authentication service is unavailable.' : 'Your session is invalid or expired.'
    };
  }
  return { success: true, data: { userId: result.userId } };
}

export function getStorageMode(): 'supabase-production' | 'dev-local-json' | 'unconfigured-production' {
  if (supabaseClient) return 'supabase-production';
  if (isProductionRuntime()) return 'unconfigured-production';
  return 'dev-local-json';
}

// 2. Development-Only Local JSON Fallback (Strictly blocked in production)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = process.env.WAJEUN_TEST_DATA_FILE || path.join(DATA_DIR, 'interest_records.json');

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

function readDevDbStrict() {
  ensureDevStorage();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
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
  market_area?: string;
  favorite_categories: string[];
  consent_accepted: boolean;
}): Promise<DbResult<{ id: string }>> {
  const mode = getStorageMode();

  // In production, refuse to proceed if Supabase is unconfigured
  if (mode === 'unconfigured-production') {
    console.error('[WA JEUN DB SECURITY] Form submission rejected: Production requires SUPABASE_URL and SUPABASE_SECRET_KEY.');
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
          market_area: record.market_area || 'ijebu-ode',
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
  market_area?: string;
  street_address?: string;
  nearby_landmark?: string;
  delivery_coverage?: string[];
  business_type: string;
  current_ordering_methods: string[];
  fulfillment_options: string;
  message?: string | null;
  consent_accepted: boolean;
}, ownerUserId?: string | null): Promise<DbResult<{ id: string }>> {
  const mode = getStorageMode();

  if (mode === 'unconfigured-production') {
    console.error('[WA JEUN DB SECURITY] Vendor submission rejected: Production requires SUPABASE_URL and SUPABASE_SECRET_KEY.');
    return {
      success: false,
      statusCode: 503,
      error: 'Service temporarily unavailable. Persistent database configuration is required in production.'
    };
  }

  if (supabaseClient) {
    try {
      const vendorRecord = {
        business_name: record.business_name,
        contact_name: record.contact_name,
        phone: record.phone,
        email: record.email || null,
        neighborhood: record.neighborhood,
        market_area: record.market_area || 'ijebu-ode',
        street_address: record.street_address || null,
        nearby_landmark: record.nearby_landmark || null,
        delivery_coverage: record.delivery_coverage || [],
        business_type: record.business_type,
        current_ordering_methods: record.current_ordering_methods,
        fulfillment_options: record.fulfillment_options,
        message: record.message || null,
        consent_accepted: record.consent_accepted,
        status: 'pending_review', // Explicitly classified as interest, never auto-approved
        ...(ownerUserId ? { user_id: ownerUserId } : {})
      };

      const { data, error } = await supabaseClient
        .from('vendor_interest')
        .insert(vendorRecord)
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
export type PublicVendor = {
  id: string;
  business_name: string;
  market_area: string;
  neighborhood: string;
  street_address: string | null;
  nearby_landmark: string | null;
  delivery_coverage: string[];
  business_type: string;
  fulfillment_options: string;
  delivery_fee_ngn: number | null;
  description: string;
  opening_hours: OpeningHours;
  accepting_orders: boolean;
  menu: Array<Pick<VendorMenuItem, 'id' | 'name' | 'description' | 'price_ngn' | 'category' | 'image_url' | 'available'>>;
};

export async function getVendorApplicationsForUser(userId: string): Promise<DbResult<Array<{
  id: string;
  business_name: string;
  neighborhood: string;
  business_type: string;
  status: string;
  created_at: string;
  review_reason: string | null;
}>>> {
  if (!supabaseClient) {
    return { success: false, statusCode: 503, error: 'Account data is unavailable.' };
  }

  try {
    const { data, error } = await supabaseClient
      .from('vendor_interest')
      .select('id, business_name, market_area, street_address, nearby_landmark, delivery_coverage, neighborhood, business_type, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[WA JEUN DB] Vendor application query failed.', { code: error.code || 'unknown' });
      return { success: false, statusCode: 500, error: 'Your applications could not be loaded. Please try again.' };
    }
    const applications = data || [];
    if (applications.length === 0) return { success: true, data: [] };

    const { data: events, error: eventError } = await supabaseClient
      .from('vendor_review_audit')
      .select('vendor_interest_id, new_status, reason, created_at')
      .in('vendor_interest_id', applications.map(application => application.id))
      .order('created_at', { ascending: false });
    if (eventError) console.error('[WA JEUN DB] Vendor review note query failed.', { code: eventError.code || 'unknown' });
    const latestReasonByApplication = new Map<string, { status: string; reason: string | null }>();
    for (const event of events || []) {
      if (!latestReasonByApplication.has(event.vendor_interest_id)) {
        latestReasonByApplication.set(event.vendor_interest_id, { status: event.new_status, reason: event.reason });
      }
    }
    return {
      success: true,
      data: applications.map(application => ({
        ...application,
        review_reason: latestReasonByApplication.get(application.id)?.status === application.status
          ? latestReasonByApplication.get(application.id)?.reason || null
          : null
      }))
    };
  } catch {
    return { success: false, statusCode: 503, error: 'Account data is temporarily unavailable.' };
  }
}

export type AdminVendorSummary = {
  id: string;
  business_name: string;
  market_area: string;
  neighborhood: string;
  street_address: string | null;
  nearby_landmark: string | null;
  delivery_coverage: string[];
  business_type: string;
  status: string;
  created_at: string;
};

export type AdminVendorDetails = AdminVendorSummary & {
  contact_name: string;
  phone: string;
  email: string | null;
  current_ordering_methods: string[];
  fulfillment_options: string;
  delivery_fee_ngn: number | null;
  message: string | null;
  consent_accepted: boolean;
};

export type VendorReviewEvent = {
  id: string;
  action: string;
  previous_status: string;
  new_status: string;
  reason: string | null;
  actor_user_id: string;
  created_at: string;
};

export async function isAdminUser(userId: string): Promise<DbResult<boolean>> {
  if (!supabaseClient) return { success: false, statusCode: 503, error: 'Admin service is unavailable.' };
  try {
    const { data, error } = await supabaseClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[WA JEUN DB] Admin membership check failed.', { code: error.code || 'unknown' });
      return { success: false, statusCode: 503, error: 'Admin access could not be verified.' };
    }
    return { success: true, data: Boolean(data) };
  } catch {
    return { success: false, statusCode: 503, error: 'Admin access could not be verified.' };
  }
}

export async function getAdminVendorApplications(): Promise<DbResult<AdminVendorSummary[]>> {
  if (!supabaseClient) return { success: false, statusCode: 503, error: 'Admin service is unavailable.' };
  try {
    const { data, error } = await supabaseClient
      .from('vendor_interest')
      .select('id, business_name, market_area, street_address, nearby_landmark, delivery_coverage, neighborhood, business_type, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[WA JEUN DB] Admin vendor list query failed.', { code: error.code || 'unknown' });
      return { success: false, statusCode: 503, error: 'Vendor applications are temporarily unavailable.' };
    }
    return { success: true, data: data || [] };
  } catch {
    return { success: false, statusCode: 503, error: 'Vendor applications are temporarily unavailable.' };
  }
}

export async function getAdminVendorApplication(applicationId: string): Promise<DbResult<{
  application: AdminVendorDetails;
  history: VendorReviewEvent[];
}>> {
  if (!supabaseClient) return { success: false, statusCode: 503, error: 'Admin service is unavailable.' };
  try {
    const [applicationResult, historyResult] = await Promise.all([
      supabaseClient.from('vendor_interest')
        .select('id, business_name, contact_name, phone, email, market_area, street_address, nearby_landmark, delivery_coverage, neighborhood, business_type, current_ordering_methods, fulfillment_options, delivery_fee_ngn, message, consent_accepted, status, created_at')
        .eq('id', applicationId)
        .maybeSingle(),
      supabaseClient.from('vendor_review_audit')
        .select('id, action, previous_status, new_status, reason, actor_user_id, created_at')
        .eq('vendor_interest_id', applicationId)
        .order('created_at', { ascending: false })
    ]);
    if (applicationResult.error || historyResult.error) {
      const code = applicationResult.error?.code || historyResult.error?.code || 'unknown';
      console.error('[WA JEUN DB] Admin vendor details query failed.', { code });
      return { success: false, statusCode: 503, error: 'Application details are temporarily unavailable.' };
    }
    if (!applicationResult.data) return { success: false, statusCode: 404, error: 'Vendor application not found.' };
    return {
      success: true,
      data: { application: applicationResult.data as AdminVendorDetails, history: historyResult.data || [] }
    };
  } catch {
    return { success: false, statusCode: 503, error: 'Application details are temporarily unavailable.' };
  }
}

export type VendorReviewAction = 'under_review' | 'approve' | 'reject' | 'request_information';

export async function reviewVendorApplication(
  applicationId: string,
  actorUserId: string,
  action: VendorReviewAction,
  reason: string | null
): Promise<DbResult<{ id: string; status: string; updated_at: string }>> {
  if (!supabaseClient) return { success: false, statusCode: 503, error: 'Admin service is unavailable.' };
  try {
    const { data, error } = await supabaseClient.rpc('admin_review_vendor_application', {
      p_application_id: applicationId,
      p_actor_user_id: actorUserId,
      p_action: action,
      p_reason: reason
    });
    if (error) {
      console.error('[WA JEUN DB] Vendor review action failed.', { code: error.code || 'unknown' });
      if (error.code === '42501') return { success: false, statusCode: 403, error: 'You are not authorized to review this application.' };
      if (error.code === 'P0002') return { success: false, statusCode: 404, error: 'Vendor application not found.' };
      if (error.code === '22023') return { success: false, statusCode: 400, error: 'The review action or reason is invalid.' };
      return { success: false, statusCode: 503, error: 'The application could not be updated. Please try again.' };
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.id || !result?.status) {
      return { success: false, statusCode: 503, error: 'The application could not be updated. Please try again.' };
    }
    return { success: true, data: result };
  } catch {
    return { success: false, statusCode: 503, error: 'The application could not be updated. Please try again.' };
  }
}

export function toPublicVendor(record: Record<string, any>): Pick<PublicVendor, 'id' | 'business_name' | 'market_area' | 'neighborhood' | 'street_address' | 'nearby_landmark' | 'delivery_coverage' | 'business_type' | 'fulfillment_options' | 'delivery_fee_ngn'> {
  const deliveryFee = record.delivery_fee_ngn === undefined || record.delivery_fee_ngn === null ? null : Number(record.delivery_fee_ngn);
  const hasDeliveryFee = deliveryFee !== null && Number.isFinite(deliveryFee) && deliveryFee >= 0;
  const configuredOptions = record.fulfillment_options;
  const claimedDeliveryCoverage = Array.isArray(record.delivery_coverage) ? record.delivery_coverage.filter(isMarketAreaId) : [];
  const deliveryConfigured = hasDeliveryFee && claimedDeliveryCoverage.length > 0;
  const deliveryCoverage = deliveryConfigured ? claimedDeliveryCoverage : [];
  const fulfillmentOptions = !deliveryConfigured && configuredOptions === 'pickup_and_delivery' ? 'pickup_only' : configuredOptions;
  return {
    id: record.id,
    business_name: record.business_name,
    market_area: isMarketAreaId(record.market_area) ? record.market_area : 'ijebu-ode',
    neighborhood: record.neighborhood,
    street_address: typeof record.street_address === 'string' && record.street_address.trim() ? record.street_address : null,
    nearby_landmark: typeof record.nearby_landmark === 'string' && record.nearby_landmark.trim() ? record.nearby_landmark : null,
    delivery_coverage: deliveryCoverage,
    business_type: record.business_type,
    fulfillment_options: fulfillmentOptions,
    delivery_fee_ngn: hasDeliveryFee ? deliveryFee : null
  };
}

export type VendorMenuItem = {
  id: string; vendor_interest_id: string; name: string; description: string;
  price_ngn: number; category: string; image_url: string | null; available: boolean;
  created_at: string; updated_at: string;
};

export type OrderItemSnapshot = { id: string; menu_item_id: string | null; item_name: string; quantity: number; unit_price_ngn: number; line_total_ngn: number };
export type CustomerOrderRecord = {
  id: string; order_reference: string; vendor_interest_id: string; customer_name: string; customer_phone: string;
  fulfillment_method: FulfillmentMethod; delivery_address: string | null; subtotal_ngn: number; delivery_fee_ngn: number | null;
  total_ngn: number; status: string; payment_status: string; is_test_order: boolean;
  created_at: string; updated_at: string; accepted_at: string | null; rejected_at: string | null; preparing_at: string | null;
  ready_at: string | null; out_for_delivery_at: string | null; completed_at: string | null;
  vendor?: { business_name: string; neighborhood: string };
  items: OrderItemSnapshot[];
};

function orderItemsByOrder(items: any[] = []): Map<string, OrderItemSnapshot[]> {
  const grouped = new Map<string, OrderItemSnapshot[]>();
  for (const item of items) {
    const row = { id: item.id, menu_item_id: item.menu_item_id, item_name: item.item_name, quantity: Number(item.quantity), unit_price_ngn: Number(item.unit_price_ngn), line_total_ngn: Number(item.line_total_ngn) };
    grouped.set(item.order_id, [...(grouped.get(item.order_id) || []), row]);
  }
  return grouped;
}

const ORDER_SELECT = 'id, order_reference, vendor_interest_id, customer_name, customer_phone, fulfillment_method, delivery_address, subtotal_ngn, delivery_fee_ngn, total_ngn, status, payment_status, is_test_order, created_at, updated_at, accepted_at, rejected_at, preparing_at, ready_at, out_for_delivery_at, completed_at';
const ORDER_ITEM_SELECT = 'id, order_id, menu_item_id, item_name, quantity, unit_price_ngn, line_total_ngn';
function attachOrderData(orders: any[], orderItems: any[], businesses: any[] = []): CustomerOrderRecord[] {
  const itemGroups = orderItemsByOrder(orderItems);
  const businessMap = new Map(businesses.map(vendor => [vendor.id, { business_name: vendor.business_name, neighborhood: vendor.neighborhood }]));
  return orders.map(order => ({
    ...order, subtotal_ngn: Number(order.subtotal_ngn), delivery_fee_ngn: order.delivery_fee_ngn === null ? null : Number(order.delivery_fee_ngn),
    total_ngn: Number(order.total_ngn), vendor: businessMap.get(order.vendor_interest_id), items: itemGroups.get(order.id) || []
  }));
}

export async function createCustomerOrder(input: {
  customerUserId: string; customerName: string; customerPhone: string; fulfillmentMethod: FulfillmentMethod;
  deliveryAddress: string | null; lines: CheckoutLine[]; idempotencyKey: string; requestFingerprint: string;
  expectedDeliveryFeeNgn: number | null; isTestOrder: boolean;
}) {
  if (!supabaseClient) return { success: false as const, statusCode: 503, error: 'Order storage is unavailable. Apply the reviewed orders migration first.' };
  try {
    const { data: prior, error: priorError } = await supabaseClient.from('customer_orders')
      .select('id, order_reference, total_ngn, is_test_order, idempotency_fingerprint').eq('customer_user_id', input.customerUserId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
    if (priorError) return { success: false as const, statusCode: 503, error: 'Order storage is not ready. Apply the reviewed orders migration first.' };
    if (prior) {
      if (!prior.idempotency_fingerprint || prior.idempotency_fingerprint !== input.requestFingerprint) return { success: false as const, statusCode: 409, error: 'This checkout attempt cannot be safely reused. Check your order history before starting another order.' };
      return { success: true as const, data: { id: prior.id, orderReference: prior.order_reference, totalNgn: Number(prior.total_ngn), isTestOrder: prior.is_test_order, created: false } };
    }

    const ids = input.lines.map(line => line.menuItemId);
    const { data: menu, error: menuError } = await supabaseClient.from('vendor_menu_items')
      .select('id, vendor_interest_id, name, price_ngn, available').in('id', ids).eq('available', true);
    if (menuError) return { success: false as const, statusCode: 503, error: 'Current menu prices could not be verified.' };
    const resolvedItems = resolveAvailableOrderItems(input.lines, menu || []);
    if (!resolvedItems.success) return { success: false as const, statusCode: resolvedItems.error.includes('only one') ? 400 : 409, error: resolvedItems.error };
    const vendorId = resolvedItems.vendorId;
    if (input.lines.some(line => Math.round(Number(menu?.find(row => row.id === line.menuItemId)?.price_ngn) * 100) !== Math.round(Number(line.expectedPriceNgn) * 100))) return { success: false as const, statusCode: 409, error: 'A menu price changed. Review the updated prices before placing your order.' };
    const { data: vendor, error: vendorError } = await supabaseClient.from('vendor_interest')
        .select('id, business_name, market_area, neighborhood, street_address, nearby_landmark, delivery_coverage, business_type, fulfillment_options, description, opening_hours, accepting_orders, status, delivery_fee_ngn')
      .eq('id', vendorId).maybeSingle();
    if (vendorError || !vendor) return { success: false as const, statusCode: 409, error: 'This food business is no longer available.' };
    if (!isVendorSellEligible({ status: vendor.status, business_name: vendor.business_name, neighborhood: vendor.neighborhood,
      business_type: vendor.business_type, fulfillment_options: vendor.fulfillment_options, description: vendor.description,
      opening_hours: vendor.opening_hours, accepting_orders: vendor.accepting_orders, available_menu_items: menu.length })) {
      return { success: false as const, statusCode: 409, error: 'This food business is not currently accepting orders.' };
    }
    if (!getPublicStoreAvailability({ accepting_orders: vendor.accepting_orders, opening_hours: vendor.opening_hours }).open) {
      return { success: false as const, statusCode: 409, error: 'This food business is currently closed. Please try again during its opening hours.' };
    }
    if (input.fulfillmentMethod === 'vendor_delivery' && (vendor.delivery_fee_ngn === null || vendor.delivery_fee_ngn === undefined || input.expectedDeliveryFeeNgn === null || !Number.isFinite(Number(vendor.delivery_fee_ngn)) || Math.round(Number(vendor.delivery_fee_ngn) * 100) !== Math.round(Number(input.expectedDeliveryFeeNgn) * 100))) return { success: false as const, statusCode: 409, error: 'The delivery fee changed or is not configured. Review checkout and try again.' };

    const { data, error } = await supabaseClient.rpc('create_customer_order', {
      p_customer_user_id: input.customerUserId, p_customer_name: input.customerName, p_customer_phone: input.customerPhone,
      p_fulfillment_method: input.fulfillmentMethod, p_delivery_address: input.deliveryAddress,
      p_items: input.lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity, expectedPriceNgn: line.expectedPriceNgn })),
      p_idempotency_key: input.idempotencyKey, p_is_test_order: input.isTestOrder,
      p_request_fingerprint: input.requestFingerprint, p_expected_delivery_fee_ngn: input.expectedDeliveryFeeNgn
    });
    if (error) {
      const clientError = ['22023', 'P0002', 'PZ001', 'PZ002'].includes(error.code || '');
      return { success: false as const, statusCode: clientError ? (error.code === 'P0002' || error.code === 'PZ001' || error.code === 'PZ002' ? 409 : 400) : 503,
        error: error.code === 'P0002' ? 'A menu item or business is no longer available. Refresh your cart and try again.' : error.code === 'PZ001' ? 'A price or delivery fee changed. Review the updated checkout details.' : error.code === 'PZ002' ? 'This checkout key was already used for different details. Start a fresh checkout after checking your orders.' : clientError ? 'The checkout details are not valid for this business.' : 'The order could not be saved. Confirm the orders migration has been applied.' };
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.order_id || !result?.order_reference) return { success: false as const, statusCode: 503, error: 'The order could not be confirmed.' };
    return { success: true as const, data: { id: result.order_id, orderReference: result.order_reference, totalNgn: Number(result.total_ngn), isTestOrder: input.isTestOrder, created: result.created } };
  } catch {
    return { success: false as const, statusCode: 503, error: 'The order service is temporarily unavailable.' };
  }
}

export async function getCustomerOrderAttempt(customerUserId: string, idempotencyKey: string) {
  if (!supabaseClient) return { success: false as const, statusCode: 503, error: 'Order status could not be confirmed.' };
  try {
    let query = supabaseClient.from('customer_orders').select('id, order_reference, total_ngn, is_test_order')
      .eq('customer_user_id', customerUserId).eq('idempotency_key', idempotencyKey);
    if (isProductionRuntime()) query = query.eq('is_test_order', false);
    const { data, error } = await query.maybeSingle();
    if (error) return { success: false as const, statusCode: 503, error: 'Order status could not be confirmed.' };
    if (!data) return { success: true as const, data: null };
    return { success: true as const, data: { id: data.id, orderReference: data.order_reference, totalNgn: Number(data.total_ngn), isTestOrder: data.is_test_order, created: false } };
  } catch { return { success: false as const, statusCode: 503, error: 'Order status could not be confirmed.' }; }
}

export async function getCustomerOrders(userId: string): Promise<DbResult<CustomerOrderRecord[]>> {
  if (!supabaseClient) return { success: false, statusCode: 503, error: 'Order history is unavailable.' };
  try {
    let orderQuery = supabaseClient.from('customer_orders').select(ORDER_SELECT).eq('customer_user_id', userId);
    if (isProductionRuntime()) orderQuery = orderQuery.eq('is_test_order', false);
    const { data: orders, error } = await orderQuery.order('created_at', { ascending: false });
    if (error) {
      console.error('[WA JEUN DB] Customer order query failed.', { category: 'orders_query', code: error.code || 'unknown' });
      return { success: false, statusCode: 503, error: 'Order history is temporarily unavailable.' };
    }
    if (!orders?.length) return { success: true, data: [] };
    const ids = orders.map(order => order.id); const vendorIds = [...new Set(orders.map(order => order.vendor_interest_id))];
    const [{ data: items, error: itemError }, { data: vendors, error: vendorError }] = await Promise.all([
      supabaseClient.from('customer_order_items').select(ORDER_ITEM_SELECT).in('order_id', ids),
      supabaseClient.from('vendor_interest').select('id, business_name, neighborhood').in('id', vendorIds)
    ]);
    if (itemError || vendorError) {
      console.error('[WA JEUN DB] Customer order details query failed.', {
        category: itemError ? 'order_items_query' : 'vendor_summary_query',
        code: itemError?.code || vendorError?.code || 'unknown'
      });
      return { success: false, statusCode: 503, error: 'Order details are temporarily unavailable.' };
    }
    return { success: true, data: attachOrderData(orders, items || [], vendors || []) };
  } catch {
    console.error('[WA JEUN DB] Customer order history failed.', { category: 'unexpected_database_error' });
    return { success: false, statusCode: 503, error: 'Order history is temporarily unavailable.' };
  }
}

export async function getVendorOrders(userId: string, businessId?: string): Promise<DbResult<CustomerOrderRecord[]>> {
  if (!supabaseClient) return { success: false, statusCode: 503, error: 'Vendor orders are unavailable.' };
  try {
    let vendorQuery = supabaseClient.from('vendor_interest').select('id, business_name, neighborhood').eq('user_id', userId);
    if (businessId) vendorQuery = vendorQuery.eq('id', businessId);
    const { data: vendors, error: vendorError } = await vendorQuery;
    if (vendorError) return { success: false, statusCode: 503, error: 'Vendor orders are temporarily unavailable.' };
    const ids = (vendors || []).map(vendor => vendor.id);
    if (businessId && !ids.length) return { success: false, statusCode: 404, error: 'Business not found for this account.' };
    if (!ids.length) return { success: true, data: [] };
    let orderQuery = supabaseClient.from('customer_orders').select(ORDER_SELECT).in('vendor_interest_id', ids);
    if (isProductionRuntime()) orderQuery = orderQuery.eq('is_test_order', false);
    const { data: orders, error } = await orderQuery.order('created_at', { ascending: false });
    if (error) return { success: false, statusCode: 503, error: 'Vendor orders are temporarily unavailable.' };
    if (!orders?.length) return { success: true, data: [] };
    const { data: items, error: itemError } = await supabaseClient.from('customer_order_items').select(ORDER_ITEM_SELECT).in('order_id', orders.map(order => order.id));
    if (itemError) return { success: false, statusCode: 503, error: 'Vendor order details are temporarily unavailable.' };
    return { success: true, data: attachOrderData(orders, items || [], vendors || []) };
  } catch { return { success: false, statusCode: 503, error: 'Vendor orders are temporarily unavailable.' }; }
}

export async function transitionVendorOrder(userId: string, orderId: string, nextStatus: string) {
  if (!supabaseClient) return { success: false as const, statusCode: 503, error: 'Vendor orders are unavailable.' };
  try {
    if (isProductionRuntime()) {
      const { data: businesses, error: businessError } = await supabaseClient.from('vendor_interest').select('id').eq('user_id', userId);
      if (businessError) return { success: false as const, statusCode: 503, error: 'Order status could not be verified.' };
      const businessIds = (businesses || []).map(row => row.id);
      if (!businessIds.length) return { success: false as const, statusCode: 404, error: 'Order not found for this vendor account.' };
      const { data: order, error: orderError } = await supabaseClient.from('customer_orders').select('id, is_test_order').eq('id', orderId).in('vendor_interest_id', businessIds).maybeSingle();
      if (orderError) return { success: false as const, statusCode: 503, error: 'Order status could not be verified.' };
      if (!order) return { success: false as const, statusCode: 404, error: 'Order not found for this vendor account.' };
      if (order.is_test_order) return { success: false as const, statusCode: 409, error: 'Development test orders cannot be managed in production.' };
    }
    const { data, error } = await supabaseClient.rpc('transition_vendor_order', { p_vendor_user_id: userId, p_order_id: orderId, p_next_status: nextStatus });
    if (error) return { success: false as const, statusCode: error.code === 'P0002' ? 404 : error.code === '22023' ? 409 : 503,
      error: error.code === 'P0002' ? 'Order not found for this vendor account.' : error.code === '22023' ? 'That order status change is not allowed.' : 'Order status could not be updated.' };
    return { success: true as const, data: Array.isArray(data) ? data[0] : data };
  } catch { return { success: false as const, statusCode: 503, error: 'Order status could not be updated.' }; }
}

export async function getVendorDashboard(userId: string): Promise<DbResult<any[]>> {
  if (!supabaseClient) return { success: false, statusCode: 503, error: 'Vendor dashboard is unavailable.' };
  try {
    const { data, error } = await supabaseClient.from('vendor_interest')
      .select('id, business_name, contact_name, phone, email, market_area, neighborhood, street_address, nearby_landmark, delivery_coverage, business_type, fulfillment_options, delivery_fee_ngn, status, description, opening_hours, accepting_orders, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    const businesses = data || [];
    const ids = businesses.map(item => item.id);
    const { data: auditEvents } = ids.length
      ? await supabaseClient.from('vendor_review_audit').select('vendor_interest_id, new_status, reason').in('vendor_interest_id', ids).order('created_at', { ascending: false })
      : { data: [] };
    const latestReason = new Map<string, { status: string; reason: string | null }>();
    for (const event of auditEvents || []) if (!latestReason.has(event.vendor_interest_id)) latestReason.set(event.vendor_interest_id, { status: event.new_status, reason: event.reason });
    const { data: items, error: menuError } = ids.length
      ? await supabaseClient.from('vendor_menu_items').select('*').in('vendor_interest_id', ids).order('created_at', { ascending: false })
      : { data: [], error: null };
    if (menuError) throw menuError;
    return { success: true, data: businesses.map(business => ({
      ...business,
      review_reason: latestReason.get(business.id)?.status === business.status ? latestReason.get(business.id)?.reason || null : null,
      menu: (items || []).filter(item => item.vendor_interest_id === business.id)
    })) };
  } catch {
    return { success: false, statusCode: 503, error: 'Vendor dashboard is temporarily unavailable.' };
  }
}

async function ownedVendor(userId: string, businessId: string) {
  if (!supabaseClient) return { error: 'Vendor service is unavailable.', statusCode: 503 } as const;
  const { data, error } = await supabaseClient.from('vendor_interest')
    .select('id, status, user_id').eq('id', businessId).eq('user_id', userId).maybeSingle();
  if (error) return { error: 'Vendor business could not be verified.', statusCode: 503 } as const;
  if (!data || !isVendorOwner(userId, data.user_id)) return { error: 'Vendor business not found.', statusCode: 404 } as const;
  return { data } as const;
}

export async function updateVendorProfile(userId: string, businessId: string, profile: Record<string, unknown>) {
  const owner = await ownedVendor(userId, businessId);
  if (!owner.data) return { success: false as const, ...owner };
  if (!['approved', 'pending_review', 'under_review', 'contacted'].includes(owner.data.status)) return { success: false as const, statusCode: 403, error: 'This application cannot be edited in its current status.' };
  const { data, error } = await supabaseClient!.from('vendor_interest').update({
    business_name: profile.businessName, business_type: profile.businessType,
    contact_name: profile.contactName, phone: profile.phone, email: profile.email,
    description: profile.description, neighborhood: profile.neighborhood,
    market_area: profile.marketArea, street_address: profile.streetAddress,
    nearby_landmark: profile.nearbyLandmark, delivery_coverage: profile.deliveryCoverage,
    opening_hours: profile.openingHours, fulfillment_options: profile.fulfillmentOptions, delivery_fee_ngn: profile.deliveryFeeNgn,
    updated_at: new Date().toISOString()
  }).eq('id', businessId).eq('user_id', userId).select('id, business_name, contact_name, phone, email, market_area, neighborhood, street_address, nearby_landmark, delivery_coverage, business_type, fulfillment_options, delivery_fee_ngn, status, description, opening_hours, accepting_orders').single();
  return error ? { success: false as const, statusCode: 503, error: 'Business profile could not be saved.' } : { success: true as const, data };
}

export async function setVendorAvailability(userId: string, businessId: string, accepting: boolean) {
  const owner = await ownedVendor(userId, businessId);
  if (!owner.data) return { success: false as const, ...owner };
  if (!canManageMenu(owner.data.status)) return { success: false as const, statusCode: 403, error: 'Only approved businesses may change order availability.' };
  if (accepting) {
    const { data: vendor } = await supabaseClient!.from('vendor_interest').select('description, opening_hours, fulfillment_options, delivery_fee_ngn').eq('id', businessId).single();
    const { count } = await supabaseClient!.from('vendor_menu_items').select('id', { count: 'exact', head: true }).eq('vendor_interest_id', businessId).eq('available', true);
    if (!vendor?.description?.trim() || !vendor?.opening_hours || !count) return { success: false as const, statusCode: 400, error: 'Complete your storefront and add an available menu item before accepting orders.' };
    if (vendor.fulfillment_options === 'delivery_varies' || (vendor.fulfillment_options === 'vendor_delivery' && (vendor.delivery_fee_ngn === null || !Number.isFinite(Number(vendor.delivery_fee_ngn))))) return { success: false as const, statusCode: 400, error: 'Configure a fixed delivery fee and supported fulfillment option before accepting orders.' };
  }
  const { data, error } = await supabaseClient!.from('vendor_interest').update({ accepting_orders: accepting, updated_at: new Date().toISOString() }).eq('id', businessId).eq('user_id', userId).select('accepting_orders').single();
  return error ? { success: false as const, statusCode: 503, error: 'Store availability could not be saved.' } : { success: true as const, data };
}

export async function saveVendorMenuItem(userId: string, businessId: string, itemId: string | null, item: Record<string, unknown>) {
  const owner = await ownedVendor(userId, businessId);
  if (!owner.data) return { success: false as const, ...owner };
  if (!canManageMenu(owner.data.status)) return { success: false as const, statusCode: 403, error: 'Only approved businesses may manage menu items.' };
  const values = { name: item.name, description: item.description, price_ngn: item.priceNgn, category: item.category, image_url: item.imageUrl || null, available: item.available ?? true, updated_at: new Date().toISOString() };
  const query = itemId
    ? supabaseClient!.from('vendor_menu_items').update(values).eq('id', itemId).eq('vendor_interest_id', businessId)
    : supabaseClient!.from('vendor_menu_items').insert({ ...values, vendor_interest_id: businessId });
  const { data, error } = await query.select('*').maybeSingle();
  if (error) return { success: false as const, statusCode: 503, error: 'Menu item could not be saved.' };
  if (!data) return { success: false as const, statusCode: 404, error: 'Menu item not found for this business.' };
  return { success: true as const, data };
}

export async function deleteVendorMenuItem(userId: string, businessId: string, itemId: string) {
  const owner = await ownedVendor(userId, businessId);
  if (!owner.data) return { success: false as const, ...owner };
  if (!canManageMenu(owner.data.status)) return { success: false as const, statusCode: 403, error: 'Only approved businesses may manage menu items.' };
  const { data, error } = await supabaseClient!.from('vendor_menu_items').delete().eq('id', itemId).eq('vendor_interest_id', businessId).select('id').maybeSingle();
  if (error) return { success: false as const, statusCode: 503, error: 'Menu item could not be removed.' };
  return data ? { success: true as const } : { success: false as const, statusCode: 404, error: 'Menu item not found for this business.' };
}

export async function uploadVendorMenuImage(userId: string, businessId: string, contentType: string, bytes: Buffer) {
  const owner = await ownedVendor(userId, businessId);
  if (!owner.data) return { success: false as const, ...owner };
  if (!canManageMenu(owner.data.status)) return { success: false as const, statusCode: 403, error: 'Only approved businesses may upload menu images.' };
  const signatures: Record<string, { ext: string; signature: number[] }> = {
    'image/jpeg': { ext: 'jpg', signature: [0xff, 0xd8, 0xff] },
    'image/png': { ext: 'png', signature: [0x89, 0x50, 0x4e, 0x47] },
    'image/webp': { ext: 'webp', signature: [0x52, 0x49, 0x46, 0x46] }
  };
  const format = signatures[contentType];
  if (!format || !format.signature.every((value, index) => bytes[index] === value)) return { success: false as const, statusCode: 400, error: 'Upload a valid JPEG, PNG, or WebP food image.' };
  if (!supabaseClient) return { success: false as const, statusCode: 503, error: 'Image storage is unavailable.' };
  const path = `${userId}/${businessId}/${randomUUID()}.${format.ext}`;
  const { error } = await supabaseClient.storage.from('vendor-menu-images').upload(path, bytes, { contentType, upsert: false });
  if (error) return { success: false as const, statusCode: 503, error: 'Food image could not be uploaded.' };
  return { success: true as const, data: { imageUrl: supabaseClient.storage.from('vendor-menu-images').getPublicUrl(path).data.publicUrl } };
}

export type PublicVendorFilters = { categories?: string[]; search?: string; marketArea?: string; neighborhood?: string; fulfillment?: 'pickup' | 'delivery' };
export type PublicVendorListResult = { success: true; vendors: PublicVendor[]; total: number } | { success: false; statusCode: number; error: string };

function isPublicFulfillmentConfigured(vendor: Record<string, any>): boolean {
  const fee = vendor.delivery_fee_ngn === null || vendor.delivery_fee_ngn === undefined ? null : Number(vendor.delivery_fee_ngn);
  const hasFee = fee !== null && Number.isFinite(fee) && fee >= 0;
  if (vendor.fulfillment_options === 'pickup_only' || vendor.fulfillment_options === 'pickup_and_delivery') return true;
  return vendor.fulfillment_options === 'vendor_delivery' && hasFee && Array.isArray(vendor.delivery_coverage) && vendor.delivery_coverage.length > 0;
}

export function toPublicMenuItem(item: Record<string, any>) {
  const price = Number(item.price_ngn);
  if (item.available !== true || !Number.isFinite(price) || price <= 0) return null;
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    price_ngn: price,
    category: item.category,
    image_url: isTrustedMenuImageUrl(item.image_url, supabaseUrl) ? item.image_url : null,
    available: true as const
  };
}

export function matchesPublicVendorFilters(vendor: PublicVendor, filters: PublicVendorFilters) {
  if (filters.marketArea) {
    if (filters.fulfillment === 'pickup' && vendor.market_area !== filters.marketArea) return false;
    if (filters.fulfillment === 'delivery' && !vendor.delivery_coverage.includes(filters.marketArea)) return false;
    if (filters.fulfillment !== 'pickup' && filters.fulfillment !== 'delivery' && vendor.market_area !== filters.marketArea && !vendor.delivery_coverage.includes(filters.marketArea)) return false;
  }
  if (filters.neighborhood && vendor.neighborhood.toLocaleLowerCase() !== filters.neighborhood.toLocaleLowerCase()) return false;
  if (filters.fulfillment === 'pickup' && !['pickup_only', 'pickup_and_delivery'].includes(vendor.fulfillment_options)) return false;
  if (filters.fulfillment === 'delivery' && (!['vendor_delivery', 'pickup_and_delivery'].includes(vendor.fulfillment_options) || vendor.delivery_fee_ngn === null || !Number.isFinite(vendor.delivery_fee_ngn) || vendor.delivery_fee_ngn < 0)) return false;
  if (filters.categories?.length && !vendor.menu.some(item => filters.categories!.includes(item.category))) return false;
  if (filters.search) {
    const needle = filters.search.toLocaleLowerCase();
    const matchesName = vendor.business_name.toLocaleLowerCase().includes(needle);
    const matchesItem = vendor.menu.some(item => item.name.toLocaleLowerCase().includes(needle));
    const areaLabel = MARKET_AREAS.find(area => area.id === vendor.market_area)?.label || vendor.market_area;
    const matchesLocation = [areaLabel, vendor.neighborhood, vendor.street_address || '', vendor.nearby_landmark || '']
      .some(value => value.toLocaleLowerCase().includes(needle));
    if (!matchesName && !matchesItem && !matchesLocation) return false;
  }
  return true;
}

export function toPublicVendorListing(record: Record<string, any>, items: Record<string, any>[]): PublicVendor {
  return {
    ...toPublicVendor(record),
    description: record.description,
    opening_hours: record.opening_hours,
    accepting_orders: record.accepting_orders === true,
    menu: items.map(toPublicMenuItem).filter((item): item is NonNullable<typeof item> => item !== null)
  };
}

export async function getVerifiedVendors(filters: PublicVendorFilters): Promise<PublicVendorListResult> {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('vendor_interest')
        .select('id, business_name, market_area, neighborhood, street_address, nearby_landmark, delivery_coverage, business_type, fulfillment_options, delivery_fee_ngn, description, opening_hours, accepting_orders, status')
        .eq('status', 'approved').eq('accepting_orders', true);
      if (error) {
        // PostgREST errors identify schema/configuration faults (for example a
        // missing column) without returning row data or credentials. Keep that
        // safe diagnostic so a 503 can be traced to its actual cause.
        console.error('[WA JEUN DB] Public vendor query failed.', {
          code: error.code || 'unknown',
          message: error.message || 'Database query failed.'
        });
        return { success: false, statusCode: 503, error: 'The food directory is temporarily unavailable. Please try again.' };
      }

      const candidates = (data || []).filter(vendor => isPublicFulfillmentConfigured(vendor) && isVendorSellEligible({
        status: vendor.status, business_name: vendor.business_name, neighborhood: vendor.neighborhood,
        business_type: vendor.business_type, fulfillment_options: vendor.fulfillment_options,
        description: vendor.description, opening_hours: vendor.opening_hours,
        accepting_orders: vendor.accepting_orders, available_menu_items: 1
      }));
      if (!candidates.length) return { success: true, vendors: [], total: 0 };

      const { data: menu, error: menuError } = await supabaseClient.from('vendor_menu_items')
        .select('id, vendor_interest_id, name, description, price_ngn, category, image_url, available')
        .in('vendor_interest_id', candidates.map(vendor => vendor.id)).eq('available', true);
      if (menuError) {
        console.error('[WA JEUN DB] Public menu query failed.', { code: menuError.code || 'unknown' });
        return { success: false, statusCode: 503, error: 'Food menus are temporarily unavailable. Please try again.' };
      }

      const vendors = candidates.map(vendor => toPublicVendorListing(vendor,
        (menu || []).filter(item => item.vendor_interest_id === vendor.id)))
        .filter(vendor => vendor.menu.length > 0)
        .filter(vendor => matchesPublicVendorFilters(vendor, filters));
      return { success: true, vendors, total: vendors.length };
    } catch {
      return { success: false, statusCode: 503, error: 'The food directory is temporarily unavailable. Please try again.' };
    }
  }

  if (getStorageMode() === 'unconfigured-production') {
    return { success: false, statusCode: 503, error: 'The food directory is temporarily unavailable. Please try again.' };
  }

  // Local development data remains supported, but only records meeting the same
  // public eligibility rules and containing available real menu items are shown.
  try {
    const devDb = readDevDbStrict();
    const vendors = (devDb.vendors || []).map((vendor: Record<string, any>) => {
      const items = (vendor.menu || []).filter((item: Record<string, any>) => item.available === true);
      if (!isPublicFulfillmentConfigured(vendor) || !isVendorSellEligible({
        status: vendor.status, business_name: vendor.business_name, neighborhood: vendor.neighborhood,
        business_type: vendor.business_type, fulfillment_options: vendor.fulfillment_options,
        description: vendor.description, opening_hours: vendor.opening_hours,
        accepting_orders: vendor.accepting_orders, available_menu_items: items.length
      })) return null;
      return toPublicVendorListing(vendor, items);
    }).filter((vendor: PublicVendor | null): vendor is PublicVendor => Boolean(vendor))
      .filter((vendor: PublicVendor) => matchesPublicVendorFilters(vendor, filters));
    return { success: true, vendors, total: vendors.length };
  } catch {
    return { success: false, statusCode: 503, error: 'The food directory is temporarily unavailable. Please try again.' };
  }
}

export async function getPublicVendorMenu(businessId: string): Promise<DbResult<PublicVendor>> {
  if (!supabaseClient) {
    if (getStorageMode() === 'unconfigured-production') return { success: false, statusCode: 503, error: 'The food directory is temporarily unavailable. Please try again.' };
    try {
      const devDb = readDevDbStrict();
      const vendor = (devDb.vendors || []).find((entry: Record<string, any>) => entry.id === businessId);
      if (!vendor || !isPublicFulfillmentConfigured(vendor)) return { success: false, statusCode: 404, error: 'This food business is not currently available.' };
      const menu = (vendor.menu || []).filter((item: Record<string, any>) => item.available === true);
      if (!isVendorSellEligible({
        status: vendor.status, business_name: vendor.business_name, neighborhood: vendor.neighborhood,
        business_type: vendor.business_type, fulfillment_options: vendor.fulfillment_options,
        description: vendor.description, opening_hours: vendor.opening_hours,
        accepting_orders: vendor.accepting_orders, available_menu_items: menu.length
      })) return { success: false, statusCode: 404, error: 'This food business is not currently available.' };
      return { success: true, data: toPublicVendorListing(vendor, menu) };
    } catch {
      return { success: false, statusCode: 503, error: 'The food directory is temporarily unavailable. Please try again.' };
    }
  }
  try {
    const { data: vendor, error } = await supabaseClient.from('vendor_interest')
        .select('id, business_name, market_area, neighborhood, street_address, nearby_landmark, delivery_coverage, business_type, fulfillment_options, delivery_fee_ngn, description, opening_hours, accepting_orders, status')
      .eq('id', businessId).eq('status', 'approved').eq('accepting_orders', true).maybeSingle();
    if (error) return { success: false, statusCode: 503, error: 'This menu is temporarily unavailable. Please try again.' };
    if (!vendor) return { success: false, statusCode: 404, error: 'This food business is not currently available.' };

    const { data: menu, error: menuError } = await supabaseClient.from('vendor_menu_items')
      .select('id, vendor_interest_id, name, description, price_ngn, category, image_url, available')
      .eq('vendor_interest_id', businessId).eq('available', true);
    if (menuError) return { success: false, statusCode: 503, error: 'This menu is temporarily unavailable. Please try again.' };
    if (!isPublicFulfillmentConfigured(vendor) || !isVendorSellEligible({
      status: vendor.status, business_name: vendor.business_name, neighborhood: vendor.neighborhood,
      business_type: vendor.business_type, fulfillment_options: vendor.fulfillment_options,
      description: vendor.description, opening_hours: vendor.opening_hours,
      accepting_orders: vendor.accepting_orders, available_menu_items: menu?.length || 0
    })) return { success: false, statusCode: 404, error: 'This food business is not currently available.' };

    return { success: true, data: toPublicVendorListing(vendor, menu || []) };
  } catch {
    return { success: false, statusCode: 503, error: 'This menu is temporarily unavailable. Please try again.' };
  }
}

// 7. Health Statistics Query (Never exposes PII or private lists)
type SupabaseCountResult = { count: number | null; error?: unknown };

export function summarizeSupabaseHealth(
  customerCount: SupabaseCountResult,
  vendorCount: SupabaseCountResult
): {
  status: 'online' | 'degraded';
  storageMode: 'supabase-production' | 'supabase-error';
  registeredCustomers: number;
  registeredVendors: number;
} {
  if (customerCount.error || vendorCount.error) {
    return {
      status: 'degraded',
      storageMode: 'supabase-error',
      registeredCustomers: 0,
      registeredVendors: 0
    };
  }

  return {
    status: 'online',
    storageMode: 'supabase-production',
    registeredCustomers: customerCount.count || 0,
    registeredVendors: vendorCount.count || 0
  };
}

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

      return summarizeSupabaseHealth(custCount, vendCount);
    } catch (err) {
      return {
        status: 'degraded',
        storageMode: 'supabase-error',
        registeredCustomers: 0,
        registeredVendors: 0
      };
    }
  }

  if (!supabaseClient && isProductionRuntime()) {
    return {
      status: 'configuration-required',
      storageMode: mode,
      registeredCustomers: 0,
      registeredVendors: 0
    };
  }

  const devDb = readDevDb();
  return {
    status: 'online',
    storageMode: mode,
    registeredCustomers: (devDb.customers || []).length,
    registeredVendors: (devDb.vendors || []).length
  };
}
