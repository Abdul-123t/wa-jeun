import {
  CustomerInterestPayload,
  VendorInterestPayload,
  ContactMessagePayload,
  ApiResponse,
  SystemHealthResponse
} from '../types';

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
   * Search and filter food vendors (0 at pre-launch)
   */
  async getVendors(params?: { category?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`/api/vendors?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to query vendors: ${res.statusText}`);
    }
    return await res.json();
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
  async registerVendor(payload: VendorInterestPayload): Promise<ApiResponse> {
    try {
      const res = await fetch('/api/interest/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
