import {
  CustomerInterestPayload,
  VendorInterestPayload,
  ContactMessagePayload,
  ApiResponse,
  SystemHealthResponse
} from '../types';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly category: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export type VendorApplication = {
  id: string;
  business_name: string;
  market_area: string;
  neighborhood: string;
  business_type: string;
  status: string;
  created_at: string;
  review_reason: string | null;
};

function logApiFailure(endpoint: string, error: unknown): void {
  const status = error instanceof ApiError ? error.status : 0;
  const category = error instanceof ApiError ? error.category : error instanceof TypeError ? 'network_error' : 'unexpected_response';
  console.warn('[WA JEUN API] Request failed.', { endpoint, status, category });
}

async function readAdminJson<T>(res: Response, fallback: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLocaleLowerCase().includes('json')) {
    throw new ApiError(res.status === 401 ? 'Your session expired. Sign in again, then retry.' : 'The service response could not be read. Please retry.', res.status, 'non_json_response');
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError('The service response could not be read. Please retry.', res.status, 'invalid_json');
  }
  const response = data as { error?: unknown } | null;
  if (!res.ok) {
    throw new ApiError(typeof response?.error === 'string' ? response.error : fallback, res.status, res.status === 401 ? 'unauthorized' : res.status === 503 ? 'service_unavailable' : 'http_error');
  }
  if (!response || typeof response !== 'object') throw new ApiError('The service response could not be read. Please retry.', res.status, 'unexpected_response');
  return data as T;
}

async function readPublicJson<T>(res: Response, fallback: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLocaleLowerCase().includes('json')) throw new ApiError(`Food directory returned a non-JSON response (HTTP ${res.status}).`, res.status, 'non_json_response');
  let data: unknown;
  try { data = await res.json(); }
  catch { throw new ApiError(`Food directory returned invalid JSON (HTTP ${res.status}).`, res.status, 'invalid_json'); }
  const response = data as { error?: unknown } | null;
  if (!res.ok) throw new ApiError(typeof response?.error === 'string' ? response.error : fallback, res.status, res.status === 401 ? 'unauthorized' : res.status === 503 ? 'service_unavailable' : 'http_error');
  if (!response || typeof response !== 'object') throw new ApiError('Food directory returned an unexpected response.', res.status, 'unexpected_response');
  return data as T;
}

export const api = {
  /**
   * Check backend status and persistence state
   */
  async getHealth(): Promise<SystemHealthResponse> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      return {
        status: 'offline',
        market: 'Ijebu Ode, Ogun State, Nigeria',
        stage: 'pre-launch-mvp',
        storageMode: 'disconnected',
        counts: { registeredCustomers: 0, registeredVendors: 0 },
        message: 'Could not connect to the wá jẹun backend service.'
      };
    }
  },

  /**
   * Search and filter eligible public food businesses.
   */
  async getVendors(params?: { categories?: string[]; search?: string; marketArea?: string; neighborhood?: string; fulfillment?: 'pickup' | 'delivery' }) {
    const query = new URLSearchParams();
    if (params?.categories?.length) query.append('category', params.categories.join(','));
    if (params?.search) query.append('search', params.search);
    if (params?.marketArea) query.append('marketArea', params.marketArea);
    if (params?.neighborhood) query.append('neighborhood', params.neighborhood);
    if (params?.fulfillment) query.append('fulfillment', params.fulfillment);

    try {
      const res = await fetch(`/api/vendors${query.size ? `?${query.toString()}` : ''}`, { cache: 'no-store' });
      const response = await readPublicJson<PublicVendorListResponse>(res, 'Could not load food businesses.');
      if (response.success !== true || !Array.isArray(response.vendors) || !Number.isFinite(response.total)) {
        throw new ApiError('Food directory returned an unexpected response.', 200, 'unexpected_response');
      }
      return response;
    } catch (error) {
      logApiFailure('GET /api/vendors', error);
      throw error;
    }
  },

  async getPublicVendorMenu(businessId: string) {
    const res = await fetch(`/api/vendors/${encodeURIComponent(businessId)}/menu`, { cache: 'no-store' });
    return await readPublicJson<{ success: true; vendor: PublicVendorBusiness }>(res, 'This business is not currently available.');
  },

  /**
   * Submit customer early access signup
   */
  async registerCustomer(payload: CustomerInterestPayload): Promise<ApiResponse> {
    try {
      const res = await fetch('/api/interest/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to submit registration. Please check your information.'
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: 'Unable to reach the server. Please verify your connection and try again.'
      };
    }
  },

  /**
   * Submit food business onboarding registration
   */
  async registerVendor(payload: VendorInterestPayload, accessToken?: string): Promise<ApiResponse> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch('/api/interest/vendor', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to submit food business interest.'
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: 'Unable to reach the server. Please verify your internet connection and try again.'
      };
    }
  },

  async getMyVendorApplications(accessToken: string) {
    let res: Response;
    try {
      res = await fetch('/api/account/vendor-applications', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      });
    } catch {
      throw new Error('Could not reach the account service. Check your connection and try again.');
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error('The account service returned an unreadable response. Please try again.');
    }

    const response = data as { success?: unknown; error?: unknown; applications?: unknown };
    if (!res.ok) {
      const message = typeof response.error === 'string'
        ? response.error
        : res.status === 401
          ? 'Your session may have expired. Please sign in again.'
          : 'Your applications are temporarily unavailable. Please try again.';
      throw new Error(message);
    }
    if (response.success !== true || !Array.isArray(response.applications)) {
      throw new Error('The account service returned an unexpected response. Please try again.');
    }
    return data as { success: true; applications: VendorApplication[] };
  },

  async getAdminVendorApplications(accessToken: string, options: { status?: string; search?: string } = {}) {
    const query = new URLSearchParams();
    if (options.status && options.status !== 'all') query.set('status', options.status);
    if (options.search) query.set('search', options.search);
    const queryString = query.toString();
    const res = await fetch(`/api/admin/vendor-applications${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    });
    const data = await readAdminJson<{ success: true; applications: Array<{
      id: string; business_name: string; market_area: string; street_address: string | null; nearby_landmark: string | null; delivery_coverage: string[]; neighborhood: string; business_type: string; status: string; created_at: string;
    }> }>(res, 'Could not load vendor applications.');
    return data as { success: true; applications: Array<{
      id: string; business_name: string; market_area: string; street_address: string | null; nearby_landmark: string | null; delivery_coverage: string[]; neighborhood: string; business_type: string; status: string; created_at: string;
    }> };
  },

  async getAdminAccess(accessToken: string): Promise<boolean> {
    const res = await fetch('/api/admin/access', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    });
    if (res.status === 403) return false;
    const data = await readAdminJson<{ success: true; isAdmin: true }>(res, 'Administrator access could not be verified.');
    return data.success === true && data.isAdmin === true;
  },

  async getVendorDashboard(accessToken: string) {
    const res = await fetch('/api/vendor/dashboard', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    return await readAdminJson<{ success: true; businesses: VendorBusiness[] }>(res, 'Could not load your vendor dashboard.');
  },

  async createCustomerOrder(accessToken: string, payload: {
    customerName: string; customerPhone: string; fulfillmentMethod: 'pickup' | 'vendor_delivery'; deliveryAddress: string | null;
    items: Array<{ menuItemId: string; quantity: number; expectedPriceNgn: number }>; expectedDeliveryFeeNgn: number | null; idempotencyKey: string;
  }) {
    const res = await fetch('/api/customer/orders', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await readAdminJson<{ success: true; order: { id: string; orderReference: string; totalNgn: number; isTestOrder: boolean; created: boolean } }>(res, 'Could not place the order.');
  },

  async startFlutterwaveTestCheckout(accessToken: string, payload: {
    customerName: string; customerPhone: string; customerEmail: string; fulfillmentMethod: 'pickup' | 'vendor_delivery'; deliveryAddress: string | null;
    items: Array<{ menuItemId: string; quantity: number; expectedPriceNgn: number }>; expectedDeliveryFeeNgn: number | null; idempotencyKey: string;
  }) {
    const res = await fetch('/api/customer/orders/flutterwave-test', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await readAdminJson<{ success: true; checkoutUrl: string; orderReference: string; isTestOrder: true }>(res, 'Could not start the Flutterwave test checkout.');
  },

  async getCustomerOrderAttempt(accessToken: string, idempotencyKey: string) {
    const res = await fetch(`/api/customer/orders/attempt/${encodeURIComponent(idempotencyKey)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    return await readAdminJson<{ success: true; order: { id: string; orderReference: string; totalNgn: number; isTestOrder: boolean; created: boolean } }>(res, 'Could not confirm the previous checkout attempt.');
  },

  async getCustomerOrders(accessToken: string) {
    try {
      const res = await fetch('/api/customer/orders', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      return await readAdminJson<{ success: true; orders: CustomerOrder[] }>(res, 'Could not load your orders.');
    } catch (error) {
      logApiFailure('GET /api/customer/orders', error);
      throw error;
    }
  },

  async getVendorOrders(accessToken: string, businessId?: string) {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : '';
    const res = await fetch(`/api/vendor/orders${query}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    return await readAdminJson<{ success: true; orders: CustomerOrder[] }>(res, 'Could not load vendor orders.');
  },

  async updateVendorOrderStatus(accessToken: string, orderId: string, status: string) {
    const res = await fetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    return await readAdminJson<{ success: true; order: { id: string; status: string; updated_at: string } }>(res, 'Could not update order status.');
  },

  async updateVendorProfile(accessToken: string, businessId: string, profile: VendorProfileInput) {
    const res = await fetch(`/api/vendor/businesses/${encodeURIComponent(businessId)}/profile`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(profile)
    });
    return await readAdminJson<{ success: true; business: VendorBusiness }>(res, 'Could not save your business profile.');
  },

  async setVendorAvailability(accessToken: string, businessId: string, acceptingOrders: boolean) {
    const res = await fetch(`/api/vendor/businesses/${encodeURIComponent(businessId)}/availability`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ acceptingOrders })
    });
    return await readAdminJson<{ success: true; accepting_orders: boolean }>(res, 'Could not update store availability.');
  },

  async saveVendorMenuItem(accessToken: string, businessId: string, item: VendorMenuInput, itemId?: string) {
    const res = await fetch(`/api/vendor/businesses/${encodeURIComponent(businessId)}/menu${itemId ? `/${encodeURIComponent(itemId)}` : ''}`, {
      method: itemId ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(item)
    });
    return await readAdminJson<{ success: true; item: VendorMenuItem }>(res, 'Could not save the menu item.');
  },

  async deleteVendorMenuItem(accessToken: string, businessId: string, itemId: string) {
    const res = await fetch(`/api/vendor/businesses/${encodeURIComponent(businessId)}/menu/${encodeURIComponent(itemId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }
    });
    return await readAdminJson<{ success: true }>(res, 'Could not remove the menu item.');
  },

  async uploadVendorMenuImage(accessToken: string, businessId: string, file: File) {
    const res = await fetch(`/api/vendor/businesses/${encodeURIComponent(businessId)}/menu-image`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': file.type }, body: file
    });
    return await readAdminJson<{ success: true; imageUrl: string }>(res, 'Could not upload the food image.');
  },

  async getAdminVendorApplication(accessToken: string, id: string) {
    const res = await fetch(`/api/admin/vendor-applications/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    });
    const data = await readAdminJson<{ success: true; application: Record<string, unknown>; history: Array<Record<string, unknown>> }>(res, 'Could not load application details.');
    return data as { success: true; application: Record<string, unknown>; history: Array<Record<string, unknown>> };
  },

  async reviewAdminVendorApplication(
    accessToken: string,
    id: string,
    action: 'under_review' | 'approve' | 'reject' | 'request_information',
    reason: string
  ) {
    const res = await fetch(`/api/admin/vendor-applications/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason })
    });
    const data = await readAdminJson<{ success: true; application: { id: string; status: string; updated_at: string } }>(res, 'Could not update the application.');
    return data as { success: true; application: { id: string; status: string; updated_at: string } };
  },

  /**
   * Submit contact inquiry
   */
  async submitContact(payload: ContactMessagePayload): Promise<ApiResponse> {
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Could not send your message.'
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: 'Server is currently unreachable. Please try again shortly.'
      };
    }
  }
};

export type VendorMenuItem = { id: string; name: string; description: string; price_ngn: number; category: string; image_url: string | null; available: boolean; created_at: string; updated_at: string };
export type VendorBusiness = { id: string; business_name: string; contact_name: string; phone: string; email: string | null; market_area: string; neighborhood: string; street_address: string | null; nearby_landmark: string | null; delivery_coverage: string[]; business_type: string; fulfillment_options: string; delivery_fee_ngn: number | null; status: string; description: string | null; opening_hours: Record<string, { open: string; close: string; closed: boolean }> | null; accepting_orders: boolean; review_reason?: string | null; menu: VendorMenuItem[] };
export type PublicMenuItem = Pick<VendorMenuItem, 'id' | 'name' | 'description' | 'price_ngn' | 'category' | 'image_url'> & { available: true };
export type PublicVendorBusiness = Pick<VendorBusiness, 'id' | 'business_name' | 'market_area' | 'neighborhood' | 'street_address' | 'nearby_landmark' | 'delivery_coverage' | 'business_type' | 'fulfillment_options' | 'delivery_fee_ngn' | 'accepting_orders'> & { description: string; opening_hours: NonNullable<VendorBusiness['opening_hours']>; menu: PublicMenuItem[] };
export type PublicVendorListResponse = { success: true; vendors: PublicVendorBusiness[]; total: number; status: 'empty' | 'available'; message: string };
export type VendorProfileInput = { businessName: string; businessType: string; contactName: string; phone: string; email: string | null; description: string; marketArea: string; neighborhood: string; streetAddress: string; nearbyLandmark: string; deliveryCoverage: string[]; openingHours: Record<string, { open: string; close: string; closed: boolean }>; fulfillmentOptions: string; deliveryFeeNgn: number | null };
export type VendorMenuInput = { name: string; description: string; priceNgn: number; category: string; imageUrl: string | null; available: boolean };
export type CustomerOrderItem = { id: string; menu_item_id: string | null; item_name: string; quantity: number; unit_price_ngn: number; line_total_ngn: number };
export type CustomerOrder = { id: string; order_reference: string; vendor_interest_id: string; customer_name: string; customer_phone: string; fulfillment_method: 'pickup' | 'vendor_delivery'; delivery_address: string | null; subtotal_ngn: number; delivery_fee_ngn: number | null; total_ngn: number; status: string; payment_status: string; is_test_order: boolean; created_at: string; updated_at: string; accepted_at: string | null; rejected_at: string | null; preparing_at: string | null; ready_at: string | null; out_for_delivery_at: string | null; completed_at: string | null; vendor?: { business_name: string; neighborhood: string }; items: CustomerOrderItem[] };
