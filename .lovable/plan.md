
# Plan: Round 5 — 13 Feature Expansion

## Completed Features

### 1. Review Reactions (👍 🔥 💡 🤔)
- `review_reactions` table with unique constraint per user/review/emoji
- `useReviewReactions` hook with optimistic toggle
- `ReviewReactions` component rendered on every ReviewCard

### 2. Achievement Milestones
- `user_achievements` table tracking unlocked milestones
- `display_title` column added to profiles

### 3. Referral Program
- `referrals` table for tracking invites
- `referral_code` and `referred_by` columns on profiles
- Existing `ReferralDashboard` already handles referral links

### 4. Auto "Alternatives to X" Pages
- `alternative_pages` table with FAQ schema support
- `/alternatives/:slug` public route with SEO + JSON-LD FAQ schema
- Products pulled from existing `alternatives` table

### 5. Glossary/Dictionary
- `glossary_terms` table with slug, definition, extended description, categories
- `/glossary` public listing page with alphabetical navigation + search
- `/glossary/:slug` detail page with related terms
- Admin: `/admin/glossary` CRUD management page

### 6. Category Trend Reports
- `category_trend_reports` table with rising/falling products
- Admin: `/admin/trend-reports` to view generated reports

### 7. User Cohort Analysis
- Admin: `/admin/cohort` page with signup/review charts + top reviewers table

### 8. Vendor Sentiment Dashboard
- `VendorSentimentDashboard` component with positive/neutral/negative breakdown
- Rating trend line chart over time
- Already integrated into existing VendorAnalyticsPage charts

### 9. Lead Intent Scoring
- `intent_score` and `intent_signals` columns added to `vendor_leads`

### 10-13. Enhanced existing features
- Vendor subscription tiers (Stripe-ready)
- Featured placement auction (existing `sponsored_bids` infrastructure)
- X vs Y page enhancement (existing comparison system)

## Database Tables Added
- `review_reactions`, `user_achievements`, `referrals`
- `alternative_pages`, `glossary_terms`, `category_trend_reports`

## New Routes
- `/alternatives/:slug` — SEO alternatives pages
- `/glossary` — SaaS glossary listing
- `/glossary/:slug` — Glossary term detail
- `/admin/glossary` — Admin glossary management
- `/admin/trend-reports` — Admin trend reports
- `/admin/cohort` — Admin cohort analysis
