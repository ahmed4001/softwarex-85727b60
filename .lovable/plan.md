This is four large workstreams. Approve or trim before I start — building all of it end-to-end is a multi-turn effort.

## 1. Automatic internal-link recommendations (products + blog)

Extend the existing `InternalLinksSuggestionPanel` pattern into a first-class, page-level system:

- New edge function `suggest-internal-links` that, given `{ entity_type: 'product' | 'blog', id }`, returns ranked related entities using:
  - Same category / shared tags / title-token overlap (already in the panel)
  - Co-view / co-visit signals if `web_vitals` or an events table has them (skip if absent)
  - Comparison graph (`comparisons` table) for products
- New table `internal_link_suggestions (entity_type, entity_id, target_type, target_id, score, reason, updated_at)` with GRANTs + RLS (public read, service_role write).
- Nightly cron edge function `refresh-internal-link-suggestions` recomputes top 8 per entity.
- Public rendering: new `<RelatedLinks entityType entityId />` component shown on `ProductDetailPage` (below screenshots) and `BlogPostPage` (below body, above `RelatedPosts`) — improves crawl depth to long-tail pages.
- Admin surface: reuse `InternalLinksSuggestionPanel` — add a Products tab.

## 2. Build-time JSON-LD + OG validation gate

- Extend `src/lib/jsonLdValidator.ts` with rules for `Review`, `Dataset`, and a companion `validateOgTags()` (og:title/description/image/url/type + twitter:card).
- New Playwright spec `tests/e2e/structured-data-gate.spec.ts` that crawls a representative URL set (home, one product, one blog, one comparison, one category, one glossary term) via the running preview, extracts every `<script type="application/ld+json">` + `<meta property="og:*">`, runs both validators, and **fails the run** on any invalid block.
- CI: add a `structured-data-gate` job to `.github/workflows/` that runs the spec and is a required check — merges + deploys blocked on failure.
- Unit tests in `src/test/seo/` for the new Review + Dataset + OG rules.

## 3. Keyword-gap analysis for top-impression pages

Data source is **GSC** (Semrush shows almost no organic footprint — 20 keywords total; GSC has 1,481 impressions with real query data). For each of the top ~15 impression pages:

- Pull `dimensions=[page, query]` from Search Console API (last 28 days).
- For each page, use Semrush `keyword_research` on the page's top query to fetch related terms + questions, then diff against terms the page **already** ranks for (positions ≤ 20 from GSC).
- Feed page HTML + gap keywords to Lovable AI (`google/gemini-3-flash-preview`) with a structured-output tool call to produce: recommended H2/H3 additions, FAQ candidates, internal-link targets, title/meta rewrites.
- Persist to a new `content_recommendations` table; render in a new admin page `AdminContentRecommendationsPage` with a "Copy to editor" button.
- Backing edge function: `analyze-page-gaps`.

## 4. Semrush audit — fix all issues

The audit shows **no technical Semrush issues to fix in code**. The findings are strategic:

| Finding | Recommended action |
|---|---|
| Authority Score 2/100, 107 referring domains but most from spam TLDs (`.sbs`, `.cfd`, `.monster`) | Disavow file — I'll generate `public/disavow.txt` listing the toxic domains from the backlink report; user uploads it via GSC Disavow tool (Google-side, not code) |
| 20 US keywords ranking, 0 estimated traffic (all positions 23-81) | Handled by workstream 3 — content recs will target the near-page-1 keywords (`accutrax` #8, `trustweaver` #23, `photomator pricing` #24, `is softwarehubs legit` #26) |
| `www.reviewhunts.com` vs `reviewhunts.com` split (both appear in rankings) | Verify a permanent 301 from `www.` → apex in `vercel.json` and set canonical to apex host consistently |
| Anchor text 89% branded, 4 spam-injected anchors | Disavow (same file) |

Concrete code changes for #4:
- `public/disavow.txt` with the 10+ spam TLDs from the report.
- `vercel.json` redirect: `www.reviewhunts.com/*` → `https://reviewhunts.com/$1` (301).
- Sanity-check `SeoHead` canonical always uses apex `reviewhunts.com` — add a test.

---

## Suggested order (I'd do it this way)

1. **Semrush fixes (#4)** — small, ~1 turn.
2. **JSON-LD/OG build gate (#2)** — self-contained, ~1 turn.
3. **Internal-link system (#1)** — migration + edge fn + UI, ~2 turns.
4. **Keyword-gap recommendations (#3)** — depends on GSC connector + AI + admin UI, ~2 turns.

**Reply "go" to run all four in that order**, or name the subset you want (e.g. "1, 2, 4 only" or "just #4 for now"). I won't touch business logic outside what's listed.