import { canonicalOrderIntent, type OrderIntent } from '../utils/orderIntent';

const STORAGE_PREFIX = 'wa-jeun-checkout-attempt-v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoredCheckoutAttempt = { idempotencyKey: string; fingerprint: string };

export async function checkoutIntentFingerprint(intent: OrderIntent): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalOrderIntent(intent));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function storageKey(customerId: string) {
  return `${STORAGE_PREFIX}${customerId}`;
}

export function readCheckoutAttempt(customerId: string): StoredCheckoutAttempt | null {
  try {
    const value = globalThis.localStorage.getItem(storageKey(customerId));
    if (!value) return null;
    const attempt = JSON.parse(value) as Partial<StoredCheckoutAttempt>;
    return typeof attempt.idempotencyKey === 'string' && UUID.test(attempt.idempotencyKey) &&
      typeof attempt.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(attempt.fingerprint)
      ? { idempotencyKey: attempt.idempotencyKey, fingerprint: attempt.fingerprint }
      : null;
  } catch {
    return null;
  }
}

export function persistCheckoutAttempt(customerId: string, attempt: StoredCheckoutAttempt): void {
  globalThis.localStorage.setItem(storageKey(customerId), JSON.stringify(attempt));
}

export function clearCheckoutAttempt(customerId: string, idempotencyKey: string): void {
  const current = readCheckoutAttempt(customerId);
  if (current?.idempotencyKey !== idempotencyKey) return;
  try { globalThis.localStorage.removeItem(storageKey(customerId)); } catch { /* Storage cleanup is best-effort after a confirmed order. */ }
}
