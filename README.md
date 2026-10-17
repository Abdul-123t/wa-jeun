# WA JEUN — Your City. Your Food.
*Premium, Mobile-First Nigerian Food Marketplace*
**Initial Launch Market:** Ijebu Ode, Ogun State, Nigeria

---

## 1. Project Overview & Product Stage

WA JEUN is an authentic food discovery marketplace designed to connect food lovers with local restaurants, bukas, and caterers, starting in Ijebu Ode, Ogun State, Nigeria.

### Core Operating Principle: Strict Truthfulness
WA JEUN adheres to an uncompromising transparency policy:
- **No manufactured traction:** We do not publish fake restaurant listings, dummy order volumes, fabricated ratings, fake reviews, or invented customer testimonials.
- **Genuine Pre-Launch Stage:** The platform is currently gathering real customer early-access signups and onboarding applications from local food businesses.
- **No Fictional Delivery Fleet:** WA JEUN does not employ delivery riders or operate motorbikes at launch. All fulfillment is organized via customer pickup or delivery managed directly by participating food vendors.

---

## 2. Routes & Pages

| Route | Page | Purpose |
| :--- | :--- | :--- |
| `/` | **Homepage** | Hero with Nigerian jollof culinary photography, location marker, category grid, 4-step workflow, food business recruitment section, and FAQs. |
| `/explore` | **Explore Food** | Interactive search, food category tabs, neighborhood and fulfillment filters, and truthful empty state (0 verified vendors at launch). |
| `/customer-register` | **Customer Early Access** | Validated form for customers to join the launch list with contact preference (WhatsApp/phone or email), area selection in Ijebu Ode, and favorite foods. |
| `/vendor-register` | **Food Business Onboarding** | Comprehensive low-friction vendor interest form for bukas, restaurants, fast food, and grills. |
| `/about` | **About WA JEUN** | Brand purpose, mission in Ijebu Ode, intended benefits, and operational transparency statement. |
| `/legal` | **Legal & Contact** | Tabbed interface containing Privacy Policy, Pre-Launch Terms of Use, and a functional Contact inquiry form. |

---

## 3. Brand Identity & Design System

- **Forest Green:** `#123B2A` (Primary brand color for key headings, primary surfaces, and emphasis)
- **Lime:** `#B8D94B` (High-intent accent color for CTAs, active highlights, and indicators)
- **Warm Cream:** `#FFF8E9` (Welcoming, food-centered canvas background)
- **Charcoal:** `#20231F` (High-contrast, accessible typography)
- **White:** `#FFFFFF` (Clean card surfaces and input fields)

Typography: **Plus Jakarta Sans** and **Outfit** paired with tabular figures (`tabular-nums`) for clean visual hierarchy.

---

## 4. Technical Architecture & Persistence

### Full-Stack Architecture
- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide icons, React Router.
- **Backend:** Express server (`server.ts`) running Vite middleware in development.
- **Storage Dual-Mode:**
  1. **Local Persistent Storage (Pre-configured):** Atomic file transactions stored in `data/interest_records.json`. All customer, vendor, and contact submissions persist across page reloads and server restarts.
  2. **Supabase / PostgreSQL (Production Ready):** Ready for cloud migration via `docs/database_schema.sql` with full Row-Level Security (RLS) policies preventing public exposure of private contact details.

### API Endpoints
- `GET /api/health` — Returns system status, storage mode, and registration counts.
- `GET /api/vendors` — Queries verified vendors (truthfully returns `[]` empty array at pre-launch).
- `POST /api/interest/customer` — Validates and stores customer early access registration.
- `POST /api/interest/vendor` — Validates and stores food business onboarding application.
- `POST /api/contact` — Submits general inquiry to the team.

---

## 5. Development & Testing Guide

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
Dev server starts on `http://localhost:3000`.

### Type Check & Build
```bash
npm run lint
npm run build
```

### Testing the MVP Checklist:
1. **Homepage:** Browse the hero section, click categories to jump to Explore Food, toggle FAQs.
2. **Customer Registration:** Fill out the early access form (`/customer-register`), test WhatsApp vs. Email validation, select Ijebu Ode neighborhood, and submit. Notice the genuine reference ID and instant persistence.
3. **Vendor Registration:** Submit an expression of interest for a food business (`/vendor-register`).
4. **Explore Food:** Search for dishes, apply neighborhood and fulfillment filters, observe the truthful empty state explaining that onboarding is currently underway.
5. **Contact Form:** Send a message via `/legal?tab=contact` and verify submission.

---

## 6. Features Intentionally Reserved for Post-Onboarding

The following capabilities are intentionally NOT simulated with fake data:
- Fake restaurant menus or fabricated dish prices.
- Dummy shopping cart or simulated checkout.
- Mock payment confirmations or fake dispatch tracking.
- Fabricated reviews, ratings, or sales metrics.

These features will be deployed as verified food businesses in Ijebu Ode complete onboarding.
