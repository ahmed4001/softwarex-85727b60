import { test, expect } from "./fixtures/deterministic";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";
import { request } from "@playwright/test";
import type { Page } from "@playwright/test";

// Validate og:image across key public routes:
//   - present
//   - absolute http(s) URL
//   - file extension is in the allowed image type list
//   - returns 200 (or any 2xx) from the staging server
// A broken og:image is one of the most common social-preview bugs.

test.afterEach(attachFailureArtifacts);

const ROUTES_WITH_OG_IMAGE = [
  "/",
  "/products",
  "/blog",
  "/categories",
  "/compare",
];

const ALLOWED_EXT = /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i;
const ALLOWED_MIME = /^image\/(png|jpe?g|webp|gif|avif)$/i;

async function readOgImage(page: Page) {
  return page.evaluate(() => {
    const get = (sel: string) =>
      document.head.querySelector(sel)?.getAttribute("content") || "";
    return {
      ogImage: get('meta[property="og:image"]'),
      ogImageSecure: get('meta[property="og:image:secure_url"]'),
      twitterImage: get('meta[name="twitter:image"]'),
    };
  });
}

for (const path of ROUTES_WITH_OG_IMAGE) {
  detTest(`og:image on ${path} is absolute, allowed type, and 200`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status() ?? 500).toBeLessThan(500);
    await page.waitForTimeout(500);

    const { ogImage } = await readOgImage(page);
    expect(ogImage, `${path} must declare og:image`).toBeTruthy();
    expect(ogImage, `${path} og:image must be absolute http(s)`).toMatch(/^https?:\/\//);
    expect(
      ALLOWED_EXT.test(ogImage),
      `${path} og:image extension not allowed (${ogImage}); allow png/jpg/jpeg/webp/gif/avif`,
    ).toBe(true);

    // HEAD first, fall back to GET (some CDNs disallow HEAD).
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    let imgRes = await ctx.fetch(ogImage, { method: "HEAD" }).catch(() => null);
    if (!imgRes || imgRes.status() === 405 || imgRes.status() === 501) {
      imgRes = await ctx.get(ogImage);
    }
    expect(imgRes, `og:image fetch failed (${ogImage})`).toBeTruthy();
    expect(imgRes!.status(), `og:image must return 2xx (${ogImage})`).toBeGreaterThanOrEqual(200);
    expect(imgRes!.status()).toBeLessThan(300);

    const ct = imgRes!.headers()["content-type"] || "";
    expect(
      ALLOWED_MIME.test(ct),
      `og:image content-type "${ct}" not in allowed image MIME list`,
    ).toBe(true);
  });
}

