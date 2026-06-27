# Auto-regenerate & resubmit blog/guides/glossary sitemaps

## Goal
Whenever a blog post, buyer guide, or glossary term is created/updated/published, the corresponding sitemap is regenerated and resubmitted to Google Search Console — no redeploy required.

## Approach
Move the three sitemaps from static `public/sitemap-*.xml` files to **dynamic edge functions** that read live from the database, then auto-ping GSC on content changes and on a daily cron.

## Steps

### 1. Dynamic sitemap edge function
Create `supabase/functions/sitemap-dynamic/index.ts`:
- Reads `type` from path/query (`blog`, `guides`, `glossary`).
- Queries the matching table with the same filters our build-time generator uses (`status=published`, etc.).
- Returns `application/xml` with proper `lastmod` from `updated_at`.
- Public (`verify_jwt = false`), cached `Cache-Control: public, max-age=300`.

### 2. Vercel rewrites
In `vercel.json`, rewrite:
- `/sitemap-blog.xml` → edge function `?type=blog`
- `/sitemap-guides.xml` → `?type=guides`
- `/sitemap-glossary.xml` → `?type=glossary`

Static files in `public/` for those three are deleted so the rewrite wins. Other sitemaps (main/products/categories/comparisons) stay static.

### 3. Resubmit edge function
Create `supabase/functions/resubmit-sitemaps/index.ts`:
- Iterates the 3 sitemap URLs.
- For each, calls `PUT https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/sites/sc-domain%3Areviewhunts.com/sitemaps/<urlencoded>` with headers `Authorization: Bearer ${LOVABLE_API_KEY}` and `X-Connection-Api-Key: ${GOOGLE_SEARCH_CONSOLE_API_KEY}`.
- Also pings IndexNow for the changed entity URL when provided in the body.
- Logs each submission outcome.

### 4. Link GSC connector to project
Use `standard_connectors--connect` for `google_search_console` so `GOOGLE_SEARCH_CONSOLE_API_KEY` is injected as an edge-function env var. `LOVABLE_API_KEY` is already provisioned.

### 5. DB triggers → call edge function
Migration adds AFTER INSERT/UPDATE triggers on:
- `blog_posts` (when `status='published'`)
- `buyer_guides`
- `glossary_terms`

Each trigger calls a SQL function `notify_sitemap_change(type text, slug text)` that uses `pg_net.http_post` to invoke `resubmit-sitemaps` with `{ type, slug }`. `pg_net` and `pg_cron` extensions are enabled if not already.

Trigger is debounced via a 60-second `pg_advisory_xact_lock` keyed by type so bulk updates don't fan out.

### 6. Daily cron fallback
`pg_cron` job at 03:00 UTC calls `resubmit-sitemaps` with `{ type: 'all' }` so Google sees a fresh `lastSubmitted` even on quiet days.

### 7. Admin trigger
Add a "Resubmit sitemaps now" button on `AdminFaqCachePage`'s sibling SEO admin (or a small new page) that invokes the same function for manual re-pings.

## Technical notes
- Sitemap edge function uses `SUPABASE_URL` + `SUPABASE_ANON_KEY` to query (RLS-safe; only published rows are readable to anon).
- Build-time `scripts/generate-sitemap.ts` keeps writing static files as a safety net; rewrites override them only for the three dynamic types.
- All XML escaped via `xmlEscape` helper to match existing generator.
- No schema changes beyond extension enablement + trigger functions.

## Files touched
- `supabase/functions/sitemap-dynamic/index.ts` (new)
- `supabase/functions/resubmit-sitemaps/index.ts` (new)
- `vercel.json` (rewrites)
- `public/sitemap-blog.xml`, `sitemap-guides.xml`, `sitemap-glossary.xml` (delete)
- `scripts/generate-sitemap.ts` (skip writing the three dynamic ones)
- New migration: extensions, `notify_sitemap_change`, triggers, cron job
