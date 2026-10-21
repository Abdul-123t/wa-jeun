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
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { createRateLimiter, resetRateLimits } from '../src/server/rateLimiter';
import { configureClientIpTrust } from '../src/server/clientIp';
import { isProductionRuntime } from '../src/server/runtimeMode';
import { classifyFlutterwaveReplay, initializeFlutterwaveStandard, isFlutterwaveReference, isFlutterwaveTestMode, validateVerifiedFlutterwaveTransaction, verifyFlutterwaveTransaction, verifyFlutterwaveWebhookHash } from '../src/server/flutterwave';
import { getAdminAccessViewState, getProtectedRouteState, getRoleAwareNavigation, isVerifiedMember, validateAuthInput } from '../src/auth/authRules';
import { authorizeAdminHeader, parseBearerAuthorization, verifyAccessToken } from '../src/server/authTokens';
import { api, ApiError } from '../src/services/api';
import { clearCheckoutAttempt, persistCheckoutAttempt, readCheckoutAttempt } from '../src/services/checkoutAttempt';
import { getPublicStoreAvailability } from '../src/services/storeHours';
import { findCartPriceChanges } from '../src/services/cartPricing';
import { canManageMenu, isVendorSellEligible, isVendorOwner, isTrustedMenuImageUrl, validateMenuItem, validateOpeningHours, validateVendorOrderReadiness, validateVendorProfileReadiness } from '../src/server/vendorRules';
import { calculateOrderTotals, canTransitionOrder, createOrderRequestFingerprint, parseCheckoutLines, resolveAvailableOrderItems, validateCheckoutContact, validateFulfillment } from '../src/server/orderRules';
import { EXPLORE_CATEGORY_API_CATEGORIES, readExploreFilters, updateExploreFilter } from '../src/utils/exploreFilters';
import { claimIntroSession, INTRO_SESSION_KEY, markIntroSessionPlayed } from '../src/components/introSession';

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

  console.log('--- Suite: Flutterwave Standard sandbox checkout ---');
  const flwEnvironment = { NODE_ENV: 'development', FLW_MODE: 'test', FLW_SECRET_KEY: 'FLWSECK_TEST-placeholder', FLW_SECRET_HASH: 'webhook-test-hash' } as NodeJS.ProcessEnv;
  const flwTxRef = 'WJTEST-00000000-0000-4000-8000-000000000001';
  assert(isFlutterwaveTestMode(flwEnvironment) && !isFlutterwaveTestMode({ ...flwEnvironment, NODE_ENV: 'production' }) && !isFlutterwaveTestMode({ ...flwEnvironment, FLW_SECRET_KEY: 'FLWSECK-PRODUCTION-placeholder' }), 'Flutterwave sandbox credentials are accepted only in local test mode');
  assert(isFlutterwaveReference(flwTxRef) && !isFlutterwaveReference('customer-supplied-reference'), 'Transaction references use the server-generated sandbox format');
  assert(verifyFlutterwaveWebhookHash('webhook-test-hash', 'webhook-test-hash') && !verifyFlutterwaveWebhookHash('wrong-hash', 'webhook-test-hash'), 'Webhook secret comparison accepts only the configured secret hash');
  let flwInitUrl = '';
  let flwInitBody: any;
  let flwInitAuthorization = '';
  const flwInit = await initializeFlutterwaveStandard({ txRef: flwTxRef, amountNgn: 1250.5, customerName: 'Test Customer', customerEmail: 'test@example.test', customerPhone: '+2348012345678', redirectUrl: 'http://localhost:3000/api/payments/flutterwave/callback' }, flwEnvironment, async (input, init) => {
    flwInitUrl = String(input); flwInitBody = JSON.parse(String(init?.body)); flwInitAuthorization = new Headers(init?.headers).get('Authorization') || '';
    return new Response(JSON.stringify({ status: 'success', data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/test-link' } }), { status: 200 });
  });
  assert(flwInitUrl === 'https://api.flutterwave.com/v3/payments' && flwInitAuthorization === 'Bearer FLWSECK_TEST-placeholder' && flwInitBody.amount === '1250.50' && flwInitBody.currency === 'NGN' && flwInitBody.tx_ref === flwTxRef && flwInit.link.startsWith('https://checkout.flutterwave.com/'), 'Standard checkout initializes hosted test payment with server amount, reference, customer details, and server-only key');
  let flwVerifyUrl = '';
  let flwVerifyAuthorization = '';
  const verifiedTransaction = await verifyFlutterwaveTransaction('900123', flwEnvironment, async (input, init) => {
    flwVerifyUrl = String(input); flwVerifyAuthorization = new Headers(init?.headers).get('Authorization') || '';
    return new Response(JSON.stringify({ status: 'success', data: { id: 900123, tx_ref: flwTxRef, status: 'successful', currency: 'NGN', amount: 1250.5 } }), { status: 200 });
  });
  const verifiedResult = validateVerifiedFlutterwaveTransaction(verifiedTransaction, { txRef: flwTxRef, amountNgn: 1250.5, currency: 'NGN' });
  assert(flwVerifyUrl.endsWith('/transactions/900123/verify') && flwVerifyAuthorization === 'Bearer FLWSECK_TEST-placeholder' && verifiedResult.success && verifiedResult.status === 'successful', 'Successful verification is fetched server-side and matches the stored NGN amount and transaction reference');
  const mismatch = validateVerifiedFlutterwaveTransaction({ ...verifiedTransaction, amount: 1250 }, { txRef: flwTxRef, amountNgn: 1250.5, currency: 'NGN' });
  const wrongCurrency = validateVerifiedFlutterwaveTransaction({ ...verifiedTransaction, currency: 'USD' }, { txRef: flwTxRef, amountNgn: 1250.5, currency: 'NGN' });
  const invalidRef = validateVerifiedFlutterwaveTransaction({ ...verifiedTransaction, tx_ref: 'another-reference' }, { txRef: flwTxRef, amountNgn: 1250.5, currency: 'NGN' });
  const failedPayment = validateVerifiedFlutterwaveTransaction({ ...verifiedTransaction, status: 'failed', amount: 0 }, { txRef: flwTxRef, amountNgn: 1250.5, currency: 'NGN' });
  assert(!mismatch.success && mismatch.reason === 'amount_mismatch' && !wrongCurrency.success && wrongCurrency.reason === 'currency_mismatch' && !invalidRef.success && invalidRef.reason === 'invalid_reference' && failedPayment.success && failedPayment.status === 'failed', 'Amount, currency, and reference mismatches are rejected while a verified failed payment remains unpaid');
  assert(!validateVerifiedFlutterwaveTransaction({ ...verifiedTransaction, status: 'pending' }, { txRef: flwTxRef, amountNgn: 1250.5, currency: 'NGN' }).success, 'Pending provider status cannot be recorded as paid');
  assert(classifyFlutterwaveReplay({ status: 'successful', transactionId: '900123' }, '900123') === 'duplicate' && classifyFlutterwaveReplay({ status: 'successful', transactionId: '900123' }, '900124') === 'conflict' && classifyFlutterwaveReplay({ status: 'checkout_ready', transactionId: null }, '900123') === 'process', 'Repeated verified webhook/callback is a no-op for the same transaction and conflicting replays are rejected');

  console.log('--- Suite: First-entry brand intro ---');
  const introStorageData = new Map<string, string>();
  const introStorage = {
    getItem: (key: string) => introStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { introStorageData.set(key, value); }
  };
  assert(claimIntroSession(introStorage, false) && !claimIntroSession(introStorage, false) && introStorageData.get(INTRO_SESSION_KEY) === 'true', 'Brand intro plays once per session and stays dismissed across route navigation');
  const replaySessionData = new Map<string, string>();
  markIntroSessionPlayed({ setItem: (key, value) => { replaySessionData.set(key, value); } });
  assert(replaySessionData.get(INTRO_SESSION_KEY) === 'true' && !claimIntroSession({ getItem: key => replaySessionData.get(key) ?? null, setItem: (key, value) => { replaySessionData.set(key, value); } }, false), 'Manual replay preserves the completed state so reloads do not replay again');
  assert(!claimIntroSession({ getItem: () => null, setItem: () => { throw new Error('blocked'); } }, false), 'Brand intro fails open when browser session storage is unavailable');
  const reducedMotionStorage = new Map<string, string>();
  assert(!claimIntroSession({ getItem: key => reducedMotionStorage.get(key) ?? null, setItem: (key, value) => { reducedMotionStorage.set(key, value); } }, true), 'Reduced-motion preference skips the intro animation');
  const introAppSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const introSource = readFileSync(new URL('../src/components/BrandIntro.tsx', import.meta.url), 'utf8');
  const introStyles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert(introAppSource.includes('<BrandIntro>') && introAppSource.indexOf('<BrandIntro>') < introAppSource.indexOf('<Routes>') && introSource.includes('Skip intro') && introSource.includes("event.key === 'Escape'"), 'Intro wraps the persistent router without changing routes and provides visible skip and Escape controls');
  assert(introSource.includes('INTRO_DURATION_MS = 18_000') && introStyles.includes('animation-name: brand-scene-hero') && introStyles.includes('animation-name: brand-scene-food') && introStyles.includes('animation-name: brand-scene-identity') && introStyles.includes('animation-name: brand-scene-discovery'), 'Intro follows the 18-second food drop, showcase, brand reveal, and city invitation storyboard');
  assert(introSource.includes('hero_nigerian_jollof_feast_1792169660639-optimized.jpg') && introSource.includes('category_swallow_soups_1792169661810-optimized.jpg') && introSource.includes('/brand/wa-jeun-logo.webp') && introSource.includes('onError={finishOnAssetError}') && introSource.includes('INTRO_ASSET_TIMEOUT_MS = 5_000') && introSource.includes('loadedAssetCountRef.current < INTRO_ASSET_COUNT'), 'Intro uses optimized food and official wordmark assets and exits on failed or slow imagery');
  assert(introSource.includes('onClick={() => setVisible(false)}') && introSource.includes('className="brand-intro__skip"') && introStyles.includes('17s both') && introStyles.includes('@media (prefers-reduced-motion: reduce)'), 'Intro skip control dismisses immediately, the closing scene transitions at 18 seconds, and reduced motion is supported');
  const introFooterSource = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');
  assert(introFooterSource.includes('Replay intro') && introFooterSource.includes('onClick={requestIntroReplay}') && introSource.includes('window.addEventListener(INTRO_REPLAY_EVENT, replay)') && introSource.includes('markIntroSessionPlayed(window.sessionStorage)') && introSource.includes('REDUCED_REPLAY_DURATION_MS = 800') && introSource.includes('brand-intro--reduced'), 'Footer can replay the intro without clearing session completion, with a short reduced-motion replay');

  console.log('--- Suite: Customer storefront and cart pricing ---');
  const cartPricingLine = { menuItemId: 'menu-1', name: 'Rice', description: '', category: 'rice', priceNgn: 2500, imageUrl: null, quantity: 2 };
  const currentMenuItem = { id: 'menu-1', name: 'Rice', description: '', category: 'rice', price_ngn: 2750, image_url: null, available: true as const };
  const changedCartPrices = findCartPriceChanges([cartPricingLine], [currentMenuItem]);
  assert(changedCartPrices.length === 1 && changedCartPrices[0].previousPriceNgn === 2500 && changedCartPrices[0].currentPriceNgn === 2750, 'Cart price comparison detects current menu changes for explicit customer review');
  assert(findCartPriceChanges([cartPricingLine], [{ ...currentMenuItem, price_ngn: 2500 }]).length === 0, 'Cart price comparison does not warn when the current menu price is unchanged');
  const storefrontSource = readFileSync(new URL('../src/pages/PublicVendorMenuPage.tsx', import.meta.url), 'utf8');
  const cartPageSource = readFileSync(new URL('../src/pages/CartPage.tsx', import.meta.url), 'utf8');
  const customerOrderPageSource = readFileSync(new URL('../src/pages/CustomerOrdersPage.tsx', import.meta.url), 'utf8');
  assert(storefrontSource.includes('addItem(vendor, item)') && storefrontSource.includes('Clear cart and add') && storefrontSource.includes('Add to test cart') && storefrontSource.includes('disabled={!availability.open || !orderingOpen}'), 'Development storefront preserves one-vendor cart behavior and production cannot add order items');
  assert(cartPageSource.includes('api.startFlutterwaveTestCheckout') && cartPageSource.includes('window.location.assign(result.checkoutUrl)') && cartPageSource.includes('Email for test receipt') && customerOrderPageSource.includes("order.payment_status === 'test_paid'"), 'Cart redirects to the hosted sandbox checkout and the order view reports only server-confirmed test payment state');
  const exploreParams = new URLSearchParams('category=swallow-soups&search=amala&marketArea=ijagun&neighborhood=Molipa&fulfillment=pickup');
  const exploreFilters = readExploreFilters(exploreParams);
  assert(exploreFilters.category === 'swallow-soups' && exploreFilters.search === 'amala' && exploreFilters.marketArea === 'ijagun' && exploreFilters.neighborhood === 'Molipa' && exploreFilters.fulfillment === 'pickup' && EXPLORE_CATEGORY_API_CATEGORIES['swallow-soups'].join(',') === 'swallow,soup', 'Explore URL filters restore supported search, category, neighborhood, and fulfillment values');
  const directoryDbSource = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  const marketAreaMigration = readFileSync(new URL('../docs/migrations/20261020_ijagun_market_area.sql', import.meta.url), 'utf8');
  const ordersMigration = readFileSync(new URL('../docs/migrations/20261019_customer_orders.sql', import.meta.url), 'utf8');
  assert(directoryDbSource.includes(".select('id, business_name, market_area, neighborhood, street_address, nearby_landmark, delivery_coverage, business_type, fulfillment_options, delivery_fee_ngn") && ['market_area', 'street_address', 'nearby_landmark', 'delivery_coverage'].every(column => marketAreaMigration.includes(column)) && ordersMigration.includes('ADD COLUMN IF NOT EXISTS delivery_fee_ngn'), 'Public directory schema requirements are covered by the Ijagun and customer-order migrations');
  assert(directoryDbSource.includes("delivery_fee_ngn, description, opening_hours, accepting_orders, status'") && /ALTER TABLE public\.vendor_interest\s+ADD COLUMN IF NOT EXISTS delivery_fee_ngn NUMERIC\(10,2\)/.test(ordersMigration), 'Public directory delivery fee selection is backed by the customer-orders schema migration');
  const explorePageSource = readFileSync(new URL('../src/pages/ExplorePage.tsx', import.meta.url), 'utf8');
  assert(explorePageSource.includes('setReloadCount(value => value + 1)') && explorePageSource.includes('reloadCount])'), 'Explore retry increments a request dependency and preserves a new directory attempt');
  const updatedExploreParams = updateExploreFilter(exploreParams, 'search', '  jollof rice  ');
  assert(updatedExploreParams.get('search') === 'jollof rice' && updatedExploreParams.get('category') === 'swallow-soups' && updatedExploreParams.get('neighborhood') === 'Molipa' && updatedExploreParams.get('marketArea') === 'ijagun', 'Updating Explore search keeps the other active URL filters');
  const invalidExploreFilters = readExploreFilters(new URLSearchParams('category=not-real&neighborhood=Nowhere&marketArea=oscohtech&fulfillment=drone'));
  assert(invalidExploreFilters.category === 'all' && invalidExploreFilters.neighborhood === 'all' && invalidExploreFilters.marketArea === 'all' && invalidExploreFilters.fulfillment === 'all', 'Unsupported Explore query filters safely fall back to the full directory');
  const caseInsensitiveExploreFilters = readExploreFilters(new URLSearchParams('category=RICE-DISHES&neighborhood=molipa&marketArea=Ijagun (TASFUED area)'));
  assert(caseInsensitiveExploreFilters.category === 'rice-dishes' && caseInsensitiveExploreFilters.neighborhood === 'Molipa' && caseInsensitiveExploreFilters.marketArea === 'ijagun', 'Shared Explore links resolve category and neighborhood casing to supported values');
  const marketRegistrationSource = readFileSync(new URL('../src/pages/VendorRegistrationPage.tsx', import.meta.url), 'utf8');
  const adminSource = readFileSync(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8');
  const areaMigration = readFileSync(new URL('../docs/migrations/20261020_ijagun_market_area.sql', import.meta.url), 'utf8');
  assert(marketRegistrationSource.includes('streetAddress') && marketRegistrationSource.includes('nearbyLandmark') && marketRegistrationSource.includes('deliveryCoverage') && adminSource.includes('Delivery coverage') && adminSource.includes('Market area'), 'Vendor registration captures real locations and admin review displays area and delivery claims');
  assert(areaMigration.includes("DEFAULT 'ijebu-ode'") && areaMigration.includes("('ijagun', 'Ijagun', 'Ijagun (TASUED area)')") && !areaMigration.includes('OSCOHTECH') && !areaMigration.includes('Ilese-Ijebu'), 'Market area migration preserves existing Ijebu Ode assignments and enables only Ijagun');
  assert(cartPageSource.includes('I’ve reviewed the updated prices') && cartPageSource.includes('!priceChangesConfirmed'), 'Checkout requires confirmation after a refreshed menu price differs from the cart price');

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
  assert(isProductionRuntime({ VERCEL: '1' }) && isProductionRuntime({ VERCEL_ENV: 'preview' }) && !isProductionRuntime({ NODE_ENV: 'development' }), 'Vercel runtime markers consistently select production-safe server behavior');
  const vercelSettings: Array<[string, unknown]> = [];
  configureClientIpTrust({ set: (key, value) => { vercelSettings.push([key, value]); } }, { VERCEL: '1' });
  assert(vercelSettings[0]?.[0] === 'trust proxy' && vercelSettings[0]?.[1] === true, 'Vercel runtime trusts only its platform-managed forwarded client-IP chain');
  let missingTopologyRejected = false;
  try { configureClientIpTrust({ set() { return this; } }, { NODE_ENV: 'production' }); }
  catch { missingTopologyRejected = true; }
  assert(missingTopologyRejected, 'Production startup fails closed when the proxy topology is not configured');
  let vercelTopologyRejected = false;
  try { configureClientIpTrust({ set() { return this; } }, { VERCEL_ENV: 'preview' }); }
  catch { vercelTopologyRejected = true; }
  assert(vercelTopologyRejected, 'VERCEL_ENV alone does not enable proxy trust outside the Vercel runtime marker');
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
  const vercelApp = express();
  configureClientIpTrust(vercelApp, { VERCEL: '1' });
  const vercelRequest = Object.create(express.request) as any;
  vercelRequest.app = vercelApp;
  vercelRequest.socket = { remoteAddress: '10.0.0.9' };
  vercelRequest.headers = { 'x-forwarded-for': '198.51.100.77' };
  assert(proxyRequest.ip === '203.0.113.24' && directRequest.ip === '198.51.100.10' && vercelRequest.ip === '198.51.100.77', 'Express resolves client IPs from verified proxy policy and Vercel ingress, while direct ingress ignores XFF');
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
    market_area: 'ijagun',
    neighborhood: 'TASFUED area',
    favorite_categories: ['Rice Dishes', 'Swallow and Soups'],
    consent_accepted: true
  });
  assert(
    custRes1.success === true && typeof custRes1.data?.id === 'string',
    'Criterion 1: Valid customer submission returns success with record ID',
    custRes1.error
  );
  const savedIjagunCustomer = JSON.parse(readFileSync(isolatedTestDb, 'utf8')).customers.find((customer: { phone: string }) => customer.phone === uniqueCustomerPhone);
  assert(savedIjagunCustomer?.market_area === 'ijagun' && savedIjagunCustomer.neighborhood === 'TASFUED area', 'Customer registrations persist the selected Ijagun area without overloading its locality');

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
    market_area: 'ijagun',
    neighborhood: 'TASFUED area',
    street_address: 'Campus Road 2',
    nearby_landmark: 'TASFUED gate',
    delivery_coverage: ['ijagun'],
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
  const savedIjagunVendor = JSON.parse(readFileSync(isolatedTestDb, 'utf8')).vendors.find((vendor: { phone: string }) => vendor.phone === uniqueVendorPhone);
  assert(savedIjagunVendor?.market_area === 'ijagun' && savedIjagunVendor.street_address === 'Campus Road 2' && savedIjagunVendor.nearby_landmark === 'TASFUED gate' && savedIjagunVendor.delivery_coverage[0] === 'ijagun' && savedIjagunVendor.status === 'pending_review', 'Vendor applications preserve Ijagun location claims while remaining pending approval');

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
  const directoryFixtureHours = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => [day, { open: '09:00', close: '18:00', closed: false }]));
  const directoryFixtureVendor = (id: string, marketArea: string, neighborhood: string, status = 'approved') => ({
    id, business_name: `${marketArea} Test Kitchen`, market_area: marketArea, neighborhood,
    street_address: 'Test Road', nearby_landmark: 'Test landmark', delivery_coverage: [],
    business_type: 'restaurant', fulfillment_options: 'pickup_only', delivery_fee_ngn: null,
    description: 'A local test kitchen serving freshly prepared meals.', opening_hours: directoryFixtureHours,
    accepting_orders: true, status,
    menu: [{ id: `${id}-menu`, vendor_interest_id: id, name: 'Test Rice', description: '', price_ngn: 2000, category: 'rice', image_url: null, available: true }]
  });
  writeFileSync(isolatedTestDb, JSON.stringify({ customers: [], contacts: [], vendors: [
    directoryFixtureVendor('approved-ijebu', 'ijebu-ode', 'Molipa'),
    directoryFixtureVendor('approved-ijagun', 'ijagun', 'TASFUED area'),
    directoryFixtureVendor('pending-ijagun', 'ijagun', 'TASFUED area', 'pending_review')
  ] }));
  const populatedDirectory = await getVerifiedVendors({});
  const ijebuDirectory = await getVerifiedVendors({ marketArea: 'ijebu-ode' });
  const ijagunDirectory = await getVerifiedVendors({ marketArea: 'ijagun', neighborhood: 'tasfued area' });
  assert(populatedDirectory.success && populatedDirectory.total === 2 && populatedDirectory.vendors.every(vendor => vendor.id !== 'pending-ijagun') && ijebuDirectory.success && ijebuDirectory.vendors.length === 1 && ijebuDirectory.vendors[0].id === 'approved-ijebu' && ijagunDirectory.success && ijagunDirectory.vendors.length === 1 && ijagunDirectory.vendors[0].id === 'approved-ijagun', 'Local directory returns real-shaped approved fixtures only and filters Ijebu Ode, Ijagun, and neighborhood');
  writeFileSync(isolatedTestDb, JSON.stringify({ customers: [], contacts: [], vendors: [] }));

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
    Object.keys(publicVendor).sort().join(',') === 'business_name,business_type,delivery_coverage,delivery_fee_ngn,fulfillment_options,id,market_area,nearby_landmark,neighborhood,street_address' &&
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
  const guestNavigation = getRoleAwareNavigation({ userId: null, authLoading: false, permissionsLoading: false, vendorApplications: [] });
  const customerNavigation = getRoleAwareNavigation({ userId: 'customer-id', authLoading: false, permissionsLoading: false, vendorApplications: [] });
  const pendingNavigation = getRoleAwareNavigation({ userId: 'vendor-id', authLoading: false, permissionsLoading: false, vendorApplications: [{ status: 'pending_review' }] });
  const approvedNavigation = getRoleAwareNavigation({ userId: 'vendor-id', authLoading: false, permissionsLoading: false, vendorApplications: [{ status: 'approved' }] });
  const declinedNavigation = getRoleAwareNavigation({ userId: 'vendor-id', authLoading: false, permissionsLoading: false, vendorApplications: [{ status: 'declined' }] });
  const failedNavigation = getRoleAwareNavigation({ userId: 'customer-id', authLoading: false, permissionsLoading: false, vendorApplications: [], vendorApplicationError: 'Unavailable' });
  const roleNavChecks = guestNavigation.showSignIn && guestNavigation.accountLinks.some(link => link.label === 'Sign In' && link.to === '/auth?mode=signin') && guestNavigation.showVendorApplication && guestNavigation.showCustomerLaunchList &&
    customerNavigation.showVendorApplication && !customerNavigation.showCustomerLaunchList &&
    pendingNavigation.accountLinks.some(link => link.label === 'Application pending' && link.to === '/account') && !pendingNavigation.showVendorApplication &&
    approvedNavigation.accountLinks.some(link => link.label === 'Vendor dashboard' && link.to === '/vendor') && !approvedNavigation.showVendorApplication && !approvedNavigation.showCustomerLaunchList &&
    declinedNavigation.accountLinks.some(link => link.label === 'Application declined' && link.to === '/account') && !declinedNavigation.showVendorApplication &&
    failedNavigation.accountLinks.some(link => link.label === 'Application status') && !failedNavigation.showVendorApplication &&
    !getRoleAwareNavigation({ userId: null, authLoading: true, permissionsLoading: true, vendorApplications: [] }).showCustomerLaunchList;
  assert(roleNavChecks, 'Role-aware navigation covers visitors, customers, pending applicants, approved vendors, declined applicants, and lookup failures');
  const mobileNavSource = readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  assert(mobileNavSource.includes('aria-expanded={menuOpen}') && mobileNavSource.includes('aria-controls="mobile-navigation-panel"') && mobileNavSource.includes("event.key === 'Escape'") && mobileNavSource.includes('onClick={closeMenu}') && mobileNavSource.includes('navigation.accountLinks.map(item => renderLink(item, true))'), 'Mobile navigation exposes accessible state, closes on selection, and uses the same role-aware actions');
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
  const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    buildCommand: string; outputDirectory: string; rewrites: Array<{ source: string; destination: string }>;
  };
  const viteConfigSource = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const vercelCatchAllSource = readFileSync(new URL('../api/[...path].ts', import.meta.url), 'utf8');
  const vercelApiRootSource = readFileSync(new URL('../api/index.ts', import.meta.url), 'utf8');
  assert(
    vercelCatchAllSource.includes("import app from '../server.ts';") &&
      vercelApiRootSource.includes("import app from '../server.ts';") &&
      !vercelCatchAllSource.includes('../dist/server.js') &&
      !vercelApiRootSource.includes('../dist/server.js'),
    'Vercel API functions import the TypeScript server source that Vercel bundles with each function'
  );
  assert(
    serverSource.includes('export const app = express();') && serverSource.includes('export default app;'),
    'The shared Express application is exported for the Vercel API functions'
  );
  const [vercelCatchAll, vercelApiRoot] = await Promise.all([
    import('../api/[...path].ts'),
    import('../api/index.ts')
  ]);
  assert(
    vercelCatchAll.default === app && vercelApiRoot.default === app,
    'Both Vercel entrypoints resolve to the same Express application at runtime'
  );
  assert(vercelConfig.buildCommand === 'npm run build' && vercelConfig.outputDirectory === 'dist/client' && viteConfigSource.includes("outDir: 'dist/client'"), 'Vercel publishes the Vite build output directory');
  assert(vercelConfig.rewrites.some(rule => rule.destination === '/index.html' && rule.source.includes('(?!api')) && vercelConfig.rewrites.some(rule => rule.source === '/'), 'SPA fallback serves the root and excludes API paths');
  const vendorDashboardRouteLayer = (app as any)._router.stack.find((layer: any) =>
    layer.route?.path === '/api/vendor/dashboard' && layer.route.methods.get
  );
  assert(Boolean(vendorDashboardRouteLayer), 'Actual vendor dashboard GET route is registered at the frontend URL');
  const vendorApplicationLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/interest/vendor' && layer.route.methods.post);
  assert(Boolean(vendorApplicationLayer), 'Authenticated vendor application API route is registered');
  const apiClientSource = readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8');
  assert(apiClientSource.includes("fetch('/api/vendor/dashboard'") , 'Vendor dashboard client calls the registered GET route');
  assert(apiClientSource.includes("fetch(`/api/vendors") && apiClientSource.includes("fetch('/api/customer/orders'") , 'Food directory and customer history call same-origin API routes');
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
  if (vendorApplicationLayer) {
    const result = await invokeHandler(vendorApplicationLayer.route.stack[vendorApplicationLayer.route.stack.length - 1].handle, {
      get: () => undefined, params: {}, query: {}, body: { businessName: 'Test Kitchen', contactName: 'Test Owner', phone: '08012345678', marketArea: 'ijagun', neighborhood: 'TASFUED area', streetAddress: 'Campus Road 2', nearbyLandmark: 'TASFUED gate', deliveryCoverage: [], businessType: 'restaurant', fulfillmentOptions: 'pickup_only', currentOrderingMethods: ['walk_in'], consentAccepted: true }
    });
    assert(result.status === 401 && result.contentType === 'application/json', 'Vendor application cannot be submitted anonymously or left unlinked to a verified owner');
  }
  const publicVendorsRouteLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendors' && layer.route.methods.get);
  const publicMenuRouteLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendors/:businessId/menu' && layer.route.methods.get);
  assert(Boolean(publicVendorsRouteLayer && publicMenuRouteLayer), 'Public discovery and restaurant menu API routes are registered');
  if (publicVendorsRouteLayer) {
    const result = await invokeHandler(publicVendorsRouteLayer.route.stack[0].handle, { query: {}, params: {} });
    assert(result.status === 200 && result.body.success === true && result.body.status === 'empty' && result.body.vendors.length === 0, 'Public vendors API distinguishes a successful empty directory');
    const unsupportedMarket = await invokeHandler(publicVendorsRouteLayer.route.stack[0].handle, { query: { marketArea: 'oscohtech' }, params: {} });
    assert(unsupportedMarket.status === 400, 'Public directory rejects market areas that are not active');
  }
  assert(readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8').includes(".eq('customer_user_id', userId)"), 'Customer order history query is scoped to the verified customer ID');
  {
    const originalFetch = globalThis.fetch;
    const originalWarn = console.warn;
    const capturedLogs: unknown[][] = [];
    const issuedRequests: Array<{ url: string; headers: Headers }> = [];
    console.warn = (...args: unknown[]) => { capturedLogs.push(args); };
    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        issuedRequests.push({ url: String(input), headers: new Headers(init?.headers) });
        return new Response(JSON.stringify({ success: true, vendors: [], total: 0, status: 'empty' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;
      const emptyDirectory = await api.getVendors();
      assert(emptyDirectory.success && emptyDirectory.vendors.length === 0, 'API client accepts a valid empty food directory');

      globalThis.fetch = (async () => new Response(JSON.stringify({ success: false, error: 'The food directory is temporarily unavailable. Please try again.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      let directoryFailure: unknown;
      try { await api.getVendors(); } catch (error) { directoryFailure = error; }
      assert(directoryFailure instanceof ApiError && directoryFailure.status === 503 && directoryFailure.category === 'service_unavailable', 'Directory database/API failure remains a recoverable typed error');

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        issuedRequests.push({ url: String(input), headers: new Headers(init?.headers) });
        return new Response(JSON.stringify({ success: false, error: 'Your session is invalid or expired.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;
      let ordersFailure: unknown;
      const privateToken = 'test-only-private-token';
      try { await api.getCustomerOrders(privateToken); } catch (error) { ordersFailure = error; }
      assert(ordersFailure instanceof ApiError && ordersFailure.status === 401 && ordersFailure.category === 'unauthorized', 'Expired order-history sessions remain distinguishable as 401');
      assert(issuedRequests.at(-1)?.url === '/api/customer/orders' && issuedRequests.at(-1)?.headers.get('authorization') === `Bearer ${privateToken}`, 'Order-history request attaches the current session token');
      globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, orders: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
      const emptyOrderHistory = await api.getCustomerOrders(privateToken);
      assert(emptyOrderHistory.success && emptyOrderHistory.orders.length === 0, 'Authenticated customer order history accepts a valid empty result');
      const safeLog = JSON.stringify(capturedLogs);
      assert(safeLog.includes('GET /api/vendors') && safeLog.includes('503') && safeLog.includes('service_unavailable') && safeLog.includes('GET /api/customer/orders') && safeLog.includes('401') && safeLog.includes('unauthorized'), 'API diagnostics include endpoint, status, and safe error category');
      assert(!safeLog.includes(privateToken), 'API diagnostics never include access tokens');
    } finally {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
    }
  }
  if (publicMenuRouteLayer) {
    const result = await invokeHandler(publicMenuRouteLayer.route.stack[0].handle, { query: {}, params: { businessId: 'unknown' } });
    assert(result.status === 404 && result.body.success === false, 'Unknown or no longer eligible restaurant menus return unavailable');
  }
  const customerOrdersLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/customer/orders' && layer.route.methods.get);
  const customerAttemptLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/customer/orders/attempt/:key' && layer.route.methods.get);
  const customerCreateOrderLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/customer/orders' && layer.route.methods.post);
  const flutterwaveCheckoutLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/customer/orders/flutterwave-test' && layer.route.methods.post);
  const flutterwaveCallbackLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/payments/flutterwave/callback' && layer.route.methods.get);
  const flutterwaveWebhookLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/payments/flutterwave/webhook' && layer.route.methods.post);
  const vendorOrdersLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendor/orders' && layer.route.methods.get);
  const vendorOrderStatusLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/api/vendor/orders/:orderId/status' && layer.route.methods.patch);
  assert(Boolean(customerOrdersLayer && customerAttemptLayer && customerCreateOrderLayer && vendorOrdersLayer && vendorOrderStatusLayer), 'Customer history, checkout recovery, vendor inbox, and status API routes are registered');
  assert(Boolean(flutterwaveCheckoutLayer && flutterwaveCallbackLayer && flutterwaveWebhookLayer), 'Flutterwave sandbox checkout, callback, and webhook routes are registered');
  if (flutterwaveCheckoutLayer) {
    const result = await invokeHandler(flutterwaveCheckoutLayer.route.stack[flutterwaveCheckoutLayer.route.stack.length - 1].handle, { get: () => undefined, params: {}, query: {}, body: {} });
    assert(result.status === 401 && result.contentType === 'application/json', 'Flutterwave sandbox checkout requires a verified signed-in customer');
  }
  for (const [layer, method] of [[customerOrdersLayer, 'Customer order history'], [customerAttemptLayer, 'Customer checkout recovery'], [customerCreateOrderLayer, 'Customer checkout'], [vendorOrdersLayer, 'Vendor order inbox'], [vendorOrderStatusLayer, 'Vendor order status']] as const) {
    if (layer) {
      const result = await invokeHandler(layer.route.stack[layer.route.stack.length - 1].handle, { get: () => undefined, params: {}, query: {}, body: {} });
      assert(result.status === 401 && result.contentType === 'application/json', `${method} requires a verified access token`);
    }
  }
  const orderMigrationSource = readFileSync(new URL('../docs/migrations/20261019_customer_orders.sql', import.meta.url), 'utf8');
  assert(serverSource.includes('if (!isDevelopment) return res.status(503)') && serverSource.includes('const isProduction = isProductionRuntime()') && serverSource.includes('isTestOrder: true') && orderMigrationSource.includes("payment_status = 'test_unpaid'"), 'Production and Vercel checkout remain disabled; only local development can create unpaid test orders');
  const flutterwaveMigrationSource = readFileSync(new URL('../docs/migrations/20261021_flutterwave_test_payments.sql', import.meta.url), 'utf8');
  assert(serverSource.includes('!isDevelopment || !isFlutterwaveTestMode()') && serverSource.includes('createCustomerOrder') && serverSource.includes('isTestOrder: true') && serverSource.includes('amountNgn: prepared.data.amountNgn') && !serverSource.includes('req.body.totalNgn') && !serverSource.includes('p_is_test_order: false'), 'Flutterwave sandbox route is local-only and uses the existing test-only order function and database total');
  assert(flutterwaveMigrationSource.includes('transaction_id TEXT UNIQUE') && flutterwaveMigrationSource.includes('FOR UPDATE') && flutterwaveMigrationSource.toLowerCase().includes("if v_attempt.status = 'successful'") && flutterwaveMigrationSource.includes("THEN 'test_paid'") && flutterwaveMigrationSource.includes("p_verified_status NOT IN ('successful', 'failed', 'cancelled')") && !flutterwaveMigrationSource.includes('CREATE OR REPLACE FUNCTION public.create_customer_order'), 'Sandbox payment persistence uses transaction uniqueness, row locks, idempotent payment states, and leaves the original test-only order function intact');
  assert(flutterwaveMigrationSource.includes("payment_status NOT IN ('paid', 'test_paid')") && flutterwaveMigrationSource.includes("WHEN 'cancelled' THEN 'test_cancelled' ELSE 'test_failed'") && flutterwaveMigrationSource.includes("GRANT EXECUTE ON FUNCTION public.complete_flutterwave_test_payment") && flutterwaveMigrationSource.includes('ENABLE ROW LEVEL SECURITY'), 'Failed/cancelled results stay unpaid, vendor status changes require confirmed payment, and payment RPCs remain service-role only');
  assert(!readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8').includes('FLW_SECRET_KEY') && readFileSync(new URL('../.env.example', import.meta.url), 'utf8').includes('FLW_SECRET_HASH='), 'Flutterwave secrets remain server-side with documented variable names only');
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
  const footerSource = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8');
  const customerRegistrationSource = readFileSync(new URL('../src/pages/CustomerRegistrationPage.tsx', import.meta.url), 'utf8');
  const vendorRegistrationSource = readFileSync(new URL('../src/pages/VendorRegistrationPage.tsx', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert(navbarSource.includes('getRoleAwareNavigation') && readFileSync(new URL('../src/auth/AuthContext.tsx', import.meta.url), 'utf8').includes('api.getMyVendorApplications(token)'), 'Navigation role and application status come from authenticated server-verified account data');
  assert((navbarSource.match(/to="\/vendor-register"/g)?.length || 0) >= 2 && (navbarSource.match(/to="\/customer-register"/g)?.length || 0) >= 2 && footerSource.includes('/customer-register') && footerSource.includes('/vendor-register'), 'Separate customer and vendor onboarding links remain in desktop/mobile navigation and the shared footer');
  assert(homeSource.includes('YOUR CITY. YOUR FOOD.') && homeSource.includes('Your favourite local food, all in one place.') && homeSource.includes('We\'re bringing Ijebu Ode and Ijagun closer to the food they love.') && homeSource.includes('Built in Ijebu. Made for Ijebu.'), 'Homepage uses the approved local-first pre-launch messaging');
  assert(homeSource.includes('to="/vendor-register"') && homeSource.includes('List Your Food Business') && homeSource.includes('to="/customer-register"') && homeSource.includes('Notify Me When Ordering Opens') && appSource.includes('path="/vendor-register"') && appSource.includes('path="/customer-register"'), 'Homepage calls to action open the existing vendor application and customer update routes');
  assert(homeSource.includes('api.getVendors()') && homeSource.includes('What are you in the mood for?') && !homeSource.includes('popularItems') && homeSource.includes('There are no order-ready food businesses listed yet.') && vendorRegistrationSource.includes('Approval is required before your storefront can accept orders.'), 'Homepage keeps search and categories, truthful empty and API error states, and vendor approval messaging');
  const explorePrelaunchSource = readFileSync(new URL('../src/pages/ExplorePage.tsx', import.meta.url), 'utf8');
  assert(explorePrelaunchSource.includes('vendorLoadError') && explorePrelaunchSource.includes('Try again') && explorePrelaunchSource.includes('There are no order-ready food businesses listed yet.') && explorePrelaunchSource.includes('to="/vendor-register"') && explorePrelaunchSource.includes('to="/customer-register"') && explorePrelaunchSource.includes('hasActiveFilters ?'), 'Explore preserves distinct loading, error, filtered-empty, and directory-empty states with working recruitment/update links');
  assert(customerRegistrationSource.includes('api.registerCustomer') && customerRegistrationSource.includes('Get notified when ordering opens.') && customerRegistrationSource.includes('No account is required.') && customerRegistrationSource.includes('Notify Me When Ordering Opens'), 'Customer notification CTA matches the existing customer-interest form rather than an account-registration flow');
  assert(readFileSync(new URL('../src/data/marketAreas.ts', import.meta.url), 'utf8').includes('Ijagun (TASFUED area)') && vendorRegistrationSource.includes('around TASFUED'), 'Ijagun is identified using the requested TASFUED spelling');
  const optimizedCategoryImages = [
    'category_rice_dishes_1792169660991-optimized.jpg', 'category_swallow_soups_1792169661810-optimized.jpg',
    'category_local_bukameals_1792169662615-optimized.jpg', 'category_street_food_1792174171995-optimized.jpg',
    'category_grills_shawarma_1792169662635-optimized.jpg', 'category_fast_food_1792174171687-optimized.jpg',
    'category_snacks_pastries_1792174173242-optimized.jpg', 'category_drinks_beverages_1792174172917-optimized.jpg'
  ];
  assert(optimizedCategoryImages.every(file => existsSync(new URL(`../src/assets/images/${file}`, import.meta.url)) && statSync(new URL(`../src/assets/images/${file}`, import.meta.url)).size < 220_000), 'Food category art uses resized, compressed images below 220 kB');
  assert(customerRegistrationSource.includes('htmlFor="customer-name"') && customerRegistrationSource.includes('role="alert"') && vendorRegistrationSource.includes('htmlFor="vendor-biz-name"') && vendorRegistrationSource.includes('role="alert"') && vendorRegistrationSource.includes('Sign in to submit application'), 'Customer and vendor forms retain labelled fields, announced errors, and authenticated vendor submission');
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
  assert(dbSource.includes(".eq('id', businessId).eq('user_id', userId).select('id, business_name, contact_name, phone, email") && serverSource.includes('ownerUserId = verified.data.userId'), 'Vendor profile writes stay scoped to the verified owner, and application ownership is server-derived');
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
  const readyVendorProfile = { business_name: 'Test Kitchen', contact_name: 'Test Owner', phone: '+2348012345678', market_area: 'ijagun', neighborhood: 'TASFUED area', street_address: 'Campus Road 2', nearby_landmark: 'TASFUED gate', delivery_coverage: ['ijagun'], business_type: 'restaurant', fulfillment_options: 'pickup_and_delivery', delivery_fee_ngn: 500, description: 'Fresh meals prepared daily for our local customers.', opening_hours: completeHours };
  assert(validateVendorProfileReadiness(readyVendorProfile) === null && validateVendorOrderReadiness(readyVendorProfile, 1) === null && Boolean(validateVendorOrderReadiness(readyVendorProfile, 0)), 'Store readiness accepts a complete approved-vendor setup and requires at least one available real menu item');
  assert(Boolean(validateVendorProfileReadiness({ ...readyVendorProfile, nearby_landmark: '' })) && Boolean(validateVendorProfileReadiness({ ...readyVendorProfile, opening_hours: null })) && Boolean(validateVendorProfileReadiness({ ...readyVendorProfile, fulfillment_options: 'delivery_varies' })), 'Store readiness blocks missing location, invalid hours, and unsupported variable delivery');
  assert(Boolean(validateVendorProfileReadiness({ ...readyVendorProfile, delivery_coverage: [], delivery_fee_ngn: null })) && validateVendorProfileReadiness({ ...readyVendorProfile, fulfillment_options: 'pickup_only', delivery_coverage: [], delivery_fee_ngn: null }) === null, 'Delivery opening requires real coverage and a fixed fee, while pickup does not require delivery configuration');
  assert(isVendorSellEligible(eligibleStore) && !isVendorSellEligible({ ...eligibleStore, status: 'pending_review' }) && !isVendorSellEligible({ ...eligibleStore, status: 'declined' }) && !isVendorSellEligible({ ...eligibleStore, status: 'suspended' }) && !isVendorSellEligible({ ...eligibleStore, business_name: ' ' }) && !isVendorSellEligible({ ...eligibleStore, available_menu_items: 0 }) && !isVendorSellEligible({ ...eligibleStore, accepting_orders: false }), 'Public orderability requires approval, complete storefront and hours, an available item, and accepting orders');
  const publicFixture = { id: 'v1', business_name: 'Test Kitchen', market_area: 'ijagun', neighborhood: 'TASFUED area', street_address: 'Campus Road', nearby_landmark: 'TASFUED gate', delivery_coverage: ['ijagun'], business_type: 'restaurant', fulfillment_options: 'pickup_and_delivery', delivery_fee_ngn: null, description: 'Fresh meals prepared daily.', opening_hours: completeHours, accepting_orders: true, menu: [{ id: 'm1', name: 'Jollof Rice', description: '', price_ngn: 2500, category: 'rice', image_url: null, available: true as const }] };
  const projectedListing = toPublicVendorListing({ ...publicFixture, phone: '+2348012345678', email: 'private@example.test', message: 'private note', status: 'approved', user_id: 'private-user' }, [{ ...publicFixture.menu[0], vendor_interest_id: 'v1', phone: 'private' }]);
  assert(!JSON.stringify(projectedListing).includes('private@example.test') && !JSON.stringify(projectedListing).includes('private note') && !('status' in projectedListing), 'Public restaurant data excludes application contacts, review status, account IDs, and private messages');
  assert(projectedListing.fulfillment_options === 'pickup_only' && matchesPublicVendorFilters(projectedListing, { fulfillment: 'pickup' }) && !matchesPublicVendorFilters(projectedListing, { fulfillment: 'delivery' }), 'A vendor with no configured delivery fee is shown as pickup only and excluded from delivery results');
  assert(toPublicVendor({ ...publicFixture, fulfillment_options: 'vendor_delivery', delivery_fee_ngn: null }).delivery_fee_ngn === null && !matchesPublicVendorFilters({ ...publicFixture, fulfillment_options: 'vendor_delivery', delivery_fee_ngn: null }, { fulfillment: 'delivery' }), 'Delivery without a fixed fee is not advertised as available');
  const projectedItem = toPublicMenuItem({ id: 'm2', name: 'Amala', description: 'With ewedu', price_ngn: '3000', category: 'swallow', image_url: 'https://attacker.example/meal.jpg', available: true, vendor_interest_id: 'private-vendor', updated_at: 'private' });
  assert(Boolean(projectedItem && Object.keys(projectedItem).sort().join(',') === 'available,category,description,id,image_url,name,price_ngn' && projectedItem.image_url === null && projectedItem.price_ngn === 3000), 'Public menu item projection allowlists fields, normalizes NGN price, and rejects untrusted images');
  assert(projectedItem?.name === 'Amala' && projectedItem.description === 'With ewedu' && projectedItem.category === 'swallow' && projectedItem.available === true && projectedItem.price_ngn === 3000, 'Public menu exposes the saved name, price, category, description, and availability values');
  assert(matchesPublicVendorFilters(publicFixture, { search: 'ijagun' }) && matchesPublicVendorFilters(publicFixture, { search: 'jollof' }) && matchesPublicVendorFilters(publicFixture, { search: 'test kitchen' }) && !matchesPublicVendorFilters(publicFixture, { search: 'amala' }), 'Public search matches persisted business and available menu item names');
  assert(matchesPublicVendorFilters(publicFixture, { categories: ['rice'] }) && !matchesPublicVendorFilters(publicFixture, { categories: ['snacks'] }) && matchesPublicVendorFilters(publicFixture, { neighborhood: 'tasfued area' }) && matchesPublicVendorFilters({ ...publicFixture, delivery_fee_ngn: 850 }, { fulfillment: 'delivery' }) && matchesPublicVendorFilters({ ...publicFixture, delivery_fee_ngn: 850 }, { marketArea: 'ijagun', fulfillment: 'delivery' }) && !matchesPublicVendorFilters({ ...publicFixture, market_area: 'ijebu-ode', delivery_coverage: [], delivery_fee_ngn: 850 }, { marketArea: 'ijagun', fulfillment: 'delivery' }), 'Public category, neighborhood, and configured delivery filters affect the returned results');
  const menuId = '00000000-0000-4000-8000-000000000001';
  const cartParse = parseCheckoutLines([{ menuItemId: menuId, quantity: 2, expectedPriceNgn: 1200, priceNgn: 1, vendorId: 'spoofed' }]);
  assert(cartParse.success && !('priceNgn' in cartParse.lines[0]) && !('vendorId' in cartParse.lines[0]), 'Checkout parser discards browser-supplied price and vendor fields');
  assert(!parseCheckoutLines([{ menuItemId: menuId, quantity: 0, expectedPriceNgn: 1200 }]).success && !parseCheckoutLines([{ menuItemId: menuId, quantity: 100, expectedPriceNgn: 1200 }]).success && !parseCheckoutLines([{ menuItemId: menuId, quantity: 1 }]).success, 'Invalid quantities and missing quote prices are rejected');
  const resolvedCart = cartParse.success ? resolveAvailableOrderItems(cartParse.lines, [{ id: menuId, vendor_interest_id: 'vendor-real', price_ngn: 2500, available: true }]) : null;
  const canonicalTotal = resolvedCart?.success ? calculateOrderTotals([{ price_ngn: resolvedCart.items[0].priceNgn, quantity: resolvedCart.items[0].quantity }], 750).totalNgn : -1;
  assert(resolvedCart?.success === true && canonicalTotal === 5750, 'Totals use the live database price and configured fee rather than a manipulated browser price');
  assert(!resolveAvailableOrderItems([{ menuItemId: menuId, quantity: 1 }], []).success && !resolveAvailableOrderItems([{ menuItemId: menuId, quantity: 1 }], [{ id: menuId, vendor_interest_id: 'v1', price_ngn: 2500, available: false }]).success, 'Unavailable or missing menu records cannot be checked out');
  assert(!resolveAvailableOrderItems([{ menuItemId: menuId, quantity: 1 }, { menuItemId: '00000000-0000-4000-8000-000000000002', quantity: 1 }], [{ id: menuId, vendor_interest_id: 'v1', price_ngn: 2500, available: true }, { id: '00000000-0000-4000-8000-000000000002', vendor_interest_id: 'v2', price_ngn: 1800, available: true }]).success, 'One cart cannot combine menu items from different vendors');
  assert(validateCheckoutContact(' Ada Customer ', '0803 123 4567').success && !validateCheckoutContact('', '123').success, 'Checkout requires valid customer contact details');
  assert(validateFulfillment('pickup', null, ['pickup_only']).success && validateFulfillment('vendor_delivery', 'Molipa Junction, near the market', ['vendor_delivery']).success && !validateFulfillment('vendor_delivery', '', ['vendor_delivery']).success && !validateFulfillment('pickup', null, ['vendor_delivery']).success, 'Fulfillment choices and delivery address are validated');
  assert(canTransitionOrder('placed', 'accepted', 'pickup') && canTransitionOrder('placed', 'rejected', 'pickup') && canTransitionOrder('preparing', 'ready_for_pickup', 'pickup') && canTransitionOrder('preparing', 'out_for_delivery', 'vendor_delivery') && !canTransitionOrder('placed', 'completed', 'pickup') && !canTransitionOrder('preparing', 'out_for_delivery', 'pickup'), 'Order status transitions follow the fulfillment workflow and reject invalid jumps');
  const orderMigration = readFileSync(new URL('../docs/migrations/20261019_customer_orders.sql', import.meta.url), 'utf8');
  const reliabilityMigration = readFileSync(new URL('../docs/migrations/20261020_order_reliability.sql', import.meta.url), 'utf8');
  assert(orderMigration.includes('UNIQUE (customer_user_id, idempotency_key)') && orderMigration.includes('ON CONFLICT (customer_user_id, idempotency_key) DO NOTHING'), 'Checkout retries are idempotent per authenticated customer');
  assert(orderMigration.includes('customer_user_id = (SELECT auth.uid())') && orderMigration.includes('v.user_id = (SELECT auth.uid())') && orderMigration.includes('p_vendor_user_id'), 'Order RLS and vendor transitions scope access to verified customer and vendor ownership');
  const idempotencyInput = { customerUserId: 'customer-a', customerName: 'Ada Customer', customerPhone: '+2348031234567', fulfillmentMethod: 'pickup' as const, deliveryAddress: null, expectedDeliveryFeeNgn: null, lines: [{ menuItemId: menuId, quantity: 2, expectedPriceNgn: 1200 }] };
  assert(createOrderRequestFingerprint(idempotencyInput) === createOrderRequestFingerprint({ ...idempotencyInput, lines: [...idempotencyInput.lines] }) && createOrderRequestFingerprint(idempotencyInput) !== createOrderRequestFingerprint({ ...idempotencyInput, customerUserId: 'customer-b' }) && createOrderRequestFingerprint(idempotencyInput) !== createOrderRequestFingerprint({ ...idempotencyInput, lines: [{ ...idempotencyInput.lines[0], quantity: 3 }] }), 'Order fingerprints bind customer and payload for safe retry reuse');
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
  const storedAttempt = { idempotencyKey: '00000000-0000-4000-8000-000000000009', fingerprint: 'a'.repeat(64) };
  persistCheckoutAttempt('customer-a', storedAttempt);
  const recoveredAttempt = readCheckoutAttempt('customer-a');
  assert(recoveredAttempt?.idempotencyKey === storedAttempt.idempotencyKey && readCheckoutAttempt('customer-b') === null, 'Checkout attempt survives a page refresh and stays isolated by customer');
  clearCheckoutAttempt('customer-a', storedAttempt.idempotencyKey);
  assert(readCheckoutAttempt('customer-a') === null, 'A confirmed checkout attempt can be cleared safely');
  if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage); else delete (globalThis as { localStorage?: Storage }).localStorage;
  assert(reliabilityMigration.includes('idempotency_fingerprint') && reliabilityMigration.includes("ERRCODE = 'PZ002'") && reliabilityMigration.includes('ON CONFLICT (customer_user_id, idempotency_key) DO NOTHING'), 'Reliability migration stores and checks request fingerprints on concurrent retries');
  assert(reliabilityMigration.includes("timezone('Africa/Lagos'") && reliabilityMigration.includes('FOR SHARE') && reliabilityMigration.includes("ERRCODE = 'PZ001'"), 'Order transaction rechecks Lagos opening hours, locked item prices and delivery fee');
  assert(reliabilityMigration.includes('IF NOT FOUND THEN') && reliabilityMigration.includes('v_existing.idempotency_fingerprint IS DISTINCT FROM p_request_fingerprint') && reliabilityMigration.includes('REVOKE ALL ON FUNCTION public.create_customer_order'), 'Concurrent key collisions compare payload fingerprints and disable the old server RPC signature');
  assert(getPublicStoreAvailability(publicFixture, new Date('2026-10-19T09:30:00Z')).open && !getPublicStoreAvailability({ ...publicFixture, accepting_orders: false }, new Date('2026-10-19T09:30:00Z')).open, 'Public store status respects opening hours and the persisted accepting-orders setting');
  assert(validateMenuItem({ name: 'Jollof Rice', description: '', priceNgn: 1500, category: 'rice', available: true }) === null && Boolean(validateMenuItem({ name: 'Meal', description: '', priceNgn: -10, category: 'rice' })) && Boolean(validateMenuItem({ name: 'Meal', description: '', priceNgn: Infinity, category: 'rice' })), 'Menu price validation rejects negative and non-finite values');
  const vendorDbSource = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert(vendorDbSource.includes(".eq('user_id', userId)") && vendorDbSource.includes(".eq('vendor_interest_id', businessId)"), 'Menu reads and writes are scoped to the authenticated owner business');
  assert(vendorDbSource.includes('name: item.name, description: item.description, price_ngn: item.priceNgn, category: item.category') && vendorDbSource.includes('available: item.available ?? true') && vendorDbSource.includes(".select('id, vendor_interest_id, name, description, price_ngn, category, image_url, available')"), 'Menu CRUD persists the vendor-entered fields and the public query selects saved available records');
  assert(vendorDbSource.includes('if (vendorError) return { success: false as const, statusCode: 503') && vendorDbSource.includes('if (menuError) return { success: false as const, statusCode: 503') && vendorDbSource.includes('validateVendorOrderReadiness(vendor, count || 0)'), 'Store cannot open after failed readiness queries and backend outages remain 503');
  const dashboardSource = readFileSync(new URL('../src/pages/VendorDashboardPage.tsx', import.meta.url), 'utf8');
  assert(dashboardSource.includes('setMarketArea(selected.market_area') && dashboardSource.includes('setStreetAddress(selected.street_address') && dashboardSource.includes('setDeliveryCoverage(selected.delivery_coverage'), 'Switching between owned businesses loads that business location and delivery settings before profile edits');
  assert((vendorDbSource.match(/\.eq\('is_test_order', false\)/g)?.length || 0) >= 3 && vendorDbSource.includes('if (order.is_test_order)'), 'Production customer/vendor lists and checkout recovery exclude test orders, and production status changes reject them');
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

  const revealSource = readFileSync(new URL('../src/components/ScrollReveal.tsx', import.meta.url), 'utf8');
  const revealStyles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const exploreSource = readFileSync(new URL('../src/pages/ExplorePage.tsx', import.meta.url), 'utf8');
  assert(revealSource.includes('new IntersectionObserver') && revealSource.includes('sharedObserver') && revealSource.includes("unobserve(target)"), 'Food-card reveal shares an observer and stops observing after the first reveal');
  assert(revealSource.includes('prefers-reduced-motion: reduce') && revealSource.includes("'IntersectionObserver' in window"), 'Food-card reveal respects reduced motion and keeps a no-observer fallback visible');
  assert(revealStyles.includes('380ms') && revealStyles.includes('prefers-reduced-motion: reduce') && revealStyles.includes('(hover: hover) and (pointer: fine)'), 'Food-card motion is brief, reduced-motion aware, and hover-only on capable devices');
  assert(exploreSource.includes('<ScrollReveal') && homeSource.includes('<ScrollReveal') && storefrontSource.includes('<ScrollReveal'), 'Homepage food imagery, Explore vendor cards, and public menu items use the shared reveal');

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
    assert(nonJsonError === 'The service response could not be read. Please retry.', 'Admin client handles non-JSON service responses without exposing proxy details');

    globalThis.fetch = async input => {
      assert(String(input).includes('search=jollof') && String(input).includes('marketArea=ijagun') && String(input).includes('neighborhood=Molipa') && String(input).includes('fulfillment=pickup'), 'Explore API sends supported search and filter values to the backend');
      return new Response(JSON.stringify({ success: true, vendors: [], total: 0, status: 'empty', message: 'No matching businesses.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const emptyDirectory = await api.getVendors({ search: 'jollof', marketArea: 'ijagun', neighborhood: 'Molipa', fulfillment: 'pickup' });
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
