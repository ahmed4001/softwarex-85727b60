

# Vendor Marketplace

## Overview
Extend the existing Vendor Portal with subscription plans, lead capture forms, a CRM-lite dashboard for managing leads, sponsored placement management, and ROI reporting -- all integrated with the current claim-based vendor system.

## Database Changes (Migration)

### Table: `vendor_subscriptions`
Tracks which plan each vendor is on.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL | vendor |
| plan | text NOT NULL | 'free', 'starter', 'pro', 'enterprise' |
| status | text NOT NULL | 'active', 'canceled', 'expired' (default 'active') |
| started_at | timestamptz | default now() |
| expires_at | timestamptz | nullable |
| metadata | jsonb | default '{}' -- store Stripe sub ID etc. |
| created_at | timestamptz | default now() |

RLS: Owner SELECT/UPDATE; Admin ALL.

### Table: `vendor_leads`
Captures inbound interest from product pages.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| product_id | uuid NOT NULL | |
| vendor_user_id | uuid NOT NULL | owner of the product |
| name | text NOT NULL | lead's name |
| email | text NOT NULL | lead's email |
| company | text | nullable |
| message | text | nullable |
| source | text | default 'product_page' |
| status | text | default 'new' -- new/contacted/qualified/closed |
| notes | text | vendor private notes |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Vendor owner SELECT/UPDATE (where vendor_user_id = auth.uid()); public INSERT with check (email is not null); Admin ALL.

### Table: `vendor_sponsored_requests`
Vendors can request/manage their own sponsored placements (admin-approved).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL | vendor |
| product_id | uuid NOT NULL | |
| tier | text NOT NULL | 'bronze', 'silver', 'gold' |
| start_date | date | |
| end_date | date | |
| status | text | default 'pending' -- pending/active/expired/rejected |
| budget | numeric | nullable |
| created_at | timestamptz | default now() |

RLS: Owner SELECT/INSERT; Admin ALL.

## New Pages

### 1. Vendor Subscription Plans Page (`/vendor/plans`)
- Displays 4 tiers: Free, Starter ($49/mo), Pro ($149/mo), Enterprise ($499/mo)
- Feature comparison matrix (lead capture, sponsored slots, analytics depth, response templates, priority support)
- Current plan badge highlighting
- CTA buttons (upgrade flow -- initially just records intent; Stripe integration can be layered later)

### 2. Vendor Leads / CRM Page (`/vendor/leads`)
- Table of captured leads with columns: Name, Email, Company, Product, Status, Date
- Status pipeline dropdown (New -> Contacted -> Qualified -> Closed)
- Inline notes editing
- Search and filter by product/status
- Lead count stat cards at top
- CSV export button

### 3. Vendor Sponsored Placements Page (`/vendor/sponsored`)
- List of vendor's current/past sponsorship requests with status badges
- "Request Sponsorship" form: select product, pick tier, date range, budget
- Shows existing product sponsor status from products table

### 4. Vendor ROI Report Page (`/vendor/roi`)
- Aggregated metrics: views, clicks, CTR, leads captured, reviews received, response rate
- Time period selector (7d, 30d, 90d, all)
- Per-product ROI breakdown table
- Charts: views/clicks over time (area chart), lead funnel (bar chart), review sentiment trend
- Estimated lead value calculator (configurable $/lead)

## Component: Lead Capture Form (on Product Detail Page)
- Small card in the product sidebar: "Get a Quote" / "Contact Vendor"
- Fields: Name, Email, Company (optional), Message (optional)
- Only shown for claimed products
- Submits to `vendor_leads` table
- Success toast confirmation

## Route & Navigation Updates

### New routes under `/vendor`:
```
/vendor/plans       -> VendorPlansPage
/vendor/leads       -> VendorLeadsPage
/vendor/sponsored   -> VendorSponsoredPage
/vendor/roi         -> VendorROIPage
```

### VendorLayout nav additions:
Add 4 new nav items: Plans (CreditCard icon), Leads (UserPlus icon), Sponsored (Megaphone icon), ROI (PieChart icon).

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | New (3 tables, RLS, trigger) |
| `src/pages/vendor/VendorPlansPage.tsx` | New |
| `src/pages/vendor/VendorLeadsPage.tsx` | New |
| `src/pages/vendor/VendorSponsoredPage.tsx` | New |
| `src/pages/vendor/VendorROIPage.tsx` | New |
| `src/components/LeadCaptureForm.tsx` | New |
| `src/components/VendorLayout.tsx` | Modified (add 4 nav items) |
| `src/App.tsx` | Modified (add 4 routes) |
| `src/pages/ProductDetailPage.tsx` | Modified (add LeadCaptureForm in sidebar) |

## Technical Notes
- Lead capture form uses public INSERT policy so unauthenticated visitors can submit leads
- `vendor_user_id` in `vendor_leads` is populated by looking up the product's approved claim owner at insert time via the form logic
- ROI page reuses existing `view_count`/`click_count` from products table and counts from `vendor_leads` and `reviews`
- Subscription plans are stored locally for now; Stripe checkout can be wired in later via the existing Stripe integration tooling
- All new tables get an `update_updated_at_column` trigger where applicable
- Charts use Recharts (already installed)

