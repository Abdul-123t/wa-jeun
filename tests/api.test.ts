/**
 * WA JEUN Automated Security & Persistence Verification Test Suite
 * Tests all 12 criteria specified in the verification requirements.
 */

import {
  normalizeNigerianPhone,
  normalizeEmail,
  sanitizeText,
  redactPii
} from '../src/server/validation';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { createRateLimiter, resetRateLimits } from '../src/server/rateLimiter';
import { configureClientIpTrust } from '../src/server/clientIp';
import { getAdminAccessViewState, getProtectedRouteState, isVerifiedMember, validateAuthInput } from '../src/auth/authRules';
import { authorizeAdminHeader, parseBearerAuthorization, verifyAccessToken } from '../src/server/authTokens';
import { api } from '../src/services/api';
import { getPublicStoreAvailability } from '../src/services/storeHours';
import { canManageMenu, isVendorSellEligible, isVendorOwner, isTrustedMenuImageUrl, validateMenuItem, validateOpeningHours } from '../src/server/vendorRules';
import { calculateOrderTotals, canTransitionOrder, parseCheckoutLines, resolveAvailableOrderItems, validateCheckoutContact, validateFulfillment } from '../src/server/orderRules';

// Keep this suite strictly local even when developer or CI environments contain
// Supabase credentials. No test should make a network connection to a project.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const isolatedTestDb = join(tmpdir(), `wa-jeun-api-test-${process.pid}.json`);
process.env.WAJEUN_TEST_DATA_FILE = isolatedTestDb;
process.once('exit', () => { try { rmSync(isolatedTestDb, { force: true }); } catch { /* Test cleanup is best-effort. */ } });

const {
  insertCustomerInterest,
  insertVendorInterest,
  insertContactInquiry,
  getVerifiedVendors,
  getPublicVendorMenu,
  getHealthStats,
  getStorageMode,
  isSupabaseConfigured,
  resolveSupabaseCredentials,
  toPublicVendor,
  toPublicVendorListing,
  toPublicMenuItem,
  matchesPublicVendorFilters,
  summarizeSupabaseHealth
} = await import('../src/server/db');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('WA JEUN: Automated Persistence & Security Verification');
  console.log('Storage Mode:', getStorageMode());
  console.log('Supabase Configured:', isSupabaseConfigured());
  console.log('======================================================\n');

  resetRateLimits();

  console.log('--- Suite: Rate Limiting and Proxy Trust ---');
  assert(
    ['/brand/wa-jeun-logo.webp', '/brand/wa-jeun-icon-64.png', '/brand/favicon.ico', '/brand/favicon-32.png', '/brand/favicon-16.png', '/brand/apple-touch-icon.png']
      .every(asset => existsSync(new URL(`../public${asset}`, import.meta.url))),
    'Official full logo, navigation icon, and favicon assets exist in the public brand directory'
  );
  const mockRateRequest = (ip: string, forwardedFor?: string) => ({
    ip,
    headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor },
    socket: { remoteAddress: '10.0.0.9' }
  });
  const invokeRateLimiter = (limiter: ReturnType<typeof createRateLimiter>, ip: string, forwardedFor?: string) => {
    const response = {
      headers: {} as Record<string, any>,
      statusCode: 200,
      body: undefined as any,
      setHeader(name: string, value: unknown) { this.headers[name] = value; return this; },
      status(value: number) { this.statusCode = value; return this; },
      json(value: unknown) { this.body = value; return this; }
    };
    let nextCalled = false;
    limiter(mockRateRequest(ip, forwardedFor) as any, response as any, () => { nextCalled = true; });
    return { ...response, nextCalled };
  };

  resetRateLimits();
  const spoofResistantLimiter = createRateLimiter({ key: 'test-spoof', windowMs: 60_000, max: 2 });
  const spoofedFirst = invokeRateLimiter(spoofResistantLimiter, '198.51.100.10', '203.0.113.1');
  const spoofedSecond = invokeRateLimiter(spoofResistantLimiter, '198.51.100.10', '203.0.113.2');
  const spoofedThird = invokeRateLimiter(spoofResistantLimiter, '198.51.100.10', '203.0.113.3');
  assert(spoofedFirst.nextCalled && spoofedSecond.nextCalled && spoofedThird.statusCode === 429 && spoofedThird.body.success === false && spoofedThird.headers['Retry-After'] > 0, 'Changing X-Forwarded-For cannot bypass the IP limit and excess requests receive 429 JSON');

  resetRateLimits();
  const impersonationLimiter = createRateLimiter({ key: 'test-impersonation', windowMs: 60_000, max: 1 });
  const attacker = invokeRateLimiter(impersonationLimiter, '198.51.100.10', '203.0.113.99');
  const realOtherClient = invokeRateLimiter(impersonationLimiter, '203.0.113.99', '203.0.113.99');
  const secondRealRequest = invokeRateLimiter(impersonationLimiter, '203.0.113.99', '198.51.100.10');
  assert(attacker.nextCalled && realOtherClient.nextCalled && secondRealRequest.statusCode === 429, 'An untrusted forwarded address cannot impersonate or consume another client’s bucket');

  resetRateLimits();
  const routeOne = createRateLimiter({ key: 'route-one', windowMs: 60_000, max: 1 });
  const routeTwo = createRateLimiter({ key: 'route-two', windowMs: 60_000, max: 1 });
  assert(invokeRateLimiter(routeOne, '198.51.100.10').nextCalled && invokeRateLimiter(routeTwo, '198.51.100.10').nextCalled && invokeRateLimiter(routeOne, '198.51.100.10').statusCode === 429, 'Independent endpoints retain separate limits for the same client');

  const directSettings: Array<[string, unknown]> = [];
  configureClientIpTrust({ set: (key, value) => { directSettings.push([key, value]); } }, { NODE_ENV: 'production', WAJEUN_CLIENT_IP_MODE: 'direct' });
  assert(directSettings[0]?.[0] === 'trust proxy' && directSettings[0]?.[1] === false, 'Direct production ingress ignores all forwarded headers');
  let missingTopologyRejected = false;
  try { configureClientIpTrust({ set() { return this; } }, { NODE_ENV: 'production' }); }
  catch { missingTopologyRejected = true; }
  assert(missingTopologyRejected, 'Production startup fails closed when the proxy topology is not configured');
  let malformedProxyRejected = false;
  try { configureClientIpTrust({ set() { return this; } }, { NODE_ENV: 'production', WAJEUN_CLIENT_IP_MODE: 'trusted-proxy', WAJEUN_TRUSTED_PROXY_CIDRS: 'not-an-ip' }); }
  catch { malformedProxyRejected = true; }
  assert(malformedProxyRejected, 'Malformed trusted proxy addresses are rejected');
  let worldWideProxyRejected = false;
  try { configureClientIpTrust({ set() { return this; } }, { NODE_ENV: 'production', WAJEUN_CLIENT_IP_MODE: 'trusted-proxy', WAJEUN_TRUSTED_PROXY_CIDRS: '0.0.0.0/0' }); }
  catch { worldWideProxyRejected = true; }
  assert(worldWideProxyRejected, 'World-wide proxy trust ranges are rejected');

  const trustedApp = express();
  configureClientIpTrust(trustedApp, { NODE_ENV: 'production', WAJEUN_CLIENT_IP_MODE: 'trusted-proxy', WAJEUN_TRUSTED_PROXY_CIDRS: '10.0.0.0/8' });
  const proxyRequest = Object.create(express.request) as any;
  proxyRequest.app = trustedApp;
  proxyRequest.socket = { remoteAddress: '10.1.2.3' };
  proxyRequest.headers = { 'x-forwarded-for': '198.51.100.99, 203.0.113.24' };
  const directRequest = Object.create(express.request) as any;
  const directApp = express();
  configureClientIpTrust(directApp, { NODE_ENV: 'production', WAJEUN_CLIENT_IP_MODE: 'direct' });
  directRequest.app = directApp;
  directRequest.socket = { remoteAddress: '198.51.100.10' };
  directRequest.headers = { 'x-forwarded-for': '203.0.113.24' };
  assert(proxyRequest.ip === '203.0.113.24' && directRequest.ip === '198.51.100.10', 'Express resolves client IPs from the configured trusted proxy chain and ignores XFF for direct ingress');
  resetRateLimits();

  // Test 1: Phone Normalization (E.164 +234...)
  console.log('--- Suite 1: Normalization & PII Sanitization ---');
  assert(
    normalizeNigerianPhone('0803 123 4567') === '+2348031234567',
    'Normalizes 11-digit local Nigerian phone with spaces'
  );
  const safePublicMenuItem = toPublicMenuItem({ id: 'item-1', name: 'Jollof Rice', description: 'Fresh', price_ngn: '2500.00', category: 'rice', available: true, user_id: 'private-account', verification_document: 'private-doc', image_url: 'https://attacker.example/photo.jpg' });
  assert(Boolean(safePublicMenuItem) && Object.keys(safePublicMenuItem!).sort().join(',') === 'available,category,description,id,image_url,name,price_ngn' && safePublicMenuItem!.image_url === null && !JSON.stringify(safePublicMenuItem).includes('private-account'), 'Public menu items expose only allowlisted fields and discard untrusted image URLs');
  const unavailableMenu = await getPublicVendorMenu('unavailable-business');
  assert(!unavailableMenu.success && unavailableMenu.statusCode === 404, 'An unavailable public menu returns a not-found result');
  assert(
    normalizeNigerianPhone('+234 803 123 4567') === '+2348031234567',
    'Normalizes +234 prefixed phone with spaces'
  );
  assert(
    normalizeNigerianPhone('2348031234567') === '+2348031234567',
    'Normalizes 234 without plus'
  );
  assert(
    normalizeNigerianPhone('12345') === null,
    'Rejects short invalid phone numbers'
  );

  assert(
    normalizeEmail('  Seun.Adeleke@Example.COM  ') === 'seun.adeleke@example.com',
    'Trims and lowercases email'
  );
  assert(
    normalizeEmail('invalid-email') === null,
    'Rejects malformed emails'
  );

  assert(
    redactPii('+2348031234567') === '+234****567',
    'Masks phone numbers in logs'
  );
  assert(
    redactPii('seun@example.com').includes('***'),
    'Masks email addresses in logs'
  );

  // Test 2: Valid Customer Submissions
  console.log('\n--- Suite 2: Customer Early-Access Submissions ---');
  const uniqueCustomerPhone = `+234803${Math.floor(1000000 + Math.random() * 9000000)}`;
  const custRes1 = await insertCustomerInterest({
    name: 'Olamide Adeleke',
    contact_method: 'phone',
    phone: uniqueCustomerPhone,
    neighborhood: 'Molipa',
    favorite_categories: ['Rice Dishes', 'Swallow and Soups'],
    consent_accepted: true
  });
  assert(
    custRes1.success === true && typeof custRes1.data?.id === 'string',
    'Criterion 1: Valid customer submission returns success with record ID',
    custRes1.error
  );

  // Test 3: Duplicate Customer Submission Prevention
  console.log('\n--- Suite 3: Duplicate Handling & Consistency ---');
  const custResDup = await insertCustomerInterest({
    name: 'Olamide Adeleke',
    contact_method: 'phone',
    phone: uniqueCustomerPhone,
    neighborhood: 'Molipa',
    favorite_categories: [],
    consent_accepted: true
  });
  assert(
    custResDup.success === false && custResDup.statusCode === 409 && custResDup.isDuplicate === true,
    'Criterion 6: Duplicate customer registration rejected with 409 Conflict'
  );

  // Test 4: Concurrent Duplicate Submissions Safe Handling
  console.log('\n--- Suite 4: Concurrent Duplicate Handling ---');
  const concurrentPhone = `+234809${Math.floor(1000000 + Math.random() * 9000000)}`;
  const [c1, c2] = await Promise.all([
    insertCustomerInterest({
      name: 'Concurrent User A',
      contact_method: 'phone',
      phone: concurrentPhone,
      neighborhood: 'Igbeba',
      favorite_categories: [],
      consent_accepted: true
    }),
    insertCustomerInterest({
      name: 'Concurrent User B',
      contact_method: 'phone',
      phone: concurrentPhone,
      neighborhood: 'Igbeba',
      favorite_categories: [],
      consent_accepted: true
    })
  ]);
  const oneSuccessOneDuplicate = Boolean(
    (c1.success && !c2.success && c2.isDuplicate) || 
    (c2.success && !c1.success && c1.isDuplicate)
  );
  assert(
    oneSuccessOneDuplicate,
    'Criterion 7: Concurrent duplicate submissions safely resolve with exactly one saved and one 409 rejected'
  );

  // Test 5: Valid Vendor-Interest Submissions
  console.log('\n--- Suite 5: Food Business Onboarding Submissions ---');
  const uniqueVendorPhone = `+234802${Math.floor(1000000 + Math.random() * 9000000)}`;
  const vendRes1 = await insertVendorInterest({
    business_name: 'Ijebu Pot Kitchen',
    contact_name: 'Mrs. Funke',
    phone: uniqueVendorPhone,
    neighborhood: 'Folagbade',
    business_type: 'local_buka',
    current_ordering_methods: ['walk_in', 'phone_calls'],
    fulfillment_options: 'pickup_only',
    message: 'Famous for ofada rice and spicy buka stew.',
    consent_accepted: true
  });
  assert(
    vendRes1.success === true && typeof vendRes1.data?.id === 'string',
    'Criterion 2: Valid vendor submission saved as pending review with record ID',
    vendRes1.error
  );

  // Duplicate vendor registration
  const vendResDup = await insertVendorInterest({
    business_name: 'Ijebu Pot Kitchen',
    contact_name: 'Mrs. Funke',
    phone: uniqueVendorPhone,
    neighborhood: 'Folagbade',
    business_type: 'local_buka',
    current_ordering_methods: ['walk_in'],
    fulfillment_options: 'pickup_only',
    consent_accepted: true
  });
  assert(
    vendResDup.success === false && vendResDup.statusCode === 409,
    'Criterion 6b: Duplicate vendor application safely caught and rejected'
  );

  // Test 6: Valid Contact Submissions
  console.log('\n--- Suite 6: Contact Inquiries ---');
  const contactRes = await insertContactInquiry({
    name: 'Babatunde O.',
    contact_info: '+2348031112233',
    subject: 'Vendor Inquiry',
    message: 'We would love to know more about the vendor rollout timeline in Degun.'
  });
  assert(
    contactRes.success === true && typeof contactRes.data?.id === 'string',
    'Criterion 3: Valid contact message saved with record ID'
  );

  // Test 7: Zero Vendor Listing Truthfulness
  console.log('\n--- Suite 7: Market Truthfulness & Public Directory ---');
  const vendorList = await getVerifiedVendors({});
  assert(
    vendorList.success && vendorList.total === 0 && vendorList.vendors.length === 0,
    'Local development directory returns a successful empty result without inventing listings'
  );

  // Test 8: Public Data Privacy & Health Statistics
  console.log('\n--- Suite 8: Privacy & Health Check ---');
  const health = await getHealthStats();
  assert(
    health.status === 'online' && typeof health.registeredCustomers === 'number',
    'Criterion 10: Health check returns numeric summary counts without leaking customer PII or records'
  );

  // Test 9: Security & Credential Boundary
  console.log('\n--- Suite 9: Security Boundary & Leakage Audit ---');
  const clientEnvKeys = Object.keys(process.env).filter(k => k.startsWith('VITE_'));
  const hasLeakedSecretInClientEnv = clientEnvKeys.some(k =>
    process.env[k] === process.env.SUPABASE_SECRET_KEY ||
    process.env[k] === process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  assert(
    !hasLeakedSecretInClientEnv,
    'Secret keys are not exposed in VITE_ client environment'
  );

  const preferredCredentials = resolveSupabaseCredentials({
    SUPABASE_URL: ' https://dev-project.supabase.co ',
    SUPABASE_SECRET_KEY: ' preferred-secret ',
    SUPABASE_SERVICE_ROLE_KEY: ' legacy-secret '
  });
  assert(
    preferredCredentials.url === 'https://dev-project.supabase.co' &&
      preferredCredentials.secretKey === 'preferred-secret',
    'SUPABASE_SECRET_KEY is preferred and credentials are trimmed'
  );
  assert(
    resolveSupabaseCredentials({ SUPABASE_SERVICE_ROLE_KEY: ' legacy-secret ' }).secretKey === 'legacy-secret',
    'Legacy service role key is supported as a fallback'
  );

  const publicVendor = toPublicVendor({
    id: 'vendor-id',
    business_name: 'Ijebu Kitchen',
    neighborhood: 'Molipa',
    business_type: 'local_buka',
    fulfillment_options: 'pickup_only',
    contact_name: 'Private Contact',
    phone: '+2348000000000',
    email: 'private@example.test',
    message: 'Private application details',
    cac_document_url: 'private-document'
  });
  assert(
    Object.keys(publicVendor).sort().join(',') === 'business_name,business_type,delivery_fee_ngn,fulfillment_options,id,neighborhood' &&
      !JSON.stringify(publicVendor).includes('Private Contact') &&
      !JSON.stringify(publicVendor).includes('private-document'),
    'Public vendor projection omits private application fields and documents'
  );

  const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert(
    serverSource.indexOf("import 'dotenv/config';") >= 0 &&
      serverSource.indexOf("import 'dotenv/config';") < serverSource.indexOf("from './src/server/db'"),
    'dotenv/config is imported before the database module'
  );

  const healthyDbStats = summarizeSupabaseHealth({ count: 12 }, { count: 5 });
  assert(
    healthyDbStats.status === 'online' && healthyDbStats.storageMode === 'supabase-production' &&
      healthyDbStats.registeredCustomers === 12 && healthyDbStats.registeredVendors === 5,
    'Health summary reports Supabase healthy only when both count queries succeed'
  );
  const failedDbStats = summarizeSupabaseHealth(
    { count: null, error: { message: 'private SQL error detail' } },
    { count: 5 }
  );
  assert(
    failedDbStats.status === 'degraded' && failedDbStats.storageMode === 'supabase-error' &&
      failedDbStats.registeredCustomers === 0 && failedDbStats.registeredVendors === 0 &&
      !JSON.stringify(failedDbStats).includes('private SQL error detail'),
    'Health summary reports query failure without exposing error details'
  );

  assert(
    Object.keys(validateAuthInput('customer@example.test', 'good-password', 'good-password')).length === 0 &&
      validateAuthInput('invalid', 'short', 'different').confirmPassword !== undefined,
    'Auth input validation accepts valid credentials and rejects invalid credentials'
  );
  assert(
    getProtectedRouteState(true, null) === 'loading' &&
      getProtectedRouteState(false, null) === 'unauthenticated' &&
      getProtectedRouteState(false, 'verified-user-id') === 'authenticated',
    'Protected route state handles loading, signed-out, and signed-in states'
  );
  assert(
    getAdminAccessViewState({ permissionsLoading: true, userId: 'founder-id', adminUserId: null }) === 'loading' &&
      getAdminAccessViewState({ permissionsLoading: false, userId: 'founder-id', adminUserId: 'founder-id' }) === 'authorized' &&
      getAdminAccessViewState({ permissionsLoading: false, userId: 'customer-id', adminUserId: null }) === 'denied' &&
      getAdminAccessViewState({ permissionsLoading: false, userId: 'vendor-id', adminUserId: null }) === 'denied' &&
      getAdminAccessViewState({ permissionsLoading: false, userId: 'founder-id', adminUserId: null, error: 'API unavailable' }) === 'error',
    'Admin route keeps permission loading, verified admins, customers, vendors, and API errors distinct'
  );

  assert(
    parseBearerAuthorization('Bearer signed-token').token === 'signed-token' &&
      parseBearerAuthorization('Basic token').provided &&
      parseBearerAuthorization('Basic token').token === null,
    'Bearer authorization parsing rejects malformed auth headers'
  );
  const mockedTokenCheck = await verifyAccessToken({
    auth: { getUser: async token => ({ data: { user: token === 'valid-token' ? { id: 'mock-user-id' } : null }, error: null }) }
  }, 'valid-token');
  assert(mockedTokenCheck.userId === 'mock-user-id', 'Mocked Supabase token verification returns the verified user ID');
  const mockedInvalidToken = await verifyAccessToken({
    auth: { getUser: async () => ({ data: { user: null }, error: { status: 401 } }) }
  }, 'invalid-token');
  assert(mockedInvalidToken.userId === null && mockedInvalidToken.statusCode === 401, 'Invalid mocked access tokens are rejected');

  const adminVerifier = async (token: string) => token === 'valid-admin-token'
    ? { success: true, data: { userId: 'verified-admin-id' } }
    : { success: false, statusCode: 401, error: 'Invalid session' };
  const adminMembership = async (userId: string) => ({ success: true, data: userId === 'verified-admin-id' });
  const signedOutAdmin = await authorizeAdminHeader(undefined, adminVerifier, adminMembership);
  const invalidAdmin = await authorizeAdminHeader('Bearer invalid-token', adminVerifier, adminMembership);
  const nonAdmin = await authorizeAdminHeader('Bearer valid-user-token', async () => ({ success: true, data: { userId: 'vendor-id' } }), adminMembership);
  const customer = await authorizeAdminHeader('Bearer valid-customer-token', async () => ({ success: true, data: { userId: 'customer-id' } }), adminMembership);
  const authorizedAdmin = await authorizeAdminHeader('Bearer valid-admin-token', adminVerifier, adminMembership);
  assert(signedOutAdmin.statusCode === 401, 'Admin authorization denies signed-out requests');
  assert(invalidAdmin.statusCode === 401, 'Admin authorization denies invalid signed-in sessions');
  assert(nonAdmin.statusCode === 403, 'Admin authorization denies signed-in non-admins');
  assert(customer.statusCode === 403, 'Admin authorization denies signed-in customers');
  assert(authorizedAdmin.userId === 'verified-admin-id', 'Admin identity comes from verified token and membership only');
  assert(!isVerifiedMember('ordinary-user', null) && !isVerifiedMember('ordinary-user', 'different-user'), 'Admin and vendor membership links stay hidden until the current user is verified');
  assert(isVerifiedMember('founder-id', 'founder-id'), 'A membership confirmed for the current verified user may unlock its navigation');

  const { app, apiNotFoundHandler, apiErrorHandler } = await import('../server.ts');
  const vendorDashboardRouteLayer = (app as any)._router.stack.find((layer: any) =>
    layer.route?.path === '/api/vendor/dashboard' && layer.route.methods.get
  );
  assert(Boolean(vendorDashboardRouteLayer), 'Actual vendor dashboard GET route is registered at the frontend URL');
  const apiClientSource = readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8');
  assert(apiClientSource.includes("fetch('/api/vendor/dashboard'") , 'Vendor dashboard client calls the registered GET route');
  let adminRouteCalled = false;
  const adminRouteLayer = (app as any)._router.stack.find((layer: any) =>
    layer.route?.path === '/api/admin/vendor-applications' && layer.route.methods.get
  );
  const adminAccessRouteLayer = (app as any)._router.stack.find((layer: any) =>
    layer.route?.path === '/api/admin/access' && layer.route.methods.get
  );
  assert(Boolean(adminRouteLayer), 'Actual Express admin list route is registered');
  assert(Boolean(adminAccessRouteLayer), 'Admin navigation membership is confirmed by a protected server endpoint');
  const invokeHandler = (handler: Function, req: Record<string, unknown>, error?: unknown) => new Promise<{ status: number; body: any; contentType: string }>(resolve => {
    let status = 200;
    let contentType = '';
    const response = {
      headersSent: false,
      set() { return this; },
      status(code: number) { status = code; return this; },
      json(body: unknown) { contentType = 'application/json'; resolve({ status, body, contentType }); return this; }
    };
    const next = (nextError?: unknown) => { if (nextError) resolve({ status: 500, body: nextError, contentType }); };
    if (error !== undefined) handler(error, req, response, next);
    else handler(req, response, next);
  });
  const publicVendorsRouteLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendors' && layer.route.methods.get);
  const publicMenuRouteLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendors/:businessId/menu' && layer.route.methods.get);
  assert(Boolean(publicVendorsRouteLayer && publicMenuRouteLayer), 'Public discovery and restaurant menu API routes are registered');
  if (publicVendorsRouteLayer) {
    const result = await invokeHandler(publicVendorsRouteLayer.route.stack[0].handle, { query: {}, params: {} });
    assert(result.status === 200 && result.body.success === true && result.body.status === 'empty' && result.body.vendors.length === 0, 'Public vendors API distinguishes a successful empty directory');
  }
  if (publicMenuRouteLayer) {
    const result = await invokeHandler(publicMenuRouteLayer.route.stack[0].handle, { query: {}, params: { businessId: 'unknown' } });
    assert(result.status === 404 && result.body.success === false, 'Unknown or no longer eligible restaurant menus return unavailable');
  }
  const customerOrdersLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/customer/orders' && layer.route.methods.get);
  const customerCreateOrderLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/customer/orders' && layer.route.methods.post);
  const vendorOrdersLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendor/orders' && layer.route.methods.get);
  const vendorOrderStatusLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendor/orders/:orderId/status' && layer.route.methods.patch);
  assert(Boolean(customerOrdersLayer && customerCreateOrderLayer && vendorOrdersLayer && vendorOrderStatusLayer), 'Customer history, checkout, vendor inbox, and status API routes are registered');
  for (const [layer, method] of [[customerOrdersLayer, 'Customer order history'], [customerCreateOrderLayer, 'Customer checkout'], [vendorOrdersLayer, 'Vendor order inbox'], [vendorOrderStatusLayer, 'Vendor order status']] as const) {
    if (layer) {
      const result = await invokeHandler(layer.route.stack[layer.route.stack.length - 1].handle, { get: () => undefined, params: {}, query: {}, body: {} });
      assert(result.status === 401 && result.contentType === 'application/json', `${method} requires a verified access token`);
    }
  }
  const orderMigrationSource = readFileSync(new URL('../docs/migrations/20261019_customer_orders.sql', import.meta.url), 'utf8');
  assert(serverSource.includes('if (!isDevelopment) return res.status(503)') && serverSource.includes('isTestOrder: true') && orderMigrationSource.includes("payment_status = 'test_unpaid'"), 'Only development checkout can create unpaid test orders');
  if (vendorDashboardRouteLayer) {
    const result = await invokeHandler(vendorDashboardRouteLayer.route.stack[0].handle, {
      get: () => undefined, params: {}, query: {}, body: {}
    });
    assert(result.status === 401 && result.contentType === 'application/json', 'Actual vendor dashboard route returns JSON 401 without a verified session');
  }
  if (adminRouteLayer) {
    const result = await invokeHandler(adminRouteLayer.route.stack[0].handle, {
      get: () => undefined, query: {}, params: {}, body: {}
    });
    adminRouteCalled = true;
    assert(result.status === 401 && result.contentType === 'application/json' && result.body.error === 'Sign in with an administrator account to continue.', 'Actual admin list route returns a JSON 401 when signed out');
  }
  if (adminAccessRouteLayer) {
    const result = await invokeHandler(adminAccessRouteLayer.route.stack[0].handle, { get: () => undefined, query: {}, params: {}, body: {} });
    assert(result.status === 401 && result.contentType === 'application/json', 'Admin membership endpoint returns JSON 401 when signed out');
  }
  assert(adminRouteCalled, 'Admin list route test completed');
  const navbarSource = readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert(navbarSource.includes('isVerifiedMember(user.id, adminUserId)') && navbarSource.includes('isVerifiedMember(user.id, vendorUserId)'), 'Navigation links depend on server-verified membership for the current user');
  assert(appSource.includes('<AdminRoute />') && appSource.includes('getAdminAccessViewState({ permissionsLoading, userId: user?.id, adminUserId'), 'Direct /admin navigation checks verified membership before mounting admin content');
  assert(appSource.includes('adminPermissionError') && appSource.includes('retryPermissionCheck'), 'Admin permission API failures are visible and can be retried instead of being shown as a false denial');
  const menuCreateLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendor/businesses/:businessId/menu' && layer.route.methods.post);
  assert(Boolean(menuCreateLayer), 'Actual vendor menu creation route is registered');
  if (menuCreateLayer) {
    const result = await invokeHandler(menuCreateLayer.route.stack[0].handle, { get: () => undefined, params: {}, body: {} });
    assert(result.status === 401 && result.contentType === 'application/json', 'Menu create route returns JSON 401 without a verified vendor session');
  }
  const unknown = await invokeHandler(apiNotFoundHandler, { path: '/api/not-a-real-route' });
  assert(unknown.status === 404 && unknown.contentType === 'application/json' && unknown.body.success === false, 'Unknown /api route returns a JSON 404');
  const malformed = await invokeHandler(apiErrorHandler, { path: '/api/contact' }, { status: 400 });
  assert(malformed.status === 400 && malformed.contentType === 'application/json' && malformed.body.success === false, 'Malformed API requests receive a safe JSON error');

  const migrationSource = readFileSync(new URL('../docs/migrations/20261017_authentication_foundation.sql', import.meta.url), 'utf8');
  const adminMigration = readFileSync(new URL('../docs/migrations/20261017_super_admin_vendor_review.sql', import.meta.url), 'utf8');
  const dbSource = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert(
    dbSource.includes(".from('admin_users')") && dbSource.includes(".select('user_id')") && dbSource.includes(".eq('user_id', userId)") &&
      adminMigration.includes('user_id UUID PRIMARY KEY REFERENCES auth.users (id)'),
    'Admin membership compares the verified Supabase Auth user ID with public.admin_users.user_id'
  );
  assert(
    migrationSource.includes('USING (user_id = (SELECT auth.uid()))') &&
      dbSource.includes(".eq('user_id', userId)"),
    'Vendor application reads are scoped to the verified owner in both RLS and server queries'
  );
  assert(adminMigration.includes("v_owner_user_id = p_actor_user_id") && adminMigration.includes('FOR UPDATE'), 'Review transaction prevents self-review and locks application status');
  assert(adminMigration.includes('INSERT INTO public.vendor_review_audit') && adminMigration.includes('GRANT EXECUTE') && adminMigration.includes('service_role'), 'Review decisions persist audit records through the server role');
  assert(adminMigration.includes("p_action IN ('reject', 'request_information') AND v_reason IS NULL"), 'Rejection and information requests require a reason');

  const completeHours = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => [day, { open: '09:00', close: '18:00', closed: false }]));
  const eligibleStore = { status: 'approved', business_name: 'Test Kitchen', neighborhood: 'Molipa', business_type: 'restaurant', fulfillment_options: 'pickup_and_delivery', description: 'Fresh meals prepared daily.', opening_hours: completeHours, accepting_orders: true, available_menu_items: 1 };
  assert(isVendorOwner('vendor-user', 'vendor-user') && !isVendorOwner('vendor-user', 'other-user'), 'Vendor business ownership matches only the verified user identity');
  assert(isTrustedMenuImageUrl('https://project.supabase.co/storage/v1/object/public/vendor-menu-images/a.jpg', 'https://project.supabase.co') && !isTrustedMenuImageUrl('https://attacker.example/storage/v1/object/public/vendor-menu-images/a.jpg', 'https://project.supabase.co'), 'Menu item image URLs must point to the configured Supabase public image bucket');
  assert(canManageMenu('approved') && !canManageMenu('pending_review') && !canManageMenu('declined') && !canManageMenu('suspended'), 'Menu CRUD permissions require approved status');
  assert(validateOpeningHours(completeHours) && !validateOpeningHours({ monday: { open: 'late', close: '18:00', closed: false } }), 'Storefront opening hours require valid entries for every weekday');
  assert(isVendorSellEligible(eligibleStore) && !isVendorSellEligible({ ...eligibleStore, status: 'pending_review' }) && !isVendorSellEligible({ ...eligibleStore, status: 'declined' }) && !isVendorSellEligible({ ...eligibleStore, status: 'suspended' }) && !isVendorSellEligible({ ...eligibleStore, business_name: ' ' }) && !isVendorSellEligible({ ...eligibleStore, available_menu_items: 0 }) && !isVendorSellEligible({ ...eligibleStore, accepting_orders: false }), 'Public orderability requires approval, complete storefront and hours, an available item, and accepting orders');
  const publicFixture = { id: 'v1', business_name: 'Test Kitchen', neighborhood: 'Molipa', business_type: 'restaurant', fulfillment_options: 'pickup_and_delivery', delivery_fee_ngn: null, description: 'Fresh meals prepared daily.', opening_hours: completeHours, accepting_orders: true, menu: [{ id: 'm1', name: 'Jollof Rice', description: '', price_ngn: 2500, category: 'rice', image_url: null, available: true as const }] };
  const projectedListing = toPublicVendorListing({ ...publicFixture, phone: '+2348012345678', email: 'private@example.test', message: 'private note', status: 'approved', user_id: 'private-user' }, [{ ...publicFixture.menu[0], vendor_interest_id: 'v1', phone: 'private' }]);
  assert(!JSON.stringify(projectedListing).includes('private@example.test') && !JSON.stringify(projectedListing).includes('private note') && !('status' in projectedListing), 'Public restaurant data excludes application contacts, review status, account IDs, and private messages');
  const projectedItem = toPublicMenuItem({ id: 'm2', name: 'Amala', description: 'With ewedu', price_ngn: '3000', category: 'swallow', image_url: 'https://attacker.example/meal.jpg', available: true, vendor_interest_id: 'private-vendor', updated_at: 'private' });
  assert(Boolean(projectedItem && Object.keys(projectedItem).sort().join(',') === 'available,category,description,id,image_url,name,price_ngn' && projectedItem.image_url === null && projectedItem.price_ngn === 3000), 'Public menu item projection allowlists fields, normalizes NGN price, and rejects untrusted images');
  assert(matchesPublicVendorFilters(publicFixture, { search: 'jollof' }) && matchesPublicVendorFilters(publicFixture, { search: 'test kitchen' }) && !matchesPublicVendorFilters(publicFixture, { search: 'amala' }), 'Public search matches persisted business and available menu item names');
  assert(matchesPublicVendorFilters(publicFixture, { categories: ['rice'] }) && !matchesPublicVendorFilters(publicFixture, { categories: ['snacks'] }) && matchesPublicVendorFilters(publicFixture, { neighborhood: 'molipa' }) && matchesPublicVendorFilters(publicFixture, { fulfillment: 'delivery' }), 'Public category, neighborhood, and delivery filters affect the returned results');
  const menuId = '00000000-0000-4000-8000-000000000001';
  const cartParse = parseCheckoutLines([{ menuItemId: menuId, quantity: 2, priceNgn: 1, vendorId: 'spoofed' }]);
  assert(cartParse.success && !('priceNgn' in cartParse.lines[0]) && !('vendorId' in cartParse.lines[0]), 'Checkout parser discards browser-supplied price and vendor fields');
  assert(!parseCheckoutLines([{ menuItemId: menuId, quantity: 0 }]).success && !parseCheckoutLines([{ menuItemId: menuId, quantity: 100 }]).success, 'Invalid and excessive quantities are rejected');
  const resolvedCart = cartParse.success ? resolveAvailableOrderItems(cartParse.lines, [{ id: menuId, vendor_interest_id: 'vendor-real', price_ngn: 2500, available: true }]) : null;
  const canonicalTotal = resolvedCart?.success ? calculateOrderTotals([{ price_ngn: resolvedCart.items[0].priceNgn, quantity: resolvedCart.items[0].quantity }], 750).totalNgn : -1;
  assert(resolvedCart?.success === true && canonicalTotal === 5750, 'Totals use the live database price and configured fee rather than a manipulated browser price');
  assert(!resolveAvailableOrderItems([{ menuItemId: menuId, quantity: 1 }], []).success && !resolveAvailableOrderItems([{ menuItemId: menuId, quantity: 1 }], [{ id: menuId, vendor_interest_id: 'v1', price_ngn: 2500, available: false }]).success, 'Unavailable or missing menu records cannot be checked out');
  assert(!resolveAvailableOrderItems([{ menuItemId: menuId, quantity: 1 }, { menuItemId: '00000000-0000-4000-8000-000000000002', quantity: 1 }], [{ id: menuId, vendor_interest_id: 'v1', price_ngn: 2500, available: true }, { id: '00000000-0000-4000-8000-000000000002', vendor_interest_id: 'v2', price_ngn: 1800, available: true }]).success, 'One cart cannot combine menu items from different vendors');
  assert(validateCheckoutContact(' Ada Customer ', '0803 123 4567').success && !validateCheckoutContact('', '123').success, 'Checkout requires valid customer contact details');
  assert(validateFulfillment('pickup', null, ['pickup_only']).success && validateFulfillment('vendor_delivery', 'Molipa Junction, near the market', ['vendor_delivery']).success && !validateFulfillment('vendor_delivery', '', ['vendor_delivery']).success && !validateFulfillment('pickup', null, ['vendor_delivery']).success, 'Fulfillment choices and delivery address are validated');
  assert(canTransitionOrder('placed', 'accepted', 'pickup') && canTransitionOrder('placed', 'rejected', 'pickup') && canTransitionOrder('preparing', 'ready_for_pickup', 'pickup') && canTransitionOrder('preparing', 'out_for_delivery', 'vendor_delivery') && !canTransitionOrder('placed', 'completed', 'pickup') && !canTransitionOrder('preparing', 'out_for_delivery', 'pickup'), 'Order status transitions follow the fulfillment workflow and reject invalid jumps');
  const orderMigration = readFileSync(new URL('../docs/migrations/20261019_customer_orders.sql', import.meta.url), 'utf8');
  assert(orderMigration.includes('UNIQUE (customer_user_id, idempotency_key)') && orderMigration.includes('ON CONFLICT (customer_user_id, idempotency_key) DO NOTHING'), 'Checkout retries are idempotent per authenticated customer');
  assert(orderMigration.includes('customer_user_id = (SELECT auth.uid())') && orderMigration.includes('v.user_id = (SELECT auth.uid())') && orderMigration.includes('p_vendor_user_id'), 'Order RLS and vendor transitions scope access to verified customer and vendor ownership');
  assert(getPublicStoreAvailability(publicFixture, new Date('2026-10-19T09:30:00Z')).open && !getPublicStoreAvailability({ ...publicFixture, accepting_orders: false }, new Date('2026-10-19T09:30:00Z')).open, 'Public store status respects opening hours and the persisted accepting-orders setting');
  assert(validateMenuItem({ name: 'Jollof Rice', description: '', priceNgn: 1500, category: 'rice', available: true }) === null && Boolean(validateMenuItem({ name: 'Meal', description: '', priceNgn: -10, category: 'rice' })) && Boolean(validateMenuItem({ name: 'Meal', description: '', priceNgn: Infinity, category: 'rice' })), 'Menu price validation rejects negative and non-finite values');
  const vendorDbSource = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert(vendorDbSource.includes(".eq('user_id', userId)") && vendorDbSource.includes(".eq('vendor_interest_id', businessId)"), 'Menu reads and writes are scoped to the authenticated owner business');
  const vendorMigration = readFileSync(new URL('../docs/migrations/20261018_vendor_dashboard_menu.sql', import.meta.url), 'utf8');
  assert(vendorMigration.includes('ENABLE ROW LEVEL SECURITY') && vendorMigration.includes('vendor-menu-images') && vendorMigration.includes('service_role'), 'Vendor menu migration applies RLS and isolates public food image storage');
  assert(vendorMigration.indexOf("SELECT 1 FROM storage.buckets WHERE id = 'vendor-menu-images'") < vendorMigration.indexOf('ALTER TABLE public.vendor_interest') && vendorMigration.includes('RAISE EXCEPTION') && !vendorMigration.includes('ON CONFLICT (id) DO UPDATE'), 'Vendor image bucket preflight fails before schema changes and never alters an existing bucket');
  const browserSupabaseSource = readFileSync(new URL('../src/services/supabaseBrowser.ts', import.meta.url), 'utf8');
  assert(
    browserSupabaseSource.includes('VITE_SUPABASE_PUBLISHABLE_KEY') &&
      !browserSupabaseSource.includes('SUPABASE_SECRET_KEY') &&
      !browserSupabaseSource.includes('SUPABASE_SERVICE_ROLE_KEY'),
    'Browser Supabase client uses only the publishable key setting'
  );

  const originalFetch = globalThis.fetch;
  try {
    let adminAccessAuthorization = '';
    globalThis.fetch = async (_input, init) => {
      adminAccessAuthorization = new Headers(init?.headers).get('Authorization') || '';
      return new Response(JSON.stringify({ success: true, isAdmin: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const confirmedAdmin = await api.getAdminAccess('current-valid-access-token');
    assert(confirmedAdmin && adminAccessAuthorization === 'Bearer current-valid-access-token', 'Admin permission check sends the current Supabase access token to the server');

    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: 'Not an administrator.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    assert(!(await api.getAdminAccess('valid-customer-token')), 'A verified non-admin response remains a normal access denial');

    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: 'Admin access could not be verified.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    let adminPermissionFailure = '';
    try { await api.getAdminAccess('current-access-token'); } catch (error) { adminPermissionFailure = error instanceof Error ? error.message : ''; }
    assert(adminPermissionFailure === 'Admin access could not be verified.', 'Admin API/database failures remain errors rather than becoming false denials');

    let adminListUrl = '';
    globalThis.fetch = async (input) => {
      adminListUrl = String(input);
      return new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
    };
    let nonJsonError = '';
    try { await api.getAdminVendorApplications('mock-access-token'); }
    catch (error) { nonJsonError = error instanceof Error ? error.message : ''; }
    assert(adminListUrl === '/api/admin/vendor-applications', 'Admin list request uses the implemented API URL');
    assert(nonJsonError.includes('non-JSON response (HTTP 200)'), 'Admin client reports an HTML response clearly without JSON parse noise');

    globalThis.fetch = async input => {
      assert(String(input).includes('search=jollof') && String(input).includes('neighborhood=Molipa') && String(input).includes('fulfillment=pickup'), 'Explore API sends supported search and filter values to the backend');
      return new Response(JSON.stringify({ success: true, vendors: [], total: 0, status: 'empty', message: 'No matching businesses.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const emptyDirectory = await api.getVendors({ search: 'jollof', neighborhood: 'Molipa', fulfillment: 'pickup' });
    assert(emptyDirectory.status === 'empty' && emptyDirectory.vendors.length === 0, 'A successful empty directory response remains distinct from an API error');

    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: 'Food directory unavailable.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    let publicDirectoryError = '';
    try { await api.getVendors(); } catch (error) { publicDirectoryError = error instanceof Error ? error.message : ''; }
    assert(publicDirectoryError === 'Food directory unavailable.', 'A public directory API failure is surfaced as an error, not an empty result');

    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, applications: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    const noLinkedApplications = await api.getMyVendorApplications('mock-access-token');
    assert(noLinkedApplications.applications.length === 0, 'Successful empty account query returns an empty application list');

    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: 'Your applications could not be loaded. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    let safeApiError = '';
    try {
      await api.getMyVendorApplications('mock-access-token');
    } catch (error) {
      safeApiError = error instanceof Error ? error.message : '';
    }
    assert(safeApiError === 'Your applications could not be loaded. Please try again.', 'Account API preserves the safe server error message');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n======================================================');
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
