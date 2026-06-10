import { test, expect } from "./fixtures/deterministic";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";
import type { Page } from "@playwright/test";

// Extended SEO smoke coverage — runs in the merge gate alongside
// seo-smoke.spec.ts but reaches deeper into the site:
//   - Multiple product subcategories (not just the /products index)
//   - Deeper blog pagination (page 2, 3, ...)
//
// Validates the same invariants as the base smoke spec: one canonical,
// non-empty title / OG tags, at least one parseable JSON-LD block.

test.afterEach(attachFailureArtifacts);

// Subcategory slugs cover the most-trafficked verticals; tweak via
// SEO_SMOKE_SUBCATEGORIES env (comma-separated) if the taxonomy changes.
const DEFAULT_SUBCATEGORIES = [
  "crm",
  "marketing-automation",
  "analytics",
  "project-management",
  "communication",
  "ai-tools",
];
const SUBCATEGORIES = (process.env.SEO_SMOKE_SUBCATEGORIES || DEFAULT_SUBCATEGORIES.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const BLOG_PAGE_DEPTH = Number(process.env.SEO_SMOKE_BLOG_DEPTH || 4); // pages 1..N

function subcategoryRoutes() {
  return SUBCATEGORIES.flatMap((slug) => [
    { path: `/category/${slug}`, label: `category:${slug}` },
    { path: `/products?category=${slug}`, label: `products?category=${slug}` },
  ]);
}

function blogPaginationRoutes() {
  const routes: { path: string; label: string }[] = [];
  for (let p = 1; p <= BLOG_PAGE_DEPTH; p++) {
    routes.push({ path: p === 1 ? "/blog" : `/blog?page=${p}`, label: `blog p${p}` });
  }
  return routes;
}

async function readSeoSnapshot(page: Page) {
  return page.evaluate(() => {
    const canonicals = Array.from(
      document.head.querySelectorAll('link[rel="canonical"]'),
    ).map((l) => (l as HTMLLinkElement).href);
    const og = (k: string) =>
      document.head.querySelector(`meta[property="og:${k}"]`)?.getAttribute("content") || "";
    const jsonLdBlocks = Array.from(
      document.head.querySelectorAll('script[type="application/ld+json"]'),
    )
      .map((s) => {
        try { return JSON.parse(s.textContent || "null"); } catch { return null; }
      })
      .filter(Boolean);
    return {
      title: document.title,
      canonicals,
      ogTitle: og("title"),
      ogDescription: og("description"),
      ogUrl: og("url"),
      jsonLdBlocks,
    };
  });
}

async function assertSmoke(page: Page, path: string, label: string) {
  const res = await page.goto(path, { waitUntil: "networkidle" });
  // Some subcategories may legitimately 404 if the slug was retired;
  // we don't want a stale fixture to break the gate. 404 is tolerated,
  // but the page must still emit a valid canonical (rendered by SPA).
  expect(res, `${label} must respond`).toBeTruthy();
  expect(res!.status(), `${label} should not 5xx`).toBeLessThan(500);
  await page.waitForTimeout(500);

  const snap = await readSeoSnapshot(page);
  expect(snap.title.length, `${label} non-empty title`).toBeGreaterThan(0);
  expect(snap.canonicals.length, `${label} exactly one canonical`).toBe(1);
  expect(snap.canonicals[0], `${label} canonical absolute`).toMatch(/^https?:\/\//);
  expect(snap.ogTitle.length, `${label} og:title`).toBeGreaterThan(0);
  expect(snap.ogDescription.length, `${label} og:description`).toBeGreaterThan(0);
  expect(snap.ogUrl, `${label} og:url absolute`).toMatch(/^https?:\/\//);
  expect(snap.jsonLdBlocks.length, `${label} ≥1 JSON-LD block`).toBeGreaterThan(0);
  for (const block of snap.jsonLdBlocks) {
    expect(String(block["@context"] || "")).toMatch(/schema\.org/i);
    expect(block["@type"], `${label} JSON-LD @type present`).toBeTruthy();
  }
}

for (const route of subcategoryRoutes()) {
  test(`SEO smoke (subcategory) — ${route.label}`, async ({ page }) => {
    await assertSmoke(page, route.path, route.label);
  });
}

for (const route of blogPaginationRoutes()) {
  test(`SEO smoke (blog pagination) — ${route.label}`, async ({ page }) => {
    await assertSmoke(page, route.path, route.label);

    // Pagination-specific: canonical must NOT silently drop the ?page=N
    // marker (otherwise pages 2..N collapse onto page 1 in Google's index).
    if (/\?page=\d+/.test(route.path)) {
      const canonical = await page.evaluate(
        () => (document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement)?.href || "",
      );
      const pageMatch = route.path.match(/page=(\d+)/);
      const pageNum = pageMatch ? pageMatch[1] : "1";
      expect(
        canonical.includes(`page=${pageNum}`) || canonical.endsWith(`/blog/page/${pageNum}`),
        `blog page ${pageNum} canonical must preserve pagination marker (got ${canonical})`,
      ).toBe(true);
    }
  });
}
