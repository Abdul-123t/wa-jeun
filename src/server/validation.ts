/**
 * WA JEUN Input Validation and Normalization Utilities
 * Market: Ijebu Ode, Ogun State, Nigeria
 */

/**
 * Normalizes Nigerian phone numbers to standard E.164 (+234...) format.
 * Handles variations such as:
 * - 0803 123 4567 -> +2348031234567
 * - +234 803 123 4567 -> +2348031234567
 * - 2348031234567 -> +2348031234567
 * - 0803-123-4567 -> +2348031234567
 */
export function normalizeNigerianPhone(phone: string): string | null {
  if (!phone || typeof phone !== 'string') return null;

  // Strip all whitespace, hyphens, parentheses, dots
  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  // If starts with +234
  if (cleaned.startsWith('+234')) {
    cleaned = cleaned.substring(1); // remove + for digit length check
  } else if (cleaned.startsWith('234')) {
    // already starts with 234
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // 08031234567 -> 2348031234567
    cleaned = '234' + cleaned.substring(1);
  } else if (cleaned.length === 10 && /^[789][01]\d{8}$/.test(cleaned)) {
    // 8031234567 -> 2348031234567
    cleaned = '234' + cleaned;
  }

  // Validate Nigerian pattern: 234 followed by 70, 80, 81, 90, 91, 71, etc.
  // Nigerian mobile numbers are 234 + 10 digits
  const nigerianRegex = /^234[789][01]\d{8}$/;
  if (nigerianRegex.test(cleaned)) {
    return '+' + cleaned;
  }

  // Allow general valid international phone (min 10 digits, max 15 digits)
  if (/^\+?\d{10,15}$/.test(cleaned)) {
    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }

  return null;
}

/**
 * Normalizes email address by trimming and lowercasing.
 */
export function normalizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  const cleaned = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (cleaned.length > 255 || !emailRegex.test(cleaned)) {
    return null;
  }
  return cleaned;
}

/**
 * Sanitizes plain text inputs by removing leading/trailing whitespaces
 * and limiting maximum length.
 */
export function sanitizeText(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') return '';
  return text.trim().substring(0, maxLength);
}

/**
 * Redacts PII for safe application logging without recording personal data.
 */
export function redactPii(value: string | null | undefined): string {
  if (!value) return '[NONE]';
  const str = String(value).trim();
  if (str.includes('@')) {
    const parts = str.split('@');
    const name = parts[0];
    const masked = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
    return `${masked}@${parts[1]}`;
  }
  if (str.length >= 7) {
    return `${str.substring(0, 4)}****${str.substring(str.length - 3)}`;
  }
  return '***';
}

export const VALID_BUSINESS_TYPES = [
  'restaurant',
  'local_buka',
  'fast_food',
  'grill_shawarma',
  'bakery_snacks',
  'other'
] as const;

export const VALID_FULFILLMENT_OPTIONS = [
  'pickup_only',
  'vendor_delivery',
  'pickup_and_delivery',
  'delivery_varies'
] as const;

export const VALID_ORDERING_METHODS = [
  'walk_in',
  'phone_calls',
  'whatsapp',
  'existing_delivery',
  'other'
] as const;
