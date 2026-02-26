

# Plan: Build All 8 Feature Tracks

This is a large implementation spanning database tables, backend functions, and frontend components. I'll build them in a logical order where dependencies flow naturally.

---

## Feature 1: Product Comparison Tables

Enhance the existing `/compare` page with a structured side-by-side feature/pricing matrix.

**Database**: No new tables needed -- uses existing `products` (features, pricing_tiers) and `comparisons` data.

**Frontend changes**:
- Enhance `ComparePage.tsx` to add a structured **Feature Matrix** tab showing features side-by-side for selected products
- Add a **Pricing Matrix** section pulling from `product_pricing_tiers`
- Add shareable URL support (already partially exists via `?products=` query param)
- Create a `ComparisonMatrix` component with toggleable feature rows and check/cross indicators

---

## Feature 2: Review Verification Badges

Add trust indicators to reviews and reviewer profiles.

**Database**:
- Add `linkedin_verified` boolean column to `profiles` table
- Add `verification_method` text column to `reviews` table (values: `purchase`, `linkedin`, `manual`)

**Frontend changes**:
- Update `ReviewCard.tsx` to display verification badges (Verified Purchase, LinkedIn Verified) with distinct icons and tooltips
- Update `UserProfilePage.tsx` to show verification status
- Add a "Verify via LinkedIn" placeholder button on the dashboard profile tab

---

## Feature 3: Vendor Response System

Let claimed vendors publicly reply to reviews.

**Database**:
- Create `vendor_responses` table: `id`, `review_id` (unique), `vendor_user_id`, `body`, `created_at`, `updated_at`
- RLS: vendors can insert/update own responses; publicly readable
- Add a trigger or function to notify the reviewer when a vendor responds

**Frontend changes**:
- Update `ReviewCard.tsx` to display vendor responses below each review with a "Vendor Reply" badge
- Update `VendorReviewsPage.tsx` to add inline response form with template picker from existing templates
- Wire up existing `VendorResponseTemplatesPage.tsx` template system

---

## Feature 4: Weekly Email Digest

Automated newsletter with trending products, new reviews, and top comparisons.

**Database**:
- Create `digest_logs` table: `id`, `sent_at`, `recipient_count`, `status`

**Backend**:
- Create `weekly-digest` edge function that:
  - Queries users with `notification_preferences.weekly_digest = true`
  - Gathers trending products (by view_count last 7 days), new reviews, top comparisons
  - Sends via existing Brevo integration using `get_best_brevo_account()`
  - Logs to `digest_logs`

**Frontend changes**:
- Already have the `weekly_digest` toggle in `NotificationPreferences` -- no UI changes needed
- Add a "Send Test Digest" button in admin dashboard

---

## Feature 5: Product Watchlists and Alerts

Users follow products/categories and get notified on changes.

**Database**:
- Create `product_watches` table: `id`, `user_id`, `product_id`, `category_id` (nullable), `watch_type` (product/category), `created_at`
- RLS: users can CRUD own watches; no public read

**Frontend changes**:
- Add a "Watch" bell icon button on `ProductDetailPage.tsx` and `CategoryPage.tsx`
- Create `useProductWatch` hook for toggle logic
- Add a "Watchlist" tab on the dashboard showing watched products with latest activity
- When new reviews are posted, insert a notification for watchers (via DB trigger)

---

## Feature 6: Rating Trend Timeline

Interactive chart showing rating trends over time per product.

**Database**: No new tables -- queries `reviews` table grouped by month.

**Frontend changes**:
- Create `RatingTrendChart` component using Recharts (already installed)
- Show on `ProductDetailPage.tsx` in the reviews section -- a line chart of average monthly rating over time
- Include data points for review count per month as a bar overlay

---

## Feature 7: AI Product Q&A Chatbot

AI chatbot on product pages that answers questions from review data.

**Backend**:
- Create `product-qa-chat` edge function that:
  - Accepts `product_id` and `question`
  - Fetches all approved reviews for the product
  - Uses Lovable AI (gemini-2.5-flash) to answer the question based on review content
  - Returns the AI-generated answer

**Frontend changes**:
- Create `ProductAIChatbot` component: a floating chat bubble on product pages
- Expandable panel with message history (local state, not persisted)
- Input field to ask questions; responses rendered with `react-markdown`
- Place on `ProductDetailPage.tsx`

---

## Feature 8: Annual Awards / Voting

Community-driven "Best of 2026" awards with nominations and voting.

**Database**:
- Create `award_categories` table: `id`, `name`, `slug`, `description`, `year`, `is_active`, `created_at`
- Create `award_nominations` table: `id`, `award_category_id`, `product_id`, `nominated_by`, `created_at`
- Create `award_votes` table: `id`, `award_category_id`, `product_id`, `user_id`, `created_at` (unique on category+user)
- RLS: public read on all; authenticated insert on nominations/votes; admin manage on categories

**Frontend changes**:
- Create `AwardsPage.tsx` at `/awards` showing active award categories with nominated products and vote counts
- Each category card shows top 5 products by vote count with a "Vote" button
- Add nomination form for authenticated users
- Add link in public header navigation
- Admin: simple page to create/manage award categories

---

## Technical Details

### Migration SQL (single migration covering all features):
1. `profiles` -- add `linkedin_verified` boolean
2. `reviews` -- add `verification_method` text
3. `vendor_responses` table with RLS
4. `digest_logs` table with RLS
5. `product_watches` table with RLS + notification trigger
6. `award_categories`, `award_nominations`, `award_votes` tables with RLS

### New Edge Functions:
1. `weekly-digest` -- scheduled email digest via Brevo
2. `product-qa-chat` -- AI chatbot answering from reviews

### New Components (approx 10):
- `ComparisonMatrix.tsx`
- `RatingTrendChart.tsx`
- `ProductAIChatbot.tsx`
- `ProductWatchButton.tsx`
- `VendorResponseDisplay.tsx`
- `AwardsPage.tsx`

### Modified Files:
- `ReviewCard.tsx` -- vendor responses + verification badges
- `ProductDetailPage.tsx` -- watch button, rating trend, AI chatbot
- `ComparePage.tsx` -- feature/pricing matrix
- `VendorReviewsPage.tsx` -- response form
- `DashboardPage.tsx` -- watchlist tab
- `App.tsx` -- `/awards` route
- `PublicHeader.tsx` -- awards nav link

### Implementation Order:
1. Database migration (all tables at once)
2. Review verification badges (small, self-contained)
3. Vendor response system (builds on ReviewCard)
4. Product comparison tables (enhances existing page)
5. Product watchlists and alerts
6. Rating trend timeline
7. AI product Q&A chatbot
8. Annual awards / voting
9. Weekly email digest (last, as it ties everything together)

