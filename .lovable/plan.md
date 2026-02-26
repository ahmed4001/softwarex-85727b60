

# Dynamic robots.txt and sitemap.xml Edge Function

## Overview
Create a single edge function `seo-files` that serves both `/robots.txt` and `/sitemap.xml` dynamically, reading configuration from the `site_settings` table and querying products, categories, blog posts, and comparisons for sitemap generation.

## Architecture

The function receives a `type` query parameter (`robots` or `sitemap`) and returns the appropriate content.

**File:** `supabase/functions/seo-files/index.ts`

### robots.txt Handler
- Reads `robots_txt` from `site_settings` table
- Falls back to the default value if not configured
- Returns `text/plain` content type

### sitemap.xml Handler
- Reads `sitemap_include_products`, `sitemap_include_categories`, `sitemap_include_blog`, `sitemap_include_comparisons` toggles from `site_settings`
- Conditionally queries each table:
  - `products` where `is_active = true` -- uses `/product/{slug}`
  - `categories` where `is_active = true` -- uses `/category/{slug}`
  - `blog_posts` where `status = 'published'` -- uses `/blog/{slug}`
  - `comparisons` where `is_published = true` -- uses `/compare/{slug}`
- Builds XML sitemap with `<lastmod>` from `updated_at` where available
- Includes static pages (/, /categories, /compare, /blog, /leaderboard)
- Returns `application/xml` content type

### Config
Add to `supabase/config.toml`:
```toml
[functions.seo-files]
verify_jwt = false
```

This must be public (no auth) since search engine crawlers need access.

### Frontend Integration
No frontend changes needed initially. The function can be called at:
```
https://{project}.supabase.co/functions/v1/seo-files?type=robots
https://{project}.supabase.co/functions/v1/seo-files?type=sitemap
```

The admin can point their domain's `/robots.txt` and `/sitemap.xml` to these URLs, or they can be referenced directly in the robots.txt Sitemap directive.

## Technical Details

- Uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (already configured) to query the database
- No new secrets required
- No database changes required
- Responses are cached-friendly with appropriate headers
- The base URL for sitemap entries will be derived from the request's origin or a configurable setting

