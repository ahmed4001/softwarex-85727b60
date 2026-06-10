# CI SEO Failure Guide

When the `seo-merge-gate` job goes red, start here. Each section maps a
common failure signature to the most likely root cause and the fastest
fix. All artifacts referenced below are uploaded by the workflow and
available in the **Actions → run → Artifacts** sidebar.

---

## 1. Playwright — `expect(...).toBe(...)` mismatches

**Artifact:** `playwright-report-merge-gate` (open `index.html`).

| Symptom | Likely cause | Fix |
|---|---|---|
| `exactly one canonical` failed — got `0` | Route renders before `react-helmet-async` flushes, or component forgot `<SeoHead />` | Add/await `<SeoHead canonical={...} />`; bump the `waitForTimeout` only as a last resort. |
| `exactly one canonical` failed — got `2+` | Two components both mount a `<link rel="canonical">` (typical when `__root` and a leaf both set it) | Leave canonical on leaf routes only. Remove from layout/root. |
| `og:title present` is empty | `<SeoHead>` props not passed for that route | Pass `title` / `description` props from the route component. |
| `non-empty title` failed | `document.title` empty during hydration | Set a default `<title>` in `index.html`; SeoHead overrides post-hydration. |
| Test times out before assertions | Staging slow or wrong base URL | Re-run via **SEO rerun failed specs** workflow; if persistent, check `STAGING_BASE_URL` secret. |

---

## 2. JSON-LD failures

**Artifact:** `playwright-test-results-merge-gate` → look for
`jsonld-extracted.json` attached to the failing test.

| Symptom | Likely cause | Fix |
|---|---|---|
| `at least one JSON-LD block` got `0` | Schema component not rendered (route refactor, conditional render guard) | Re-add `<ProductSchema />`, `<BlogPostingSchema />`, etc. to the route. |
| `@context` did not match `schema.org` | Typo or stale fixture (e.g. `"schemas.org"`) | Fix the constant in the schema component. |
| `BreadcrumbList positions not sequential` | Breadcrumb builder skipped a level or used 0-indexed positions | Positions must be `1, 2, 3, ...` integers in order. |
| `Product missing aggregateRating` | Product has no reviews yet | Conditionally omit `aggregateRating` rather than emitting `{}`; or seed a review. |
| `JSON.parse` failed | Unescaped quote / newline in description | Stringify via `JSON.stringify`, never hand-concatenate. |

---

## 3. Canonical / slug failures

**Spec:** `canonical-slug.spec.ts`, `canonical-consistency.spec.ts`.

| Symptom | Likely cause | Fix |
|---|---|---|
| Canonical contains `?category=` / `?page=` on a detail page | Canonical built from `window.location.href` | Build canonical from route params, never raw URL. |
| Canonical pagination dropped (`?page=2` → `/blog`) | Listing component hardcodes canonical to base path | Append `?page=N` (or `/page/N`) when `page > 1`. |
| Canonical changes after SPA navigation | SeoHead reads props lazily | Ensure SeoHead is keyed on route or re-mounts per route. |

---

## 4. `og:image` failures

**Spec:** `og-image.spec.ts` (live) or `og-image-mocked.spec.ts` (mocked).

| Symptom | Likely cause | Fix |
|---|---|---|
| `og:image must be absolute http(s)` | Relative `/og.png` passed | Prefix with `import.meta.env.VITE_PUBLIC_URL` or full origin. |
| Extension not allowed | URL is `.svg` or query-string disguised | Use png/jpg/webp/gif/avif; svg is unsupported by most social crawlers. |
| `og:image must return 2xx` but URL works in browser | Transient CDN flake | Rerun with **mock_og_images=true** in the rerun workflow; if mocked passes but live fails, file with infra. |
| Live fails repeatedly across PRs | CDN cache empty for new asset | Warm the URL via `curl` once, or pre-bake into the build. |

---

## 5. Sitemap / robots / liveness

**Specs:** `sitemap-robots.spec.ts`, `sitemap-liveness.spec.ts`.

| Symptom | Likely cause | Fix |
|---|---|---|
| `Disallow: /` blocks all crawlers | Default robots.txt shipped | Replace `Disallow: /` with route-specific rules. |
| Sitemap URL returns 404 | Page was renamed/removed but sitemap generator cached | Re-run the sitemap build job; verify the source query. |
| Redirect lands on a different canonical | 301 to a normalized slug, but canonical wasn't updated | Either don't redirect, or point canonical at the redirect target. |

---

## 6. Lighthouse failures

**Artifact:** `lighthouse-report-merge-gate` → `lhr-*.json` and `*.html`.

| Symptom | Likely cause | Fix |
|---|---|---|
| `seo` score below threshold | Missing `<meta name="description">` or `<title>`, or links lacking accessible names | Open the HTML report — Lighthouse names the exact audit. |
| `performance` score below threshold | Render-blocking JS, unoptimized hero image | Compress hero image, lazy-load below-the-fold components. |
| Audit could not load page | Staging cold start | Rerun with the **SEO rerun failed specs** workflow. |

---

## Rerunning only failed specs

Don't burn 15 minutes re-running the whole gate. Use the
**SEO rerun failed specs** workflow (`workflow_dispatch`):

- **failed_specs** — comma-separated paths, e.g. `tests/e2e/og-image.spec.ts,tests/e2e/sitemap-liveness.spec.ts`.
- **previous_run_id** — the failed SEO CI run ID; the workflow pulls
  `test-results/.last-run.json` and reruns only what failed.
- **mock_og_images** — toggle on if you suspect staging-CDN flake.

Artifacts regenerated: `playwright-report-rerun`,
`playwright-test-results-rerun`, `playwright-console-log-rerun`.

---

## Escalation

1. Reproduce locally: `STAGING_BASE_URL=... bunx playwright test <spec> --headed`.
2. Attach the `playwright-test-results-*` zip in the PR thread.
3. If staging itself is the suspect, check the **SEO CI dashboard**
   comment on the PR — repeated failures across unrelated PRs almost
   always mean staging, not the change under review.
