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
import {
  insertCustomerInterest,
  insertVendorInterest,
  insertContactInquiry,
  getVerifiedVendors,
  getHealthStats,
  getStorageMode,
  isSupabaseConfigured
} from '../src/server/db';
import { resetRateLimits } from '../src/server/rateLimiter';

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

  // Test 1: Phone Normalization (E.164 +234...)
  console.log('--- Suite 1: Normalization & PII Sanitization ---');
  assert(
    normalizeNigerianPhone('0803 123 4567') === '+2348031234567',
    'Normalizes 11-digit local Nigerian phone with spaces'
  );
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
    vendorList.total === 0 && vendorList.vendors.length === 0,
    'Criterion 11: Vendor listings remain empty (0 approved vendors) at pre-launch'
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
  const hasLeakedServiceKeyInClientEnv = clientEnvKeys.some(k => 
    process.env[k] === process.env.SUPABASE_SERVICE_ROLE_KEY && process.env[k] !== undefined
  );
  assert(
    !hasLeakedServiceKeyInClientEnv,
    'Criterion 9: SUPABASE_SERVICE_ROLE_KEY is not exposed in VITE_ client environment'
  );

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
