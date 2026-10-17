export type ContactMethod = 'phone' | 'email';

export type BusinessType = 
  | 'restaurant'
  | 'local_buka'
  | 'fast_food'
  | 'grill_shawarma'
  | 'bakery_snacks'
  | 'other';

export type FulfillmentOption = 
  | 'pickup_only'
  | 'vendor_delivery'
  | 'pickup_and_delivery'
  | 'delivery_varies';

export type OrderingMethod = 
  | 'walk_in'
  | 'phone_calls'
  | 'whatsapp'
  | 'existing_delivery'
  | 'other';

export interface CustomerInterestPayload {
  name: string;
  contactMethod: ContactMethod;
  phone?: string;
  email?: string;
  neighborhood: string;
  favoriteCategories?: string[];
  consentAccepted: boolean;
}

export interface VendorInterestPayload {
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  neighborhood: string;
  businessType: BusinessType;
  currentOrderingMethods: OrderingMethod[];
  fulfillmentOptions: FulfillmentOption;
  message?: string;
  consentAccepted: boolean;
}

export interface ContactMessagePayload {
  name: string;
  contactInfo: string;
  subject: string;
  message: string;
  consentAccepted: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  registrationId?: string;
}

export interface SystemHealthResponse {
  status: string;
  market: string;
  stage: string;
  storageMode: string;
  counts: {
    registeredCustomers: number;
    registeredVendors: number;
  };
  message: string;
}

export interface FoodCategory {
  id: string;
  name: string;
  description: string;
  image: string;
  popularItems: string[];
}
