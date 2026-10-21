import 'dotenv/config';
import express, { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  normalizeNigerianPhone,
  normalizeEmail,
  sanitizeText,
  redactPii,
  VALID_BUSINESS_TYPES,
  VALID_FULFILLMENT_OPTIONS,
  VALID_ORDERING_METHODS
} from './src/server/validation';
import { createRateLimiter } from './src/server/rateLimiter';
import { configureClientIpTrust } from './src/server/clientIp';
import {
  insertCustomerInterest,
  insertVendorInterest,
  insertContactInquiry,
  getVerifiedVendors,
  getPublicVendorMenu,
  getHealthStats,
  getStorageMode,
  verifySupabaseAccessToken,
  getVendorApplicationsForUser,
  isAdminUser,
  getAdminVendorApplications,
  getAdminVendorApplication,
  reviewVendorApplication,
  VendorReviewAction,
  getVendorDashboard,
  updateVendorProfile,
  setVendorAvailability,
  saveVendorMenuItem,
  deleteVendorMenuItem,
  uploadVendorMenuImage,
  createCustomerOrder,
  prepareFlutterwaveTestPayment,
  saveFlutterwaveTestCheckoutUrl,
  failFlutterwaveTestPaymentInitialization,
  getFlutterwaveTestPayment,
  completeFlutterwaveTestPayment,
  getCustomerOrderAttempt,
  getCustomerOrders,
  getVendorOrders,
  transitionVendorOrder
} from './src/server/db';
import { authorizeAdminHeader, parseBearerAuthorization } from './src/server/authTokens';
import { FULFILLMENT_OPTIONS, MENU_CATEGORIES, isTrustedMenuImageUrl, validateMenuItem, validateOpeningHours } from './src/server/vendorRules';
import { createOrderRequestFingerprint, parseCheckoutLines, validateCheckoutContact, validateFulfillment } from './src/server/orderRules';
import { isProductionRuntime } from './src/server/runtimeMode';
import { isMarketAreaId } from './src/data/marketAreas';
import { classifyFlutterwaveReplay, initializeFlutterwaveStandard, isFlutterwaveReference, isFlutterwaveTestMode, validateVerifiedFlutterwaveTransaction, verifyFlutterwaveTransaction, verifyFlutterwaveWebhookHash } from './src/server/flutterwave';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
// Vercel's Node runtime imports the existing Express app as a function. The
// guarded listener below remains available for local and conventional hosts.
export default app;
configureClientIpTrust(app, process.env);
const PORT = Number(process.env.PORT) || 3000;
const isProduction = isProductionRuntime();
const isDevelopment = process.env.NODE_ENV === 'development' && !isProduction;

function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { void handler(req, res).catch(next); };
}

async function authorizeAdminRequest(req: Request): Promise<
  { userId: string; error?: never; statusCode?: never } |
  { userId?: never; error: string; statusCode: number }
> {
  return authorizeAdminHeader(req.get('authorization'), verifySupabaseAccessToken, isAdminUser);
}

async function verifiedVendorUser(req: Request) {
  const authorization = parseBearerAuthorization(req.get('authorization'));
  if (!authorization.token) return { error: 'Sign in to manage your business.', statusCode: 401 } as const;
  const verified = await verifySupabaseAccessToken(authorization.token);
  if (!verified.success || !verified.data) return { error: verified.error || 'Your session is invalid or expired.', statusCode: verified.statusCode || 401 } as const;
  return { userId: verified.data.userId } as const;
}

async function verifiedCustomerUser(req: Request) {
  const authorization = parseBearerAuthorization(req.get('authorization'));
  if (!authorization.token) return { error: 'Sign in to continue.', statusCode: 401 } as const;
  const verified = await verifySupabaseAccessToken(authorization.token);
  if (!verified.success || !verified.data) return { error: verified.error || 'Your session is invalid or expired.', statusCode: verified.statusCode || 401 } as const;
  return { userId: verified.data.userId } as const;
}

// Security: Enforce tight request body size limit (50kb for form submissions)
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Abuse prevention limits are independent by endpoint and shared across
// instances only when a shared store is added; see deployment documentation.
const createSubmissionLimiter = (key: string) => createRateLimiter({
  key,
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: 'Too many submissions from this connection. Please wait a few minutes before trying again.'
});
const customerOrderLimiter = createSubmissionLimiter('customer-orders');
const flutterwaveTestCheckoutLimiter = createSubmissionLimiter('flutterwave-test-checkout');
const customerInterestLimiter = createSubmissionLimiter('customer-interest');
const vendorApplicationLimiter = createSubmissionLimiter('vendor-applications');
const contactInquiryLimiter = createSubmissionLimiter('contact-inquiries');

// 1. Health check & configuration status
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const stats = await getHealthStats();
    const message = stats.status !== 'online'
      ? 'Database health check is temporarily unavailable.'
      : stats.storageMode === 'dev-local-json'
        ? 'Backend is operating with local development storage.'
        : 'wá jẹun backend is operating with persistent database storage.';
    res.json({
      status: stats.status,
      market: 'Ijebu Ode, Ogun State, Nigeria',
      stage: 'pre-launch-mvp',
      storageMode: stats.storageMode,
      counts: {
        registeredCustomers: stats.registeredCustomers,
        registeredVendors: stats.registeredVendors
      },
      message
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      market: 'Ijebu Ode, Ogun State, Nigeria',
      stage: 'pre-launch-mvp',
      storageMode: getStorageMode(),
      message: 'Service health check encountered an internal error.'
    });
  }
});

// Every admin API request independently verifies the Supabase token and checks
// server-side admin membership. No browser-supplied identity or role is used.
app.get('/api/admin/access', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await authorizeAdminRequest(req);
  if (!authorization.userId) {
    return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  }
  return res.json({ success: true, isAdmin: true });
}));

app.get('/api/admin/vendor-applications', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await authorizeAdminRequest(req);
  if (!authorization.userId) {
    return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  }

  const result = await getAdminVendorApplications();
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });

  const allowedStatuses = new Set(['pending_review', 'under_review', 'contacted', 'approved', 'declined']);
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  if (status !== 'all' && !allowedStatuses.has(status)) {
    return res.status(400).json({ success: false, error: 'Choose a valid application status filter.' });
  }
  const search = typeof req.query.search === 'string' ? sanitizeText(req.query.search, 100).toLocaleLowerCase() : '';
  const applications = (result.data || []).filter(application =>
    (status === 'all' || application.status === status) &&
    (!search || `${application.business_name} ${application.market_area} ${application.neighborhood} ${application.street_address || ''} ${application.nearby_landmark || ''} ${application.business_type}`.toLocaleLowerCase().includes(search))
  );
  return res.json({ success: true, applications });
}));

// Vendor dashboard data is always scoped to the Supabase identity verified here.
app.get('/api/vendor/dashboard', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  const result = await getVendorDashboard(authorization.userId);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, businesses: result.data });
}));

app.patch('/api/vendor/businesses/:businessId/profile', asyncRoute(async (req: Request, res: Response) => {
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  const { businessName, businessType, contactName, phone, email, description, marketArea, neighborhood, streetAddress, nearbyLandmark, deliveryCoverage, openingHours, fulfillmentOptions, deliveryFeeNgn } = req.body || {};
  const cleanBusinessName = sanitizeText(businessName, 200);
  const cleanContactName = sanitizeText(contactName, 150);
  const normalizedPhone = normalizeNigerianPhone(phone);
  const normalizedEmail = email ? normalizeEmail(email) : null;
  const cleanDescription = sanitizeText(description, 1000);
  const cleanNeighborhood = sanitizeText(neighborhood, 150);
  const cleanMarketArea = isMarketAreaId(marketArea) ? marketArea : null;
  const cleanStreetAddress = sanitizeText(streetAddress, 250);
  const cleanNearbyLandmark = sanitizeText(nearbyLandmark, 250);
  const cleanDeliveryCoverage = Array.isArray(deliveryCoverage) && deliveryCoverage.every(isMarketAreaId) ? [...new Set(deliveryCoverage)] : null;
  if (cleanBusinessName.length < 2 || !VALID_BUSINESS_TYPES.includes(businessType) || cleanContactName.length < 2 || !normalizedPhone || (email && !normalizedEmail) || cleanDescription.length < 20 || !cleanMarketArea || !cleanNeighborhood || cleanStreetAddress.length < 3 || cleanNearbyLandmark.length < 2 || cleanDeliveryCoverage === null || (['vendor_delivery', 'pickup_and_delivery'].includes(fulfillmentOptions) && cleanDeliveryCoverage.length === 0) || !validateOpeningHours(openingHours) || !FULFILLMENT_OPTIONS.includes(fulfillmentOptions) || (deliveryFeeNgn !== null && deliveryFeeNgn !== undefined && (typeof deliveryFeeNgn !== 'number' || !Number.isFinite(deliveryFeeNgn) || deliveryFeeNgn < 0 || deliveryFeeNgn > 10000000 || Math.round(deliveryFeeNgn * 100) !== deliveryFeeNgn * 100))) {
    return res.status(400).json({ success: false, error: 'Check the business name, category, contact details, description, neighborhood, hours, fulfillment option and delivery fee.' });
  }
  const result = await updateVendorProfile(authorization.userId, req.params.businessId, { businessName: cleanBusinessName, businessType, contactName: cleanContactName, phone: normalizedPhone, email: normalizedEmail, description: cleanDescription, marketArea: cleanMarketArea, neighborhood: cleanNeighborhood, streetAddress: cleanStreetAddress, nearbyLandmark: cleanNearbyLandmark, deliveryCoverage: cleanDeliveryCoverage, openingHours, fulfillmentOptions, deliveryFeeNgn: deliveryFeeNgn ?? null });
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, business: result.data });
}));

app.get('/api/customer/orders', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await verifiedCustomerUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  const result = await getCustomerOrders(authorization.userId);
  if (!result.success) {
    console.error('[WA JEUN API] GET /api/customer/orders failed.', { status: result.statusCode || 503, category: 'order_history_query_failed' });
    return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  }
  return res.json({ success: true, orders: result.data });
}));

app.get('/api/customer/orders/attempt/:key', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await verifiedCustomerUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.key)) return res.status(400).json({ success: false, error: 'Checkout attempt is invalid.' });
  const result = await getCustomerOrderAttempt(authorization.userId, req.params.key);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  if (!result.data) return res.status(404).json({ success: false, error: 'No saved order was found for this attempt.' });
  return res.json({ success: true, order: result.data });
}));

app.post('/api/customer/orders', customerOrderLimiter, asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await verifiedCustomerUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  if (!isDevelopment) return res.status(503).json({ success: false, error: 'Real checkout is not enabled. Development test orders are available only when NODE_ENV=development; payment, settlement, refunds, and collection policies must be configured before production orders can be accepted.' });
  const lines = parseCheckoutLines(req.body?.items);
  if (!lines.success) return res.status(400).json({ success: false, error: lines.error });
  const contact = validateCheckoutContact(req.body?.customerName, req.body?.customerPhone);
  if (!contact.success) return res.status(400).json({ success: false, error: contact.error });
  const fulfillment = validateFulfillment(req.body?.fulfillmentMethod, req.body?.deliveryAddress, ['pickup_only', 'vendor_delivery', 'pickup_and_delivery']);
  if (!fulfillment.success) return res.status(400).json({ success: false, error: fulfillment.error });
  if (typeof req.body?.idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.body.idempotencyKey)) return res.status(400).json({ success: false, error: 'Refresh checkout and try again.' });
  if (typeof req.body?.expectedDeliveryFeeNgn !== 'number' && req.body?.expectedDeliveryFeeNgn !== null) return res.status(400).json({ success: false, error: 'Refresh checkout and review the delivery fee.' });
  const expectedFee = fulfillment.fulfillmentMethod === 'pickup' ? null : req.body.expectedDeliveryFeeNgn;
  if (expectedFee !== null && (!Number.isFinite(expectedFee) || expectedFee < 0 || expectedFee > 10000000 || Math.round(expectedFee * 100) !== expectedFee * 100)) return res.status(400).json({ success: false, error: 'Refresh checkout and review the delivery fee.' });
  if (fulfillment.fulfillmentMethod === 'vendor_delivery' && expectedFee === null) return res.status(400).json({ success: false, error: 'This business has not configured a delivery fee. Choose pickup or contact the business.' });
  const fingerprint = createOrderRequestFingerprint({ customerUserId: authorization.userId, customerName: contact.customerName, customerPhone: contact.customerPhone,
    fulfillmentMethod: fulfillment.fulfillmentMethod as 'pickup' | 'vendor_delivery', deliveryAddress: fulfillment.deliveryAddress, expectedDeliveryFeeNgn: expectedFee, lines: lines.lines as Array<{ menuItemId: string; quantity: number; expectedPriceNgn: number }> });
  const result = await createCustomerOrder({ customerUserId: authorization.userId, customerName: contact.customerName, customerPhone: contact.customerPhone,
    fulfillmentMethod: fulfillment.fulfillmentMethod as 'pickup' | 'vendor_delivery', deliveryAddress: fulfillment.deliveryAddress, lines: lines.lines,
    idempotencyKey: req.body.idempotencyKey, requestFingerprint: fingerprint, expectedDeliveryFeeNgn: expectedFee, isTestOrder: true });
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.status(result.data.created ? 201 : 200).json({ success: true, order: result.data });
}));

app.post('/api/customer/orders/flutterwave-test', flutterwaveTestCheckoutLimiter, asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await verifiedCustomerUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  if (!isDevelopment || !isFlutterwaveTestMode()) return res.status(503).json({ success: false, error: 'Flutterwave sandbox checkout is available only in a configured local development environment.' });

  const lines = parseCheckoutLines(req.body?.items);
  if (!lines.success) return res.status(400).json({ success: false, error: lines.error });
  const contact = validateCheckoutContact(req.body?.customerName, req.body?.customerPhone);
  if (!contact.success) return res.status(400).json({ success: false, error: contact.error });
  const customerEmail = typeof req.body?.customerEmail === 'string' ? normalizeEmail(req.body.customerEmail) : null;
  if (!customerEmail) return res.status(400).json({ success: false, error: 'Enter a valid email address for Flutterwave test checkout.' });
  const fulfillment = validateFulfillment(req.body?.fulfillmentMethod, req.body?.deliveryAddress, ['pickup_only', 'vendor_delivery', 'pickup_and_delivery']);
  if (!fulfillment.success) return res.status(400).json({ success: false, error: fulfillment.error });
  if (typeof req.body?.idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.body.idempotencyKey)) return res.status(400).json({ success: false, error: 'Refresh checkout and try again.' });
  if (typeof req.body?.expectedDeliveryFeeNgn !== 'number' && req.body?.expectedDeliveryFeeNgn !== null) return res.status(400).json({ success: false, error: 'Refresh checkout and review the delivery fee.' });
  const expectedFee = fulfillment.fulfillmentMethod === 'pickup' ? null : req.body.expectedDeliveryFeeNgn;
  if (expectedFee !== null && (!Number.isFinite(expectedFee) || expectedFee < 0 || expectedFee > 10000000 || Math.round(expectedFee * 100) !== expectedFee * 100)) return res.status(400).json({ success: false, error: 'Refresh checkout and review the delivery fee.' });
  if (fulfillment.fulfillmentMethod === 'vendor_delivery' && expectedFee === null) return res.status(400).json({ success: false, error: 'This business has not configured a delivery fee. Choose pickup or contact the business.' });

  const fingerprint = createOrderRequestFingerprint({ customerUserId: authorization.userId, customerName: contact.customerName, customerPhone: contact.customerPhone,
    fulfillmentMethod: fulfillment.fulfillmentMethod as 'pickup' | 'vendor_delivery', deliveryAddress: fulfillment.deliveryAddress, expectedDeliveryFeeNgn: expectedFee,
    lines: lines.lines as Array<{ menuItemId: string; quantity: number; expectedPriceNgn: number }> });
  const order = await createCustomerOrder({ customerUserId: authorization.userId, customerName: contact.customerName, customerPhone: contact.customerPhone,
    fulfillmentMethod: fulfillment.fulfillmentMethod as 'pickup' | 'vendor_delivery', deliveryAddress: fulfillment.deliveryAddress, lines: lines.lines,
    idempotencyKey: req.body.idempotencyKey, requestFingerprint: fingerprint, expectedDeliveryFeeNgn: expectedFee, isTestOrder: true });
  if (!order.success) return res.status(order.statusCode || 503).json({ success: false, error: order.error });

  const txRef = `WJTEST-${randomUUID()}`;
  const prepared = await prepareFlutterwaveTestPayment(order.data.id, authorization.userId, txRef, customerEmail);
  if (!prepared.success) return res.status(prepared.statusCode || 503).json({ success: false, error: prepared.error });
  if (prepared.data.status === 'successful') return res.status(409).json({ success: false, error: 'This sandbox order has already been paid. Check your order history.' });
  if (prepared.data.status === 'initializing') return res.status(409).json({ success: false, error: 'Sandbox checkout is already being prepared. Retry shortly.' });
  if (prepared.data.checkoutUrl) return res.json({ success: true, checkoutUrl: prepared.data.checkoutUrl, orderReference: order.data.orderReference, isTestOrder: true });

  let callbackUrl: string;
  try { callbackUrl = new URL('/api/payments/flutterwave/callback', process.env.APP_URL || 'http://localhost:3000').toString(); }
  catch { await failFlutterwaveTestPaymentInitialization(prepared.data.txRef); return res.status(503).json({ success: false, error: 'Sandbox callback URL is not configured.' }); }
  try {
    const hosted = await initializeFlutterwaveStandard({ txRef: prepared.data.txRef, amountNgn: prepared.data.amountNgn,
      customerName: contact.customerName, customerEmail, customerPhone: contact.customerPhone, redirectUrl: callbackUrl });
    const saved = await saveFlutterwaveTestCheckoutUrl(prepared.data.txRef, hosted.link);
    if (!saved.success) {
      await failFlutterwaveTestPaymentInitialization(prepared.data.txRef);
      return res.status(saved.statusCode || 503).json({ success: false, error: saved.error });
    }
    return res.json({ success: true, checkoutUrl: hosted.link, orderReference: order.data.orderReference, isTestOrder: true });
  } catch {
    await failFlutterwaveTestPaymentInitialization(prepared.data.txRef);
    console.error('[WA JEUN API] Flutterwave sandbox initialization failed.', { category: 'flutterwave_test_initialization' });
    return res.status(502).json({ success: false, error: 'Flutterwave could not start the test checkout. The order remains unpaid.' });
  }
}));

async function verifyAndStoreFlutterwaveResult(txRef: string, transactionId: string) {
  const stored = await getFlutterwaveTestPayment(txRef);
  if (!stored.success) return stored;
  const transaction = await verifyFlutterwaveTransaction(transactionId);
  const validation = validateVerifiedFlutterwaveTransaction(transaction, { txRef: stored.data.txRef, amountNgn: stored.data.amountNgn, currency: stored.data.currency });
  if (!validation.success && !['amount_mismatch', 'currency_mismatch'].includes(validation.reason)) {
    return { success: false as const, statusCode: 409, error: 'The verified transaction does not match this sandbox checkout.' };
  }
  const replay = classifyFlutterwaveReplay({ status: stored.data.status, transactionId: stored.data.transactionId }, transaction.id);
  if (replay === 'duplicate') return { success: true as const, orderId: stored.data.orderId, status: stored.data.status };
  if (replay === 'conflict') return { success: false as const, statusCode: 409, error: 'This sandbox payment reference is already closed.' };
  const result = await completeFlutterwaveTestPayment({ txRef: stored.data.txRef, transactionId: transaction.id,
    status: transaction.status as 'successful' | 'failed' | 'cancelled', amountNgn: transaction.amount, currency: transaction.currency });
  if (!result.success) return result;
  return { success: true as const, orderId: stored.data.orderId, status: result.data.status };
}

function checkoutReturnUrl(payment: 'return' | 'unavailable', orderReference?: string) {
  const target = new URL('/orders', process.env.APP_URL || 'http://localhost:3000');
  target.searchParams.set('payment', payment);
  if (orderReference) target.searchParams.set('placed', orderReference);
  return target.toString();
}

app.get('/api/payments/flutterwave/callback', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  if (!isDevelopment || !isFlutterwaveTestMode()) return res.status(503).json({ success: false, error: 'Sandbox payment callbacks are disabled outside local development.' });
  const txRef = req.query.tx_ref;
  const transactionId = req.query.transaction_id;
  if (!isFlutterwaveReference(txRef) || typeof transactionId !== 'string' || !/^\d{1,20}$/.test(transactionId)) return res.redirect(303, checkoutReturnUrl('unavailable'));
  const stored = await getFlutterwaveTestPayment(txRef);
  if (!stored.success) return res.redirect(303, checkoutReturnUrl('unavailable'));
  try {
    await verifyAndStoreFlutterwaveResult(txRef, transactionId);
    return res.redirect(303, checkoutReturnUrl('return', stored.data.orderReference));
  } catch {
    console.error('[WA JEUN API] Flutterwave callback verification failed.', { category: 'flutterwave_test_callback' });
    return res.redirect(303, checkoutReturnUrl('return', stored.data.orderReference));
  }
}));

app.post('/api/payments/flutterwave/webhook', asyncRoute(async (req: Request, res: Response) => {
  if (!isDevelopment || !isFlutterwaveTestMode()) return res.status(503).end();
  if (!verifyFlutterwaveWebhookHash(req.get('verif-hash'), process.env.FLW_SECRET_HASH)) return res.status(401).end();
  const rawId = req.body?.data?.id;
  const transactionId = typeof rawId === 'number' && Number.isSafeInteger(rawId) ? String(rawId) : typeof rawId === 'string' ? rawId : '';
  const txRef = req.body?.data?.tx_ref;
  if (!isFlutterwaveReference(txRef) || !/^\d{1,20}$/.test(transactionId)) return res.status(200).json({ received: true });
  try {
    const result = await verifyAndStoreFlutterwaveResult(txRef, transactionId);
    if (!result.success && result.statusCode === 503) return res.status(503).json({ received: false });
    return res.status(200).json({ received: true });
  } catch {
    console.error('[WA JEUN API] Flutterwave webhook verification failed.', { category: 'flutterwave_test_webhook' });
    return res.status(503).json({ received: false });
  }
}));

app.get('/api/vendor/orders', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  const businessId = typeof req.query.businessId === 'string' ? req.query.businessId : undefined;
  const result = await getVendorOrders(authorization.userId, businessId);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, orders: result.data });
}));

app.patch('/api/vendor/orders/:orderId/status', asyncRoute(async (req: Request, res: Response) => {
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.orderId)) return res.status(400).json({ success: false, error: 'Invalid order reference.' });
  const statuses = ['accepted', 'rejected', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed'];
  if (typeof req.body?.status !== 'string' || !statuses.includes(req.body.status)) return res.status(400).json({ success: false, error: 'Choose a supported order status.' });
  const result = await transitionVendorOrder(authorization.userId, req.params.orderId, req.body.status);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, order: result.data });
}));

app.patch('/api/vendor/businesses/:businessId/availability', asyncRoute(async (req: Request, res: Response) => {
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  if (typeof req.body?.acceptingOrders !== 'boolean') return res.status(400).json({ success: false, error: 'Choose whether your business is accepting orders.' });
  const result = await setVendorAvailability(authorization.userId, req.params.businessId, req.body.acceptingOrders);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, ...result.data });
}));

app.post('/api/vendor/businesses/:businessId/menu', asyncRoute(async (req: Request, res: Response) => {
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  const issue = validateMenuItem(req.body || {});
  if (issue) return res.status(400).json({ success: false, error: issue });
  if (req.body.imageUrl && !isTrustedMenuImageUrl(req.body.imageUrl, process.env.SUPABASE_URL || '')) return res.status(400).json({ success: false, error: 'Food images must use the wá jẹun menu image upload.' });
  const result = await saveVendorMenuItem(authorization.userId, req.params.businessId, null, req.body);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.status(201).json({ success: true, item: result.data });
}));

app.patch('/api/vendor/businesses/:businessId/menu/:itemId', asyncRoute(async (req: Request, res: Response) => {
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  const issue = validateMenuItem(req.body || {});
  if (issue) return res.status(400).json({ success: false, error: issue });
  if (req.body.imageUrl && !isTrustedMenuImageUrl(req.body.imageUrl, process.env.SUPABASE_URL || '')) return res.status(400).json({ success: false, error: 'Food images must use the wá jẹun menu image upload.' });
  const result = await saveVendorMenuItem(authorization.userId, req.params.businessId, req.params.itemId, req.body);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, item: result.data });
}));

app.delete('/api/vendor/businesses/:businessId/menu/:itemId', asyncRoute(async (req: Request, res: Response) => {
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  const result = await deleteVendorMenuItem(authorization.userId, req.params.businessId, req.params.itemId);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true });
}));

app.post('/api/vendor/businesses/:businessId/menu-image', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), asyncRoute(async (req: Request, res: Response) => {
  const authorization = await verifiedVendorUser(req);
  if (!authorization.userId) return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ success: false, error: 'Upload a JPEG, PNG, or WebP food image.' });
  const result = await uploadVendorMenuImage(authorization.userId, req.params.businessId, req.get('content-type') || '', req.body);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, ...result.data });
}));

app.get('/api/admin/vendor-applications/:id', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await authorizeAdminRequest(req);
  if (!authorization.userId) {
    return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Invalid application ID.' });
  }

  const result = await getAdminVendorApplication(req.params.id);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, ...result.data });
}));

app.post('/api/admin/vendor-applications/:id/review', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = await authorizeAdminRequest(req);
  if (!authorization.userId) {
    return res.status(authorization.statusCode || 401).json({ success: false, error: authorization.error });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Invalid application ID.' });
  }

  const actions: VendorReviewAction[] = ['under_review', 'approve', 'reject', 'request_information'];
  const action = req.body?.action;
  const reason = req.body?.reason;
  if (!actions.includes(action)) {
    return res.status(400).json({ success: false, error: 'Choose a valid review action.' });
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length > 1000)) {
    return res.status(400).json({ success: false, error: 'Review notes must be 1,000 characters or fewer.' });
  }
  if (['reject', 'request_information'].includes(action) && !String(reason || '').trim()) {
    return res.status(400).json({ success: false, error: 'Add a reason before rejecting or requesting more information.' });
  }

  const result = await reviewVendorApplication(req.params.id, authorization.userId, action, typeof reason === 'string' ? reason.trim() || null : null);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, application: result.data });
}));

// 2. Truthful vendor discovery endpoint - strictly verified/approved vendors only
// (0 verified vendors at pre-launch; no fictional businesses)
app.get('/api/vendors', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const { category, search, marketArea, neighborhood, fulfillment } = req.query;

  try {
    const filterCats = category && typeof category === 'string'
      ? [...new Set(category.split(',').map(value => sanitizeText(value, 50)).filter(Boolean))]
      : [];
    if (filterCats.some(value => !MENU_CATEGORIES.includes(value as typeof MENU_CATEGORIES[number]))) {
      return res.status(400).json({ success: false, error: 'Choose a supported food category.' });
    }
    const filterSearch = search && typeof search === 'string' ? sanitizeText(search, 100) : undefined;
    if (marketArea && (typeof marketArea !== 'string' || !isMarketAreaId(marketArea))) {
      return res.status(400).json({ success: false, error: 'Choose a supported market area.' });
    }
    const filterMarketArea = typeof marketArea === 'string' ? marketArea : undefined;
    const filterNeighborhood = neighborhood && typeof neighborhood === 'string' ? sanitizeText(neighborhood, 150) : undefined;
    const filterFulfillment = fulfillment === 'pickup' || fulfillment === 'delivery' ? fulfillment : undefined;
    if (fulfillment && (typeof fulfillment !== 'string' || !['pickup', 'delivery'].includes(fulfillment))) {
      return res.status(400).json({ success: false, error: 'Choose pickup or vendor-managed delivery.' });
    }

    const result = await getVerifiedVendors({
      categories: filterCats,
      search: filterSearch,
      marketArea: filterMarketArea,
      neighborhood: filterNeighborhood,
      fulfillment: filterFulfillment
    });
    if (!result.success) {
      console.error('[WA JEUN API] GET /api/vendors failed.', { status: result.statusCode || 503, category: 'directory_query_failed' });
      return res.status(result.statusCode).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      vendors: result.vendors,
      total: result.total,
      filtersApplied: {
        categories: filterCats,
        search: filterSearch || null,
        marketArea: filterMarketArea || null,
        neighborhood: filterNeighborhood || null,
        fulfillment: filterFulfillment || null
      },
      status: result.total === 0 ? 'empty' : 'available',
      message: result.total === 0
        ? 'No approved food businesses match those filters right now.'
        : 'Displaying approved food businesses serving the selected area.'
    });
  } catch {
    console.error('[WA JEUN API] GET /api/vendors failed.', { status: 503, category: 'unexpected_route_error' });
    res.status(503).json({ success: false, error: 'The food directory is temporarily unavailable. Please try again.' });
  }
});

app.get('/api/vendors/:businessId/menu', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const result = await getPublicVendorMenu(req.params.businessId);
  if (!result.success) return res.status(result.statusCode || 503).json({ success: false, error: result.error });
  return res.json({ success: true, vendor: result.data });
}));

// Authenticated vendor applicants can view only applications owned by their
// verified Supabase user ID. The client never supplies an authoritative user ID.
app.get('/api/account/vendor-applications', asyncRoute(async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const authorization = parseBearerAuthorization(req.get('authorization'));
  if (!authorization.token) {
    return res.status(401).json({ success: false, error: 'Sign in to view your account.' });
  }

  const verified = await verifySupabaseAccessToken(authorization.token);
  if (!verified.success || !verified.data) {
    return res.status(verified.statusCode || 401).json({ success: false, error: verified.error });
  }

  const result = await getVendorApplicationsForUser(verified.data.userId);
  if (!result.success) {
    return res.status(result.statusCode || 500).json({ success: false, error: result.error });
  }
  return res.json({ success: true, applications: result.data || [] });
}));

// 3. Customer Early Access Registration Endpoint
app.post('/api/interest/customer', customerInterestLimiter, async (req: Request, res: Response) => {
  try {
    const {
      name,
      contactMethod,
      phone,
      email,
      marketArea,
      neighborhood,
      favoriteCategories,
      consentAccepted
    } = req.body;

    // A. Required Name Validation
    const cleanName = sanitizeText(name, 150);
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your full name (minimum 2 characters).'
      });
    }

    // B. Contact Method Validation
    if (!contactMethod || !['phone', 'email'].includes(contactMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Please select a preferred contact method (WhatsApp/Phone or Email).'
      });
    }

    // C. Phone and Email Normalization
    let normalizedPhone: string | null = null;
    let normalizedEmail: string | null = null;

    if (contactMethod === 'phone') {
      normalizedPhone = normalizeNigerianPhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid Nigerian phone number or WhatsApp contact (e.g. 0803 123 4567 or +234 803 123 4567).'
        });
      }
    }

    if (contactMethod === 'email') {
      normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address.'
        });
      }
    }

    // D. Neighborhood Validation
    if (marketArea !== undefined && !isMarketAreaId(marketArea)) return res.status(400).json({ success: false, error: 'Please choose Ijebu Ode or Ijagun.' });
    const cleanMarketArea = isMarketAreaId(marketArea) ? marketArea : 'ijebu-ode';
    const cleanNeighborhood = sanitizeText(neighborhood, 150);
    if (!cleanNeighborhood || cleanNeighborhood.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please select or specify your neighborhood in Ijebu Ode.'
      });
    }

    // E. Consent Requirement
    if (consentAccepted !== true) {
      return res.status(400).json({
        success: false,
        error: 'You must agree to the privacy notice to be contacted about the launch.'
      });
    }

    // F. Clean Food Categories Array
    const cleanCategories = Array.isArray(favoriteCategories)
      ? favoriteCategories.map((c) => sanitizeText(String(c), 50)).filter(Boolean)
      : [];

    // G. Persistent Database Insertion
    const dbResult = await insertCustomerInterest({
      name: cleanName,
      contact_method: contactMethod,
      phone: normalizedPhone,
      email: normalizedEmail,
      neighborhood: cleanNeighborhood,
      market_area: cleanMarketArea,
      favorite_categories: cleanCategories,
      consent_accepted: true
    });

    if (!dbResult.success) {
      return res.status(dbResult.statusCode || 500).json({
        success: false,
        error: dbResult.error || 'Failed to record registration.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Thank you for registering your interest! We will contact you when food discovery and ordering go live in your selected area.',
      registrationId: dbResult.data?.id
    });
  } catch (err: any) {
    console.error('[WA JEUN API] Customer registration error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred. Please try again later.'
    });
  }
});

// 4. Food Business Onboarding Interest Registration Endpoint
app.post('/api/interest/vendor', vendorApplicationLimiter, async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      contactName,
      phone,
      email,
      marketArea,
      neighborhood,
      streetAddress,
      nearbyLandmark,
      deliveryCoverage,
      businessType,
      currentOrderingMethods,
      fulfillmentOptions,
      message,
      consentAccepted
    } = req.body;

    const cleanBizName = sanitizeText(businessName, 200);
    if (!cleanBizName || cleanBizName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your business or buka name (minimum 2 characters).'
      });
    }

    const cleanContact = sanitizeText(contactName, 150);
    if (!cleanContact || cleanContact.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter the owner or primary contact person name.'
      });
    }

    const normalizedPhone = normalizeNigerianPhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid WhatsApp or phone contact number for your business.'
      });
    }

    let normalizedEmail: string | null = null;
    if (email && String(email).trim()) {
      normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          error: 'If provided, email must be a valid email format.'
        });
      }
    }

    const cleanMarketArea = isMarketAreaId(marketArea) ? marketArea : null;
    const cleanStreetAddress = sanitizeText(streetAddress, 250);
    const cleanNearbyLandmark = sanitizeText(nearbyLandmark, 250);
    const cleanDeliveryCoverage = Array.isArray(deliveryCoverage) && deliveryCoverage.every(isMarketAreaId) ? [...new Set(deliveryCoverage)] : null;
    const cleanNeighborhood = sanitizeText(neighborhood, 150);
    if (!cleanNeighborhood || cleanNeighborhood.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your business location and choose a supported market area.'
      });
    }

    if (!businessType || !VALID_BUSINESS_TYPES.includes(businessType)) {
      return res.status(400).json({
        success: false,
        error: 'Please select a valid business category.'
      });
    }

    if (!fulfillmentOptions || !VALID_FULFILLMENT_OPTIONS.includes(fulfillmentOptions)) {
      return res.status(400).json({
        success: false,
        error: 'Please specify a valid fulfillment capability.'
      });
    }

    if (!cleanMarketArea || cleanStreetAddress.length < 3 || cleanNearbyLandmark.length < 2 || !cleanDeliveryCoverage || (['vendor_delivery', 'pickup_and_delivery'].includes(fulfillmentOptions) && cleanDeliveryCoverage.length === 0)) {
      return res.status(400).json({ success: false, error: 'Provide a supported area, street, nearby landmark, and your actual delivery coverage.' });
    }

    // Clean ordering methods array
    let methods: string[] = [];
    if (Array.isArray(currentOrderingMethods)) {
      methods = currentOrderingMethods.filter((m) => VALID_ORDERING_METHODS.includes(m));
    } else if (currentOrderingMethods && VALID_ORDERING_METHODS.includes(currentOrderingMethods)) {
      methods = [currentOrderingMethods];
    }
    if (methods.length === 0) {
      methods = ['walk_in'];
    }

    if (consentAccepted !== true) {
      return res.status(400).json({
        success: false,
        error: 'You must agree to the privacy notice so we can contact you regarding vendor onboarding.'
      });
    }

    const cleanMessage = sanitizeText(message, 1000);

    const authorization = parseBearerAuthorization(req.get('authorization'));
    if (!authorization.token) return res.status(401).json({ success: false, error: 'Sign in before submitting a vendor application.' });
    const verified = await verifySupabaseAccessToken(authorization.token);
    if (!verified.success || !verified.data) {
      return res.status(verified.statusCode || 401).json({ success: false, error: verified.error || 'Your session is invalid or expired.' });
    }
    const ownerUserId = verified.data.userId;

    // Persistent Database Insertion
    const dbResult = await insertVendorInterest({
      business_name: cleanBizName,
      contact_name: cleanContact,
      phone: normalizedPhone,
      email: normalizedEmail,
      market_area: cleanMarketArea,
      neighborhood: cleanNeighborhood,
      street_address: cleanStreetAddress,
      nearby_landmark: cleanNearbyLandmark,
      delivery_coverage: cleanDeliveryCoverage,
      business_type: businessType,
      current_ordering_methods: methods,
      fulfillment_options: fulfillmentOptions,
      message: cleanMessage || null,
      consent_accepted: true
    }, ownerUserId);

    if (!dbResult.success) {
      return res.status(dbResult.statusCode || 500).json({
        success: false,
        error: dbResult.error || 'Failed to record food business interest.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Your food business interest has been recorded! Our onboarding team will contact you directly to discuss the next steps for joining the first cohort in your selected area.',
      registrationId: dbResult.data?.id
    });
  } catch (err: any) {
    console.error('[WA JEUN API] Vendor registration error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred. Please try again later.'
    });
  }
});

// 5. Contact Inquiries Endpoint
app.post('/api/contact', contactInquiryLimiter, async (req: Request, res: Response) => {
  try {
    const { name, contactInfo, subject, message, consentAccepted } = req.body;

    const cleanName = sanitizeText(name, 150);
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, error: 'Please enter your name.' });
    }

    const cleanContact = sanitizeText(contactInfo, 255);
    if (!cleanContact || cleanContact.length < 5) {
      return res.status(400).json({ success: false, error: 'Please provide a valid phone number or email address.' });
    }

    const cleanSubject = sanitizeText(subject, 200) || 'General Inquiry';

    const cleanMsg = sanitizeText(message, 2000);
    if (!cleanMsg || cleanMsg.length < 10) {
      return res.status(400).json({ success: false, error: 'Please provide a message with at least 10 characters.' });
    }

    if (consentAccepted !== true) {
      return res.status(400).json({ success: false, error: 'Please confirm your consent to be contacted.' });
    }

    const dbResult = await insertContactInquiry({
      name: cleanName,
      contact_info: cleanContact,
      subject: cleanSubject,
      message: cleanMsg
    });

    if (!dbResult.success) {
      return res.status(dbResult.statusCode || 500).json({
        success: false,
        error: dbResult.error || 'Failed to deliver message.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Thank you for reaching out. Your message has been received, and we will get back to you.',
      inquiryId: dbResult.data?.id
    });
  } catch (err: any) {
    console.error('[WA JEUN API] Contact inquiry error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to send message.' });
  }
});

// Keep API misses and rejected requests in JSON space; never let the SPA
// fallback turn an /api URL into index.html.
export const apiNotFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found.' });
};
app.use('/api', apiNotFoundHandler);

export const apiErrorHandler: ErrorRequestHandler = (error: any, _req, res, _next) => {
  if (res.headersSent) return;
  const suppliedStatus = Number(error?.statusCode || error?.status);
  const status = suppliedStatus >= 400 && suppliedStatus <= 599 ? suppliedStatus : 500;
  const message = status === 400
    ? 'The request could not be read. Check the request format and try again.'
    : status === 413
      ? 'The request is too large.'
      : 'An unexpected server error occurred. Please try again later.';
  if (status >= 500) console.error('[WA JEUN API] Request failed with an internal error.');
  res.status(status).json({ success: false, error: message });
};
app.use('/api', apiErrorHandler);

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const clientPath = path.join(__dirname, 'client');
    app.use(express.static(clientPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WA JEUN server running on http://0.0.0.0:${PORT} [Mode: ${getStorageMode()}]`);
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  startServer().catch(() => {
    console.error('Failed to start WA JEUN server. Check the local server configuration.');
    process.exit(1);
  });
}
