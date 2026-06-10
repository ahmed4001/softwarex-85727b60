import { test, expect } from "./fixtures/deterministic";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";
import { installStagingMocks, isMockingEnabled } from "./fixtures/mocked-staging";
import type { Page } from "@playwright/test";

// Fully-mocked smoke run: every staging-dependent asset (images,
// sitemap.xml, robots.txt) is intercepted and returned with a
// deterministic 200. Run alongside the live smoke suite in CI to
// distinguish "META/structure broken" from "staging CDN flaked".
//
// Gated by CI_MOCK_STAGING_ASSETS=1 (auto-enabled in the merge gate).

test.skip(!isMockingEnabled(), "CI_MOCK_STAGING_ASSETS not set");
test.afterEach(attachFailureArtifacts);

const ROUTES = ["/", "/products", "/blog", "/categories", "/compare"];

async function readSnap(page: Page) {
  return page.evaluate(() => {
    const canonicals = Array.from(
      document.head.querySelectorAll('link[rel="canonical"]'),
    ).map((l) => (l as HTMLLinkElement).href);
    const og = (k: string) =>
      document.head.querySelector(`meta[property="og:${k}"]`)?.getAttribute("content") || "";
    return {
      title: document.title,
      canonicals,
      ogTitle: og("title"),
      ogImage: og("image"),
      ogUrl: og("url"),
    };
  });
}

for (const path of ROUTES) {
  test(`SEO smoke (mocked staging) — ${path}`, async ({ page, context }) => {
    await installStagingMocks(context);

    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status() ?? 500).toBeLessThan(500);
    await page.waitForTimeout(300);

    const snap = await readSnap(page);
    expect(snap.title.length).toBeGreaterThan(0);
    expect(snap.canonicals.length).toBe(1);
    expect(snap.canonicals[0]).toMatch(/^https?:\/\//);
    expect(snap.ogTitle.length).toBeGreaterThan(0);
    expect(snap.ogUrl).toMatch(/^https?:\/\//);
    expect(snap.ogImage).toMatch(/^https?:\/\//);
  });
}

test("mocked sitemap.xml + robots.txt resolve 200", async ({ page, context }) => {
  await installStagingMocks(context);
  const base = process.env.STAGING_BASE_URL || "https://example.test";
  for (const p of ["/sitemap.xml", "/robots.txt"]) {
    const r = await page.request.get(base.replace(/\/$/, "") + p);
    expect(r.status(), `${p} mocked status`).toBe(200);
    const body = await r.text();
    expect(body.length, `${p} non-empty`).toBeGreaterThan(0);
  }
});
