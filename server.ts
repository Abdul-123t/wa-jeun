import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
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
import {
  insertCustomerInterest,
  insertVendorInterest,
  insertContactInquiry,
  getVerifiedVendors,
  getHealthStats,
  getStorageMode
} from './src/server/db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

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

// Abuse Prevention: Rate limiter for public submission endpoints
// 15 submissions per 10 minutes per IP
const submissionLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: 'Too many submissions from this connection. Please wait a few minutes before trying again.'
});

// 1. Health check & configuration status
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const stats = await getHealthStats();
    res.json({
      status: stats.status,
      market: 'Ijebu Ode, Ogun State, Nigeria',
      stage: 'pre-launch-mvp',
      storageMode: stats.storageMode,
      counts: {
        registeredCustomers: stats.registeredCustomers,
        registeredVendors: stats.registeredVendors
      },
      message: 'wá jẹun backend is operating and storing interest registrations truthfully.'
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

// 2. Truthful vendor discovery endpoint - strictly verified/approved vendors only
// (0 verified vendors at pre-launch; no fictional businesses)
app.get('/api/vendors', async (req: Request, res: Response) => {
  const { category, search } = req.query;

  try {
    const filterCat = category && typeof category === 'string' ? sanitizeText(category, 50) : undefined;
    const filterSearch = search && typeof search === 'string' ? sanitizeText(search, 100) : undefined;

    const result = await getVerifiedVendors({
      category: filterCat,
      search: filterSearch
    });

    res.json({
      vendors: result.vendors,
      total: result.total,
      filtersApplied: {
        category: filterCat || null,
        search: filterSearch || null
      },
      status: 'pre_launch',
      message: result.total === 0
        ? "We're preparing wá jẹun's first food marketplace in Ijebu Ode. Verified food business listings will appear as local businesses are officially onboarded."
        : 'Displaying verified food businesses in Ijebu Ode.'
    });
  } catch (err) {
    res.status(500).json({
      vendors: [],
      total: 0,
      status: 'error',
      message: 'Unable to retrieve vendor listings.'
    });
  }
});

// 3. Customer Early Access Registration Endpoint
app.post('/api/interest/customer', submissionLimiter, async (req: Request, res: Response) => {
  try {
    const {
      name,
      contactMethod,
      phone,
      email,
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
      message: 'Thank you for registering your interest! We will contact you when food discovery and ordering go live in Ijebu Ode.',
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
app.post('/api/interest/vendor', submissionLimiter, async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      contactName,
      phone,
      email,
      neighborhood,
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

    const cleanNeighborhood = sanitizeText(neighborhood, 150);
    if (!cleanNeighborhood || cleanNeighborhood.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your business location or neighborhood in Ijebu Ode.'
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

    // Persistent Database Insertion
    const dbResult = await insertVendorInterest({
      business_name: cleanBizName,
      contact_name: cleanContact,
      phone: normalizedPhone,
      email: normalizedEmail,
      neighborhood: cleanNeighborhood,
      business_type: businessType,
      current_ordering_methods: methods,
      fulfillment_options: fulfillmentOptions,
      message: cleanMessage || null,
      consent_accepted: true
    });

    if (!dbResult.success) {
      return res.status(dbResult.statusCode || 500).json({
        success: false,
        error: dbResult.error || 'Failed to record food business interest.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Your food business interest has been recorded! Our onboarding team will contact you directly to discuss the next steps for joining the first cohort in Ijebu Ode.',
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
app.post('/api/contact', submissionLimiter, async (req: Request, res: Response) => {
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
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WA JEUN server running on http://0.0.0.0:${PORT} [Mode: ${getStorageMode()}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
