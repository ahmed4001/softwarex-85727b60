
## Goal

Layer an Apploye-style **root-level keyword landing system** on top of the existing G2-style marketplace, plus optional programmatic route families (`/features`, `/use-cases`, `/industry`, `/templates`, `/buyer-guides` already exists). Keep `/product/:slug` commercial, `/blog` informational, and enforce one canonical per intent.

## Current state (already built)

- `/product/:slug`, `/categories`, `/category/:slug`, `/compare`, `/compare/:slug`, `/alternatives/:slug`, `/blog`, `/blog/:slug`, `/glossary/:slug`, `/author/:id`, `/lists`, `/tech-stacks`, `/leaderboard`, `/discussions`, `/user/:id`, `/login`, `/dashboard`, `/buyer-guides/:slug` — all live.
- `seo_landing_pages` table + `/best/:slug` programmatic pages + `generate-landing-pages` edge function exist.
- `seo-files` edge function builds sitemap/robots from DB.

What's **missing** vs. the request:
1. Root-level keyword URLs (`/employee-monitoring-software`, etc.) — today these live under `/best/`.
2. `/features/:feature`, `/use-cases/:slug`, `/industry/:slug`, `/templates/:slug` route families.
3. A documented canonical policy so `/product`, `/best/*`, root keyword pages, and `/category` don't cannibalize.
4. Sitemap coverage + structured internal linking between landing → product → compare.

## Scope of this plan

### 1. Root-level keyword landing pages (Apploye-style)

- New table `keyword_landing_pages`:
  - `slug` (root path segment, unique — e.g. `employee-monitoring-software`)
  - `h1`, `meta_title`, `meta_description`, `focus_keyword`
  - `hero_body` (markdown), `sections` (jsonb: array of `{heading, body, layout}` blocks for features/benefits/FAQ)
  - `primary_product_id` (the hero/CTA product — supports the Apploye pattern of one product owning the keyword)
  - `related_product_ids` (jsonb array) — comparison grid
  - `related_category_id`, `related_comparison_slugs` (jsonb), `related_blog_slugs` (jsonb) for internal linking
  - `faq` (jsonb), `schema_jsonld` (jsonb override)
  - `is_published`, `canonical_override` (nullable), `view_count`
- New page `src/pages/KeywordLandingPage.tsx` — long-form layout: hero with primary product CTA, feature blocks, comparison grid (related products), FAQ (FAQPage JSON-LD), internal link rail to `/compare/*` and `/blog/*`.
- New admin page `src/pages/admin/AdminKeywordLandingPage.tsx` — CRUD + AI-assist (reuse `generate-landing-pages` edge function, extended).
- Router: add a **catch-all root segment route** that resolves against `keyword_landing_pages.slug`. To avoid clashing with existing top-level routes, the route handler does a slug lookup; if no row matches → 404. The 5 launch slugs:
  - `/employee-monitoring-software`
  - `/project-time-tracking`
  - `/time-tracking-software`
  - `/employee-tracking-software`
  - `/productivity-monitoring-tool`

### 2. Programmatic route families

Reuse `keyword_landing_pages` with a `page_type` enum: `keyword | feature | use_case | industry | template`. Routes:

- `/features/:feature`
- `/use-cases/:slug`
- `/industry/:slug`
- `/templates/:slug`

`/buyer-guides/:slug` stays on its existing dedicated table.

One shared renderer component, type-specific section presets.

### 3. Canonical & duplicate-intent policy

Documented in code (constants file) and enforced in `SeoHead`:

| Page type | Canonical | Intent |
|---|---|---|
| `/product/:slug` | self | Commercial — single product |
| `/category/:slug` | self | Commercial — browse a category |
| `/compare/:slug` & `/alternatives/:slug` | self | Commercial comparison |
| `/{keyword}` (root) | self | Commercial — keyword-led, one primary product |
| `/best/:slug` (existing) | self | Commercial — "best X for Y" listicle |
| `/features/:feature`, `/use-cases/:slug`, `/industry/:slug`, `/templates/:slug` | self | Commercial — programmatic |
| `/blog/:slug` | self | Informational only |

Rules enforced:
- Each `keyword_landing_pages` row stores its `focus_keyword`; admin UI warns if the same focus keyword exists on another commercial page (product, category, comparison, other landing).
- Blog editor stays restricted to informational keywords (warn if focus keyword matches a commercial page).
- `canonical_override` field lets admin point a duplicate variant at the winning page.

### 4. Internal linking

In `KeywordLandingPage`:
- Hero CTA → `/product/<primary>`
- "Compare alternatives" rail → `/compare/<related_comparison_slugs>` and `/alternatives/<primary>`
- "Learn more" rail → `/blog/<related_blog_slugs>` and `/glossary/*`
- Breadcrumbs via existing `Breadcrumbs` component.

Add a small `useInternalLinks(focusKeyword)` hook that pulls 3-5 contextually related products/comparisons/posts for the sidebar.

### 5. Sitemap & robots

Extend `supabase/functions/seo-files/index.ts`:
- Add `keyword_landing_pages` rows where `is_published = true` to sitemap, grouped by `page_type` (root, `/features/`, `/use-cases/`, `/industry/`, `/templates/`).
- Keep existing `/best/`, `/product/`, `/category/`, `/blog/`, `/compare/` blocks.
- Designed to scale to 10K+ entries — paginated sitemap index (`/sitemap.xml` → references `/sitemap-products.xml`, `/sitemap-landing.xml`, `/sitemap-blog.xml`, etc.) once any single set exceeds 5K rows.

### 6. Admin enhancements

- New nav entry "Keyword Pages" under CMS.
- Per-page focus-keyword analyzer (reuse `FocusKeywordAnalyzer`).
- AI generator extended to seed `page_type`-specific section templates.
- Bulk publish/unpublish, view-count column, "duplicate intent" warning badges.

## Out of scope (call out explicitly)

- Custom domain / hreflang for localized landing pages — i18n table exists but no per-locale variants of landing pages in this pass.
- Webhooks/PWA/push from the original mega-spec.
- Automated backlink building.

## Technical notes

- DB: one migration creates `keyword_landing_pages` + `page_type` enum + indexes on `slug` and `(page_type, is_published)`.
- RLS: public read where `is_published = true`; admin write via `has_role(auth.uid(), 'admin')`.
- Routing: register the 5 root keyword slugs explicitly in `App.tsx` (not a catch-all) to keep React Router deterministic. The 4 programmatic families use `/:slug` params. Adding new root keywords later = add one `<Route>` line + a DB row.
- No changes to `src/integrations/supabase/{client,types}.ts` beyond auto-regeneration after migration.

## Deliverables

- 1 migration (table, enum, RLS, indexes)
- 1 public renderer + 4 route registrations (features/use-cases/industry/templates) + 5 root keyword routes
- 1 admin CRUD page + sidebar link
- Updated `seo-files` edge function (sitemap)
- Updated `generate-landing-pages` edge function (handles new `page_type`)
- Canonical policy constants + warnings in admin
