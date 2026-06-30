# Full-site audit — fix plan

Scope: SEO findings, security scan, accessibility, performance. Mode: review first, then I implement.

## Findings summary

**Security scan — 25 findings**
- 1 **error (P0)**: `profiles.email` (and `last_login_at`, `is_banned`, `ban_reason`) are readable by `anon`/`authenticated` via the public SELECT policy — real emails confirmed in sample data.
- 7 warn: RLS policies using `USING (true)` / `WITH CHECK (true)` on non-SELECT operations.
- 15 warn: `SECURITY DEFINER` functions executable by `anon` and/or `authenticated` without an explicit grant gate.
- 1 warn: Auth leaked-password (HIBP) protection disabled.

**SEO scan — 2 low findings**
- `/robots.txt` and `/sitemap.xml` reported missing. Both files exist in `public/` and ship in prod (`reviewhunts.com/robots.txt` is live). The scanner is hitting the preview URL where Vercel rewrites aren't applied. Verify and mark resolved.

**Accessibility — codebase audit (no scanner)**
- Lint gate already enforces `alt`/`loading`/`decoding` on `<img>` (passing).
- Need to sweep for: icon-only buttons missing `aria-label`, low-contrast `text-gray-*` overrides, missing `<main>` on a few routes, focus-visible rings on custom interactive divs, tap targets <44px on mobile drawers/filter chips.

**Performance / Web Vitals**
- Real-user metrics already streaming to `web_vitals`. Pull the last 7 days of p75 LCP/CLS/INP per route, fix the slowest 3 pages (likely candidate: image-heavy product/category routes, comparison tables).
- Re-verify `preload` of hero logo + font, `modulepreload` of `main.tsx`, and that GA/Paddle stay deferred.

## What I will change

### 1. Security (highest priority)
1. **Migration**: revoke column-level SELECT on `profiles.email`, `last_login_at`, `is_banned`, `ban_reason` from `anon` and `authenticated`. Replace any client code reading those columns with `admin_*` RPCs already in place.
2. **Migration**: tighten the 7 `USING (true)` non-SELECT policies — scope each to `auth.uid()` ownership or `has_role(...,'admin')` based on the table's intent. I'll list each policy in the migration comment.
3. **Migration**: for the 15 `SECURITY DEFINER` functions, `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE` only to the role that needs it (most are trigger-only or admin-only; the public-facing `has_role`, `increment_*_view/click` stay granted to the right roles).
4. **Auth**: enable HIBP leaked-password protection via `configure_auth`.

### 2. SEO
5. Verify `/robots.txt` and `/sitemap.xml` are reachable on the canonical production host, then mark the two SEO findings fixed with that verification.
6. No code change expected — preview-host false positives.

### 3. Accessibility
7. Sweep components for icon-only `<Button size="icon">` without `aria-label`; add labels.
8. Replace stray `text-gray-300/400/500` on body text with `text-muted-foreground`.
9. Ensure each route layout has a single `<main>` landmark (audit `src/components/PublicLayout*` and admin/vendor layouts).
10. Add `min-h-11 min-w-11` to mobile filter chips and other primary icon buttons.

### 4. Performance
11. Read the `web_vitals` table for p75 LCP/CLS/INP per `path`, last 7 days. Pick the 3 worst routes and apply targeted fixes (image dimensions to prevent CLS, splitting heavy JSON-LD, deferring below-the-fold queries).
12. Re-confirm preloads in `index.html` are correct after recent changes, no stale references.

## Out of scope
- No new features, no design changes, no copy rewrites.
- I will not modify `auth`, `storage`, or auto-generated Supabase client files.
- I will not touch the published sitemap mechanism beyond verifying it.

## Order of execution
P0 security migration → SEO verification + mark fixed → a11y sweep → performance fixes from real Web Vitals data.

Approve and I will start with the security migration.
