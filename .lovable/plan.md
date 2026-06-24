
# AEO + GEO Plan for ReviewHunts

**AEO** (Answer Engine Optimization) = getting cited by ChatGPT, Perplexity, Claude, Gemini, Bing Copilot.
**GEO** (Generative Engine Optimization) = getting surfaced inside Google AI Overviews and SGE answer boxes.

Both reward the same things: machine-readable facts, clear extractable answers, brand/entity authority, and crawler access. Below is what to add, in priority order.

---

## 1. Let AI crawlers in (blocker)

Update `public/robots.txt` to explicitly allow the major AI bots. Many sites accidentally block them via wildcard rules or CDN defaults.

Allow: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `ClaudeBot`, `anthropic-ai`, `Bingbot`, `Amazonbot`, `meta-externalagent`, `CCBot`.

Add `llms.txt` at `public/llms.txt` — an emerging standard (Anthropic-led) that gives LLMs a curated map of your most citable URLs (top products, category hubs, comparisons, guides, glossary). Generate it the same way as sitemap.xml from the DB.

## 2. Structured data everywhere (biggest GEO lever)

Expand JSON-LD coverage. Most pages already have some — fill the gaps:

- **Product pages** → `Product` + `AggregateRating` + `Review` + `Offer`. Critical for AI Overviews "best X" answers.
- **Comparison pages** → `ItemList` of Products + `FAQPage` for the "X vs Y" Q&A.
- **Blog/Guides** → `Article` + `Author` (with sameAs to LinkedIn) + `BreadcrumbList`.
- **Glossary** → `DefinedTerm` inside a `DefinedTermSet`. Huge for "what is X" AI answers.
- **Q&A threads** → `QAPage` with accepted answer.
- **Homepage** → `Organization` + `WebSite` with `SearchAction` (sitelinks search box).
- **Awards / leaderboards** → `ItemList` ranked.

## 3. Answer-first content blocks

AI engines extract the first 2-3 sentences after an H2/H3 that look like a direct answer. Add to every product, comparison, and guide page:

- A **TL;DR / Quick Answer** block at the top (1-3 sentences, plain text, no marketing fluff).
- An **FAQ accordion** with `FAQPage` JSON-LD (5-8 real questions per page).
- **Key facts table** — pricing, founded year, integrations count, free plan yes/no. Tables are heavily extracted.

Add a reusable `<AnswerBlock>` and `<FactsTable>` component, render on Product/Comparison/Guide/Glossary routes.

## 4. Entity & author authority

AI engines weight E-E-A-T heavily for citations.

- Add `Person` schema for review authors with `sameAs` linking LinkedIn/X profiles.
- Author bio page per author (already have profiles — expose them at `/author/:username` with full schema).
- Add `Organization` schema with `sameAs` for ReviewHunts' own social handles.
- Show "Verified buyer / Verified vendor" badges in review markup (`Review.author.additionalType`).

## 5. Citations & freshness signals

- Every product/blog page renders a visible **"Last updated: <date>"** and matching `dateModified` in JSON-LD. Perplexity ranks fresh sources higher.
- Add outbound citation links (`<a rel="cite">` to vendor docs, G2, official changelogs) on long-form content — generative engines copy citation graphs.
- Add an `/api/data` or static JSON endpoint per product (`/p/<slug>.json`) so AI crawlers can grab structured facts without parsing HTML. Cheap; just serialize the product row.

## 6. Tracking & measurement

- Edge function `track-ai-referrer` logs traffic from `chat.openai.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai` referrers into a new `ai_referrals` table. Surface in Admin Analytics so you can see which pages get cited.
- Weekly cron: query `pg_stat` for AI bot user-agents hitting the site (GPTBot, PerplexityBot, etc.) and log crawl volume per page.
- Admin dashboard widget: "AI visibility" — pages cited, top referrer engines, crawl frequency.

## 7. IndexNow + sitemap hygiene (already partly done)

- `pingIndexNow()` is wired — call it from product approval, blog publish, comparison creation, deal updates. Bing/Yandex powers Copilot.
- Submit `llms.txt` URL inside `robots.txt` alongside `Sitemap:` directive.

---

## Technical sections

**New files**
- `public/llms.txt` (generator script, like sitemap)
- `scripts/generate-llms-txt.ts` + `predev`/`prebuild` hook
- `src/components/seo/AnswerBlock.tsx`, `FactsTable.tsx`, `FAQSection.tsx` (with JSON-LD)
- `src/components/seo/ProductSchema.tsx`, `ComparisonSchema.tsx`, `GlossarySchema.tsx`, `QASchema.tsx`, `ArticleSchema.tsx`
- `supabase/functions/track-ai-referrer/index.ts`
- `src/pages/Author.tsx` at route `/author/:username`

**Files to edit**
- `public/robots.txt` — add AI bot allow blocks + `Sitemap` + `LLMs` directive
- `index.html` — extend Organization schema with `sameAs`, add `WebSite` + `SearchAction`
- Product, Comparison, Blog, Glossary, QA page components — inject AnswerBlock + FactsTable + FAQ + schemas
- All publish-flow code paths (product approval edge function, blog publish handler, comparison creator) — call `pingIndexNow`

**New DB**
- `ai_referrals` table (id, session_id, referrer_engine, landing_path, user_agent, created_at) + RLS + GRANTs
- `ai_crawl_log` table (id, bot_name, path, status, crawled_at) + RLS + GRANTs

**Build order** — ship in this order so each step is measurable:
1. robots.txt + llms.txt (instant crawler access)
2. Expanded JSON-LD on Product/Comparison/Glossary (biggest GEO win)
3. AnswerBlock + FAQ components site-wide
4. AI referrer tracking + admin dashboard widget
5. Author pages + entity authority schema
6. Per-product `.json` endpoint

---

## Out of scope (call out separately if you want)

- Building actual links/citations from external sites (manual outreach, PR)
- Multi-language AEO (separate plan if you want hreflang + translated answer blocks)
- A "Submit my product to AI engines" vendor-facing feature

Reply **"build"** to ship step 1+2, or pick specific steps.
