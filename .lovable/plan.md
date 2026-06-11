# Sitewide Improvements — Phased Plan

26 items is too much for a single change without breaking things. I'll ship in 5 focused phases. You approve once; I'll execute Phase 1 immediately, then continue through the phases unless you say stop.

## Phase 1 — Critical fixes (ship first)
1. **A11y sweep** — add `aria-label` to every icon-only button (NotificationBell, FollowButton, ProductWatchButton, ReviewReactions, header menu, search clear, etc.).
2. **Mobile header search drawer** — collapse SearchBar into an icon on <768px; tap opens a full-width sheet.
3. **Route error boundaries** — wrap every lazy route in `RouteErrorBoundary` so a single page failure doesn't blank the app.
4. **Toast position on mobile** — top-center on <640px to avoid covering bottom UI.

## Phase 2 — UX wins
5. **URL-synced filters** on CategoryPage + SearchPage (shareable/bookmarkable).
6. **Sticky Compare bar** — bottom pill that appears when ≥2 products are added, with Compare / Clear actions.
7. **Standardized empty states** — audit all list pages to use `<EmptyState>` with CTA.
8. **Smart 404** — `NotFound` suggests products/categories based on the bad slug.
9. **Review form autosave** to localStorage with restore prompt.

## Phase 3 — Performance
10. **Lazy-load heavy components**: Hero3DScene, IntegrationGraph, RatingTrendChart, RichTextEditor, ProductAIChatbot.
11. **Image attrs**: `loading="lazy"`, explicit width/height, `decoding="async"` on ProductLogo + screenshots.
12. **TanStack Query staleTime** tuning for homepage/category queries (5–10 min).

## Phase 4 — SEO
13. **JSON-LD audit** — ensure Product+AggregateRating on ProductDetail, BreadcrumbList on deep pages, FAQPage where applicable.
14. **Paginated canonicals** on list pages.
15. **Glossary auto-linking** inside long-form content (blog/buyer guides).

## Phase 5 — Engagement & polish
16. **Notification preferences** screen (which Smart Alerts to receive).
17. **Onboarding** 3-step modal for new users.
18. **Claim product CTA** on unclaimed product pages.
19. **Deal countdown timers** on DealsPage.
20. **Dark mode QA** pass on gradients/glows.
21. **Stagger animations** on list reveals.

## Technical notes
- All changes frontend-only except where new tables/columns are required (none in Phase 1–3; Phase 5 #16 may add a `notification_preferences` table — I'll flag before).
- No design tokens changed; everything uses existing semantic tokens.
- Each phase ends with a TypeScript check.

## What I need from you
Reply **"go"** to start Phase 1. Say **"only phase X"** to scope down, or **"skip #N"** to drop specific items.
