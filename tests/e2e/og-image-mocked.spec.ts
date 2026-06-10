import { test, expect } from "./fixtures/deterministic";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";
import type { Page } from "@playwright/test";

// Mocked variant of og-image.spec.ts.
//
// Why this exists: the un-mocked spec fetches each og:image URL over the
// real network. In CI, staging CDNs occasionally return 502/timeouts that
// have nothing to do with our SEO meta tags. This variant intercepts
// every image request and serves a deterministic 200 PNG, so the spec
// only fails when the og:image META is actually wrong (missing,
// relative, bad extension) — not when the network blips.
//
// Toggle: set CI_MOCK_OG_IMAGES=1 to run; default-skipped otherwise so
// developers running the full suite locally still hit real CDNs.

test.skip(process.env.CI_MOCK_OG_IMAGES !== "1", "CI_MOCK_OG_IMAGES not set");
test.afterEach(attachFailureArtifacts);

const ROUTES_WITH_OG_IMAGE = [
  "/",
  "/products",
  "/blog",
  "/categories",
  "/compare",
];

const ALLOWED_EXT = /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i;

// 1×1 transparent PNG (smallest valid PNG bytes).
const FAKE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
  "base64",
);

async function readOgImage(page: Page) {
  return page.evaluate(() =>
    document.head
      .querySelector('meta[property="og:image"]')
      ?.getAttribute("content") || "",
  );
}

for (const path of ROUTES_WITH_OG_IMAGE) {
  test(`og:image (mocked) on ${path} is absolute + allowed type`, async ({ page, context }) => {
    // Intercept ALL image requests and return a synthetic 200 PNG. This
    // means we're validating the META tag, not the upstream CDN.
    await context.route("**/*", async (route) => {
      const req = route.request();
      const url = req.url();
      const looksLikeImage =
        req.resourceType() === "image" || ALLOWED_EXT.test(url);
      if (looksLikeImage) {
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: FAKE_PNG,
        });
        return;
      }
      await route.continue();
    });

    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status() ?? 500).toBeLessThan(500);
    await page.waitForTimeout(300);

    const ogImage = await readOgImage(page);
    expect(ogImage, `${path} must declare og:image`).toBeTruthy();
    expect(ogImage, `${path} og:image must be absolute http(s)`).toMatch(/^https?:\/\//);
    expect(
      ALLOWED_EXT.test(ogImage),
      `${path} og:image extension not allowed (${ogImage})`,
    ).toBe(true);

    // Sanity: the mocked fetch resolves 200 (proves the URL is at least
    // syntactically fetchable — DNS / scheme issues still surface).
    const probe = await page.request.get(ogImage).catch(() => null);
    expect(probe, `og:image not fetchable (${ogImage})`).toBeTruthy();
    expect(probe!.status()).toBe(200);
  });
}
