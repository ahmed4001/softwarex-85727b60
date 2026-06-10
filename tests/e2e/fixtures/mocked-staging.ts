// Playwright fixture that intercepts every staging-dependent asset and
// serves a deterministic 200 response. Enable via CI_MOCK_STAGING_ASSETS=1.
//
// Mocked surfaces:
//   - Images (og:image, <img>, favicons) → 1×1 PNG, image/png
//   - /sitemap.xml                       → minimal valid <urlset>
//   - /robots.txt                        → permissive policy
//
// Why: staging CDNs occasionally 502 / time out on these assets,
// which produces flaky red merge gates that say nothing about the
// SEO change under review. Mocking isolates META/structure
// correctness from infrastructure noise.

import type { BrowserContext, Page } from "@playwright/test";

const FAKE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
  "base64",
);

const ALLOWED_IMG_EXT = /\.(png|jpe?g|webp|gif|avif|ico|svg)(\?.*)?$/i;

const FAKE_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>__BASE__/</loc></url>
  <url><loc>__BASE__/products</loc></url>
  <url><loc>__BASE__/blog</loc></url>
</urlset>`;

const FAKE_ROBOTS = `User-agent: *
Allow: /
Sitemap: __BASE__/sitemap.xml
`;

export interface MockStagingOptions {
  /** Mock <img>/og:image fetches (default true) */
  mockImages?: boolean;
  /** Mock /sitemap.xml + nested sitemaps (default true) */
  mockSitemap?: boolean;
  /** Mock /robots.txt (default true) */
  mockRobots?: boolean;
  /** Base URL to embed inside the fake sitemap/robots */
  baseUrl?: string;
}

export function isMockingEnabled() {
  return process.env.CI_MOCK_STAGING_ASSETS === "1";
}

export async function installStagingMocks(
  target: BrowserContext | Page,
  opts: MockStagingOptions = {},
) {
  const {
    mockImages = true,
    mockSitemap = true,
    mockRobots = true,
    baseUrl = process.env.STAGING_BASE_URL || "https://example.test",
  } = opts;

  await target.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    const resType = req.resourceType();

    if (mockRobots && /\/robots\.txt(\?.*)?$/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: FAKE_ROBOTS.replace(/__BASE__/g, baseUrl.replace(/\/$/, "")),
      });
      return;
    }

    if (mockSitemap && /\/sitemap(?:[-_]?\w+)?\.xml(\?.*)?$/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/xml",
        body: FAKE_SITEMAP.replace(/__BASE__/g, baseUrl.replace(/\/$/, "")),
      });
      return;
    }

    if (mockImages && (resType === "image" || ALLOWED_IMG_EXT.test(url))) {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: FAKE_PNG,
      });
      return;
    }

    await route.continue();
  });
}
