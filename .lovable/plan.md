
# AI Review Digest

## Overview
Expand the existing AI review summary into a rich, persistent "Review Digest" for each product. This gives visitors an at-a-glance understanding of what reviewers think, with sentiment breakdown, top themes, rating trends, and an overall verdict — all AI-generated and cached in the database.

## What users will see

On the product detail page (Overview tab), a new **"AI Review Digest"** card replaces/enhances the current simple pros/cons summary. It includes:

- Overall verdict (1-2 sentences)
- Pros summary and Cons summary (as today, but richer)
- Top 5 themes/keywords extracted from reviews (e.g., "Easy setup", "Pricey", "Great support")
- Sentiment breakdown bar (% positive / neutral / negative)
- Average sub-ratings summary (ease of use, support, value, features)
- "Last updated" timestamp
- Admin button to regenerate the digest

## Technical Details

### 1. Database: New `review_digests` table

```text
review_digests
--------------
id              uuid PK
product_id      uuid UNIQUE (one digest per product)
overall_verdict text
pros_summary    text
cons_summary    text
top_themes      jsonb        -- ["Easy setup", "Great support", ...]
sentiment_pct   jsonb        -- { positive: 72, neutral: 18, negative: 10 }
avg_sub_ratings jsonb        -- { ease_of_use: 4.2, support: 3.8, ... }
review_count    integer      -- how many reviews were analyzed
created_at      timestamptz
updated_at      timestamptz
```

RLS: publicly readable (SELECT for all), admin-only for INSERT/UPDATE/DELETE.

### 2. Edge Function: Upgrade `generate-review-summary`

Modify the existing edge function to:
- Generate the expanded digest fields (verdict, themes, sentiment percentages, sub-rating averages)
- Use tool calling for structured output instead of raw JSON parsing
- Upsert into `review_digests` table instead of updating products.pros_summary/cons_summary
- Still update products.pros_summary and cons_summary for backward compatibility
- Handle 429/402 errors (already done)

### 3. Frontend: `ReviewDigestCard` component

A new component rendered on the product Overview tab that:
- Fetches from `review_digests` where `product_id` matches
- Shows the overall verdict, pros/cons summaries, theme badges, and a horizontal sentiment bar
- Shows sub-rating averages as small progress bars
- Displays "Based on N reviews, last updated X ago"
- Admin-only "Regenerate" button triggers the edge function

### 4. Files changed

| File | Change |
|------|--------|
| Migration SQL | Create `review_digests` table with RLS |
| `supabase/functions/generate-review-summary/index.ts` | Expand AI prompt, use tool calling, upsert into new table |
| `src/components/ReviewDigestCard.tsx` | New component for the digest UI |
| `src/pages/ProductDetailPage.tsx` | Replace old pros/cons section with `ReviewDigestCard` |

### 5. Sequence

1. Run migration to create `review_digests` table
2. Update edge function with expanded prompt and upsert logic
3. Create `ReviewDigestCard` component
4. Integrate into `ProductDetailPage`
