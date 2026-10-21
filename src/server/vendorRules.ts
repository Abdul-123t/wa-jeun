export const MENU_CATEGORIES = ['rice', 'swallow', 'soup', 'grills', 'fast_food', 'snacks', 'drinks', 'other'] as const;
export const FULFILLMENT_OPTIONS = ['pickup_only', 'vendor_delivery', 'pickup_and_delivery', 'delivery_varies'] as const;
export const BUSINESS_TYPES = ['restaurant', 'local_buka', 'fast_food', 'grill_shawarma', 'bakery_snacks', 'other'] as const;

export type OpeningHours = Record<string, { open: string; close: string; closed: boolean }>;

export function isVendorSellEligible(input: {
  status: string;
  business_name: string | null;
  neighborhood: string | null;
  business_type: string | null;
  fulfillment_options: string | null;
  description: string | null;
  opening_hours: OpeningHours | null;
  accepting_orders: boolean;
  available_menu_items: number;
}): boolean {
  return input.status === 'approved' && Boolean(input.business_name?.trim() && input.business_name.trim().length >= 2) && Boolean(input.neighborhood?.trim() && input.neighborhood.trim().length >= 2) &&
    Boolean(input.business_type && BUSINESS_TYPES.includes(input.business_type as typeof BUSINESS_TYPES[number])) &&
    Boolean(input.fulfillment_options && FULFILLMENT_OPTIONS.includes(input.fulfillment_options as typeof FULFILLMENT_OPTIONS[number])) &&
    Boolean(input.description && input.description.trim().length >= 20) && validateOpeningHours(input.opening_hours) &&
    input.accepting_orders === true && Number.isInteger(input.available_menu_items) && input.available_menu_items > 0;
}

export function canManageMenu(status: string): boolean {
  return status === 'approved';
}

/** Return a customer-safe setup issue before an approved business opens ordering. */
export type VendorOrderReadinessInput = {
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  market_area: string | null;
  neighborhood: string | null;
  street_address: string | null;
  nearby_landmark: string | null;
  delivery_coverage: string[] | null;
  business_type: string | null;
  fulfillment_options: string | null;
  delivery_fee_ngn: number | string | null;
  description: string | null;
  opening_hours: OpeningHours | null;
};

export function validateVendorProfileReadiness(input: VendorOrderReadinessInput): string | null {
  if (!input.business_name?.trim() || input.business_name.trim().length < 2 || !input.contact_name?.trim() || input.contact_name.trim().length < 2 || !input.phone?.trim()) return 'Complete your business name and contact details before accepting orders.';
  if (!['ijebu-ode', 'ijagun'].includes(input.market_area || '') || !input.neighborhood?.trim() || input.neighborhood.trim().length < 2 || !input.street_address?.trim() || input.street_address.trim().length < 3 || !input.nearby_landmark?.trim() || input.nearby_landmark.trim().length < 2 || !BUSINESS_TYPES.includes(input.business_type as typeof BUSINESS_TYPES[number])) return 'Complete your business location and category before accepting orders.';
  if (!input.description?.trim() || input.description.trim().length < 20 || !validateOpeningHours(input.opening_hours)) return 'Complete your storefront description and opening hours before accepting orders.';
  if (!FULFILLMENT_OPTIONS.includes(input.fulfillment_options as typeof FULFILLMENT_OPTIONS[number]) || input.fulfillment_options === 'delivery_varies') return 'Choose pickup or a supported fixed delivery option before accepting orders.';
  if (['vendor_delivery', 'pickup_and_delivery'].includes(input.fulfillment_options || '')) {
    const fee = input.delivery_fee_ngn === null ? null : Number(input.delivery_fee_ngn);
    if (!Array.isArray(input.delivery_coverage) || input.delivery_coverage.length === 0 || input.delivery_coverage.some(area => !['ijebu-ode', 'ijagun'].includes(area)) || fee === null || !Number.isFinite(fee) || fee < 0) return 'Set your actual delivery coverage and a fixed delivery fee before accepting orders.';
  }
  return null;
}

export function validateVendorOrderReadiness(input: VendorOrderReadinessInput, availableMenuItems: number): string | null {
  const profileIssue = validateVendorProfileReadiness(input);
  if (profileIssue) return profileIssue;
  if (!Number.isInteger(availableMenuItems) || availableMenuItems < 1) return 'Add at least one available menu item before accepting orders.';
  return null;
}

export function validateMenuItem(input: Record<string, unknown>): string | null {
  if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 120) return 'Item name must be 2 to 120 characters.';
  if (typeof input.description !== 'string' || input.description.trim().length > 1000) return 'Item description must be 1,000 characters or fewer.';
  if (typeof input.priceNgn !== 'number' || !Number.isFinite(input.priceNgn) || input.priceNgn <= 0 || input.priceNgn > 10000000 || Math.round(input.priceNgn * 100) !== input.priceNgn * 100) return 'Enter a valid price in NGN, up to two decimal places.';
  if (typeof input.category !== 'string' || !MENU_CATEGORIES.includes(input.category as typeof MENU_CATEGORIES[number])) return 'Choose a valid food category.';
  if (input.available !== undefined && typeof input.available !== 'boolean') return 'Availability must be true or false.';
  if (input.imageUrl !== undefined && input.imageUrl !== null && (typeof input.imageUrl !== 'string' || input.imageUrl.length > 1000)) return 'Choose a valid food image.';
  return null;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validateOpeningHours(value: unknown): value is OpeningHours {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const hours = value as Record<string, any>;
  return DAYS.every(day => hours[day] && typeof hours[day].closed === 'boolean' &&
    (hours[day].closed || (typeof hours[day].open === 'string' && TIME.test(hours[day].open) && typeof hours[day].close === 'string' && TIME.test(hours[day].close) && hours[day].open < hours[day].close))) &&
    DAYS.some(day => hours[day]?.closed === false);
}

export function isOwnedMenuItem(itemBusinessId: string, requestedBusinessId: string): boolean {
  return itemBusinessId === requestedBusinessId;
}

export function isVendorOwner(authenticatedUserId: string, recordOwnerUserId: string | null): boolean {
  return Boolean(recordOwnerUserId && authenticatedUserId === recordOwnerUserId);
}

export function isTrustedMenuImageUrl(value: unknown, supabaseUrl: string): boolean {
  if (typeof value !== 'string') return false;
  try {
    const base = new URL(supabaseUrl);
    const image = new URL(value);
    const basePath = base.pathname.replace(/\/+$/, '');
    return image.origin === base.origin && !image.username && !image.password && !image.search && !image.hash &&
      image.pathname.startsWith(`${basePath}/storage/v1/object/public/vendor-menu-images/`);
  } catch {
    return false;
  }
}
