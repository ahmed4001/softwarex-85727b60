## Context

I searched the project for `softwarex.lovable.app` — it does not appear anywhere in `src/`, `public/`, or `index.html`. The only match is inside an old, immutable database migration file, which has no runtime effect.

Your canonical domain across `robots.txt`, all `sitemap*.xml` files, `SeoHead`, and `seo-canonical.ts` is already `https://reviewhunts.com`.

So there is nothing user-visible to remove. What I'll do is harden things so `softwarex.lovable.app` (or any other `*.lovable.app` host) can never sneak in as a canonical/og:url.

## Changes

1. **`src/lib/seo-canonical.ts`** — Hard-pin the canonical base to `https://reviewhunts.com`. Explicitly reject any host containing `lovable.app` (including `softwarex.lovable.app`) and fall back to the pinned domain.

2. **`src/components/SeoHead.tsx`** — Already strips preview/lovable.app hosts (line 26). Extend it to always rewrite the host to `reviewhunts.com` for emitted `<link rel="canonical">` and `og:url`, never leaving a Lovable preview URL in head tags even during local/preview rendering.

3. **`src/pages/admin/AdminSlugAuditPage.tsx`** (line 299) — This admin-only "open in preview" link uses the Lovable preview host on purpose (for staging QA). Leave it alone unless you want it removed too.

4. **Add a test** in `src/test/seo/` asserting no rendered route emits a canonical or og:url containing `lovable.app`. This prevents regressions.

## Out of scope

- The migration file mentioning `softwarex` — migrations are immutable history and have no runtime impact.
- Switching the canonical to any other domain (staying on `reviewhunts.com`).

## Question

Should I also remove the admin slug-audit preview link (item 3), or keep it for staging QA?
