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
