import { timingSafeEqual } from 'node:crypto';
import { isProductionRuntime } from './runtimeMode';

const FLUTTERWAVE_API = 'https://api.flutterwave.com/v3';
const CHECKOUT_HOST = 'checkout.flutterwave.com';

export type FlutterwaveStatus = 'successful' | 'failed' | 'cancelled';
export type VerifiedFlutterwaveTransaction = {
  id: string;
  tx_ref: string;
  status: FlutterwaveStatus | string;
  currency: string;
  amount: number;
};

export function classifyFlutterwaveReplay(payment: { status: string; transactionId: string | null }, incomingTransactionId: string): 'process' | 'duplicate' | 'conflict' {
  const terminal = ['successful', 'failed', 'cancelled', 'mismatched', 'init_failed'];
  if (!terminal.includes(payment.status)) return 'process';
  return payment.transactionId === incomingTransactionId ? 'duplicate' : 'conflict';
}

export function isFlutterwaveTestMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.FLW_SECRET_KEY?.trim() || '';
  return env.FLW_MODE === 'test' && env.NODE_ENV === 'development' && !isProductionRuntime(env) &&
    /^FLWSECK_TEST-[A-Za-z0-9_-]+$/.test(secret) && Boolean(env.FLW_SECRET_HASH?.trim());
}

export function isFlutterwaveReference(value: unknown): value is string {
  return typeof value === 'string' && /^WJTEST-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function verifyFlutterwaveWebhookHash(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const actualBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function toKobo(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const kobo = Math.round(value * 100);
  return Number.isSafeInteger(kobo) && kobo / 100 === value ? kobo : null;
}

export function validateVerifiedFlutterwaveTransaction(
  transaction: VerifiedFlutterwaveTransaction,
  expected: { txRef: string; amountNgn: number; currency: string }
): { success: true; status: FlutterwaveStatus; transactionId: string } | { success: false; reason: 'invalid_reference' | 'invalid_status' | 'currency_mismatch' | 'amount_mismatch' | 'invalid_transaction' } {
  if (!isFlutterwaveReference(expected.txRef) || transaction.tx_ref !== expected.txRef) return { success: false, reason: 'invalid_reference' };
  if (!/^\d{1,20}$/.test(transaction.id)) return { success: false, reason: 'invalid_transaction' };
  if (transaction.status !== 'successful' && transaction.status !== 'failed' && transaction.status !== 'cancelled') return { success: false, reason: 'invalid_status' };
  if (transaction.status !== 'successful') return { success: true, status: transaction.status, transactionId: transaction.id };
  if (transaction.currency !== 'NGN' || expected.currency !== 'NGN') return { success: false, reason: 'currency_mismatch' };
  const paidKobo = toKobo(transaction.amount);
  const expectedKobo = toKobo(expected.amountNgn);
  if (paidKobo === null || expectedKobo === null || paidKobo !== expectedKobo) return { success: false, reason: 'amount_mismatch' };
  return { success: true, status: transaction.status, transactionId: transaction.id };
}

function flutterwaveSecret(env: NodeJS.ProcessEnv): string {
  if (!isFlutterwaveTestMode(env)) throw new Error('Flutterwave sandbox checkout is not configured.');
  return env.FLW_SECRET_KEY!.trim();
}

export async function initializeFlutterwaveStandard(input: {
  txRef: string; amountNgn: number; customerName: string; customerEmail: string; customerPhone: string; redirectUrl: string;
}, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): Promise<{ link: string }> {
  let redirect: URL;
  try { redirect = new URL(input.redirectUrl); } catch { throw new Error('The sandbox checkout details are invalid.'); }
  const secureRedirect = redirect.protocol === 'https:' || (redirect.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname));
  if (!isFlutterwaveReference(input.txRef) || toKobo(input.amountNgn) === null || !secureRedirect || redirect.username || redirect.password) {
    throw new Error('The sandbox checkout details are invalid.');
  }
  const response = await fetcher(`${FLUTTERWAVE_API}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${flutterwaveSecret(env)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: input.amountNgn.toFixed(2),
      currency: 'NGN',
      redirect_url: input.redirectUrl,
      customer: { name: input.customerName, email: input.customerEmail, phonenumber: input.customerPhone },
      customizations: { title: 'wá jẹun test checkout', description: 'Sandbox transaction only' },
      configurations: { session_duration: 30, max_retry_attempt: 3 }
    }),
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => null) as { status?: unknown; data?: { link?: unknown } } | null;
  const link = payload?.data?.link;
  if (!response.ok || payload?.status !== 'success' || typeof link !== 'string') throw new Error('Flutterwave could not start the sandbox checkout.');
  let parsedLink: URL;
  try { parsedLink = new URL(link); } catch { throw new Error('Flutterwave returned an invalid checkout link.'); }
  if (parsedLink.protocol !== 'https:' || parsedLink.hostname !== CHECKOUT_HOST || parsedLink.username || parsedLink.password) throw new Error('Flutterwave returned an invalid checkout link.');
  return { link: parsedLink.toString() };
}

export async function verifyFlutterwaveTransaction(transactionId: string, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): Promise<VerifiedFlutterwaveTransaction> {
  if (!/^\d{1,20}$/.test(transactionId)) throw new Error('Invalid Flutterwave transaction ID.');
  const response = await fetcher(`${FLUTTERWAVE_API}/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${flutterwaveSecret(env)}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => null) as { status?: unknown; data?: Record<string, unknown> } | null;
  const data = payload?.data;
  if (!response.ok || payload?.status !== 'success' || !data) throw new Error('Flutterwave transaction could not be verified.');
  const id = typeof data.id === 'number' && Number.isSafeInteger(data.id) ? String(data.id) : typeof data.id === 'string' ? data.id : '';
  if (id !== transactionId || typeof data.tx_ref !== 'string' || typeof data.status !== 'string' || typeof data.currency !== 'string' || typeof data.amount !== 'number') {
    throw new Error('Flutterwave returned an invalid transaction verification response.');
  }
  return { id, tx_ref: data.tx_ref, status: data.status, currency: data.currency, amount: data.amount };
}
