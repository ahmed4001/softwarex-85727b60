import { test, expect, Page } from "@playwright/test";

// SEO smoke tests for key public routes. For each route we assert:
//   1) Exactly one <link rel="canonical"> exists and is absolute.
//   2) og:title, og:description, og:url meta tags are present + non-empty.
//   3) At least one valid <script type="application/ld+json"> block exists,
//      parses as JSON, and has an @context referencing schema.org.

const ROUTES = [
  { path: "/", label: "home" },
  { path: "/products", label: "products index" },
  { path: "/blog", label: "blog index" },
  { path: "/categories", label: "categories index" },
  { path: "/compare", label: "comparison index" },
  { path: "/search?q=crm", label: "search results" },
];

async function readSeoSnapshot(page: Page) {
  return page.evaluate(() => {
    const canonicals = Array.from(
      document.head.querySelectorAll('link[rel="canonical"]'),
    ).map((l) => (l as HTMLLinkElement).href);
    const og = (key: string) =>
      document.head
        .querySelector(`meta[property="og:${key}"]`)
        ?.getAttribute("content") || "";
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

for (const route of ROUTES) {
  test(`SEO smoke — ${route.label} (${route.path})`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: "networkidle" });
    expect(response, "page must respond").toBeTruthy();
    expect(response!.status(), `${route.path} should not 5xx`).toBeLessThan(500);

    // Give react-helmet-async a tick to flush head mutations after hydration.
    await page.waitForTimeout(500);

    const snap = await readSeoSnapshot(page);

    expect(snap.title.length, "non-empty title").toBeGreaterThan(0);

    expect(snap.canonicals.length, "exactly one canonical").toBe(1);
    expect(snap.canonicals[0]).toMatch(/^https?:\/\//);

    expect(snap.ogTitle.length, "og:title present").toBeGreaterThan(0);
    expect(snap.ogDescription.length, "og:description present").toBeGreaterThan(0);
    expect(snap.ogUrl, "og:url present + absolute").toMatch(/^https?:\/\//);

    expect(snap.jsonLdBlocks.length, "at least one JSON-LD block").toBeGreaterThan(0);
    for (const block of snap.jsonLdBlocks) {
      expect(String(block["@context"] || "")).toMatch(/schema\.org/i);
      expect(block["@type"], "JSON-LD @type present").toBeTruthy();
    }
  });
}
