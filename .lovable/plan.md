## Goal

Extend `scripts/prerender.ts` so the build snapshots fully-rendered HTML for every DB-driven detail page (products, categories, blog, glossary, comparisons, alternatives, buyer guides) in addition to the static marketing routes it already covers.

## Approach

Reuse the same Supabase REST pattern from `scripts/generate-sitemap.ts` (anon key, `/rest/v1/<table>?select=slug&...`) so prerender shares a single source of truth for what's "indexable" and never falls out of sync with the sitemap.

Add a concurrent Playwright worker pool — the current loop is sequential, which is fine for ~20 routes but unworkable for thousands.

Apply quality filters and per-type caps so we don't waste minutes prerendering 9,398 products on every build. Caps are env-overridable for full runs.

### Route shapes (verified against `src/App.tsx` + sitemap generator)

| Type        | Path pattern               | Source table              | Filter                             |
| ----------- | -------------------------- | ------------------------- | ---------------------------------- |
| Products    | `/product/:slug`           | `products`                | `is_active=true`, has description  |
| Categories  | `/category/:slug`          | `categories`              | `is_active=true`, has description  |
| Blog        | `/blog/:slug`              | `blog_posts`              | `status=published`                 |
| Glossary    | `/glossary/:slug`          | `glossary_terms`          | `length(definition) > 40`          |
| Comparisons | `/compare/:slug`           | `comparisons`             | `is_published=true`                |
| Alternatives| `/alternatives/:slug`      | `alternative_pages`       | (all rows; only 3 today)           |
| Guides      | `/guides/:slug`            | `buyer_guides`            | (all rows; only 1 today)           |

### Caps (env-overridable)

```
PRERENDER_LIMIT_PRODUCTS   default 500   (top by avg_rating desc, nulls last)
PRERENDER_LIMIT_CATEGORIES default 200   (all 138 today)
PRERENDER_LIMIT_BLOG       default 500   (all 25 today)
PRERENDER_LIMIT_GLOSSARY   default 500   (1,204 in DB — top 500 by updated_at)
PRERENDER_LIMIT_COMPARISONS default 500
PRERENDER_LIMIT_ALTERNATIVES default 500
PRERENDER_LIMIT_GUIDES     default 500
PRERENDER_CONCURRENCY      default 6
PRERENDER_ALL=1            ignores all caps (used on demand / weekly)
```

Default run: ~138 categories + 25 blog + 500 glossary + 500 products + 3 comparisons + 3 alternatives + 1 guide + ~17 static ≈ **1,190 pages**, ~3-4 min at concurrency 6. Full run with `PRERENDER_ALL=1` would do ~11k pages; user can opt in for nightly/weekly jobs.

## Implementation

Rewrite `scripts/prerender.ts`:

1. **`fetchSlugs(table, opts)`** — small REST helper mirroring `generate-sitemap.ts` (same env-resolved `SUPABASE_URL` + anon key, same filter style), returns `string[]` of slugs. Supports `order` + `limit` query params for the products/glossary caps.

2. **`collectRoutes()`** — runs all 7 fetches in parallel, prepends the existing static route list, dedupes, returns `string[]`.

3. **Worker pool** — replace the `for...of` loop with N parallel workers (default 6) each owning a Playwright `BrowserContext`/`Page`, pulling from a shared queue. Keeps memory bounded (one context per worker, not one per route).

4. **`snapshot()`** — unchanged logic; just add a try/catch that logs and continues (one failed product slug must not abort the whole build). Failures still increment the `fail` counter so `PRERENDER_STRICT=1` can gate CI.

5. **Output paths** — same `dist/<route>/index.html` convention already used. Nested paths (`dist/product/<slug>/index.html`) get `mkdir -p` via `recursive: true` (already in place).

6. **Logging** — switch the per-route log to a periodic progress line (`[prerender] 240/1190 done, 2 failed`) every 25 routes to keep build logs readable.

7. **`vercel.json`** — no change needed; existing rewrite (`"/(.*) → /index.html"`) only fires when no static file matches, so the new nested `index.html` files will take precedence automatically.

## Files touched

- `scripts/prerender.ts` — rewrite (single file, ~180 lines).
- No package.json changes (script entry `build:prerender` already invokes it).
- No sitemap changes.

## Out of scope

- Lists, tech-stacks, discussions, pages, keyword landing pages — not requested. (They're in the sitemap; easy to add later by extending the `collectRoutes()` table list.)
- SSR / Next.js migration — explicitly declined earlier.
- Hydration mismatch hardening — `data-prerendered="true"` flag is already set; components already tolerate it.
