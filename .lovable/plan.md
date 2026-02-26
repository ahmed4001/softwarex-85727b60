

# Plan: Build 5 New Feature Tracks

## 1. Integration Marketplace

**Database**:
- Create `product_integrations` table: `id`, `product_id`, `integrates_with_product_id`, `description`, `category` (e.g. "CRM", "API"), `created_at`
- RLS: public read, admin manage

**Frontend**:
- Create `IntegrationGraph` component on `ProductDetailPage.tsx` showing connected products as a visual network (simple grid/list with links, not a full force-directed graph -- keep it practical)
- Add "Integrations" tab to product detail page listing all integrated products with logos
- Add filter on `SearchPage.tsx`: "Integrates with..." dropdown

---

## 2. Review Incentive Program (Points System)

**Database**:
- Create `point_transactions` table: `id`, `user_id`, `points`, `reason` (e.g. "review_posted", "comment_added", "vote_cast", "daily_streak"), `entity_id` (nullable), `created_at`
- Add `total_points` integer column to `profiles` table (denormalized for fast reads)
- Create a DB function `award_points(user_id, points, reason, entity_id)` that inserts a transaction and increments `profiles.total_points`
- Create triggers on `reviews`, `review_comments`, `review_qa` tables to auto-award points on insert

**Frontend**:
- Create `PointsDisplay` component showing user's total points in the dashboard header
- Add "Points History" section in Dashboard showing recent transactions
- Show points balance on `LeaderboardPage.tsx` alongside badge count
- Add point values: review = 50pts, comment = 10pts, vote = 5pts, daily streak = 25pts

---

## 3. Vendor Bidding / Sponsored Slots

**Database**:
- Create `sponsored_bids` table: `id`, `vendor_user_id`, `product_id`, `category_id`, `bid_amount` (numeric), `daily_budget` (numeric), `status` (pending/active/paused/expired), `start_date`, `end_date`, `impressions`, `clicks`, `created_at`, `updated_at`
- RLS: vendors can CRUD own bids, admins can manage all, public read for active bids

**Frontend**:
- Enhance `VendorSponsoredPage.tsx` with a new "Bidding" tab showing a bid form (select product, category, bid amount, daily budget, date range)
- Show bid status, impressions, clicks, and spend in a table
- Admin: add bid management view in `AdminAdsPage.tsx` to approve/reject bids
- On category pages, show top-bid products with a subtle "Sponsored" badge

---

## 4. Community Discussion Forums

**Database**:
- Create `discussions` table: `id`, `title`, `body`, `user_id`, `product_id` (nullable), `category_id` (nullable), `is_pinned`, `is_locked`, `upvote_count`, `reply_count`, `created_at`, `updated_at`
- Create `discussion_replies` table: `id`, `discussion_id`, `user_id`, `body`, `is_vendor_answer`, `upvote_count`, `parent_id` (nullable for nested replies), `created_at`, `updated_at`
- Create `discussion_votes` table: `id`, `user_id`, `discussion_id` (nullable), `reply_id` (nullable), `created_at` -- unique per user per target
- RLS: public read, authenticated insert/update own, admin manage + pin/lock

**Frontend**:
- Create `/discussions` page listing threads with filters (product, category, popular, recent)
- Create `/discussions/:id` detail page with replies, voting, and vendor-flagged answers
- Add "New Discussion" form for authenticated users
- Add "Discussions" tab on `ProductDetailPage.tsx` showing threads linked to that product
- Add nav link in `PublicHeader.tsx` under Resources

---

## 5. SEO & Growth (Programmatic Landing Pages)

**Database**:
- Create `seo_landing_pages` table: `id`, `title`, `slug`, `meta_description`, `body` (HTML/markdown), `category_id` (nullable), `audience` (text, e.g. "startups", "enterprise"), `product_ids` (jsonb), `is_published`, `view_count`, `created_at`, `updated_at`
- RLS: public read published, admin manage

**Backend**:
- Create `generate-landing-pages` edge function that uses Lovable AI (gemini-3-flash-preview) to bulk-generate pages from category + audience combos (e.g. "Best CRM for Startups 2026")
- Pulls top products per category, generates SEO-optimized content

**Frontend**:
- Create `/best/:slug` route rendering landing pages with product cards, comparison tables, and CTAs
- Admin: create `AdminLandingPagesPage.tsx` with a "Generate" button that triggers bulk generation, plus a table to manage existing pages
- Add admin sidebar link for "Landing Pages"

---

## Technical Details

### Single Migration (all 5 features):
1. `product_integrations` table + RLS
2. `point_transactions` table + RLS + `award_points()` function + triggers
3. `profiles` -- add `total_points` column
4. `sponsored_bids` table + RLS
5. `discussions`, `discussion_replies`, `discussion_votes` tables + RLS
6. `seo_landing_pages` table + RLS

### New Edge Function:
- `generate-landing-pages` -- AI-powered SEO page generation via Lovable AI

### New Pages/Components (~12):
- `IntegrationGraph.tsx` -- product integration display
- `PointsDisplay.tsx` -- points badge/counter
- `PointsHistory.tsx` -- transaction list
- `DiscussionsPage.tsx` -- forum listing
- `DiscussionDetailPage.tsx` -- thread view
- `DiscussionForm.tsx` -- new thread form
- `LandingPageView.tsx` -- public SEO page renderer
- `AdminLandingPagesPage.tsx` -- admin management
- Enhanced `VendorSponsoredPage.tsx` -- bidding UI

### Modified Files:
- `ProductDetailPage.tsx` -- integrations tab, discussions tab
- `PublicHeader.tsx` -- discussions nav link
- `LeaderboardPage.tsx` -- points column
- `DashboardPage.tsx` -- points history tab
- `VendorSponsoredPage.tsx` -- bidding form
- `AdminAdsPage.tsx` -- bid management
- `AdminSidebar.tsx` -- landing pages link
- `App.tsx` -- new routes

### Implementation Order:
1. Database migration (all tables)
2. Review Incentive Program (points system + triggers)
3. Integration Marketplace (product connections)
4. Community Discussion Forums (largest feature)
5. Vendor Bidding / Sponsored Slots
6. SEO Landing Pages (edge function + admin + public pages)

