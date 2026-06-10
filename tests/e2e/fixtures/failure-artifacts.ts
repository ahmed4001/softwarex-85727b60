// Shared Playwright failure-artifact hook. Attaches:
//   - page-url.txt          current page URL (may be empty for non-browser tests)
//   - page.html             full document HTML
//   - jsonld-blocks.json    every parsed <script type="application/ld+json">
//   - browser-console.log   captured by the deterministic fixture
//   - page.png              full-page screenshot (best-effort)
//   - sitemap.xml           live copy fetched from STAGING_BASE_URL
//   - robots.txt            live copy fetched from STAGING_BASE_URL
//
// Use from a spec like:
//   test.afterEach(attachFailureArtifacts);

import type { Page, TestInfo } from "@playwright/test";
import { request } from "@playwright/test";

const BASE =
  process.env.STAGING_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://id-preview--8f8ab8bf-14f5-4085-9849-266b90f727c8.lovable.app";

async function safeFetch(url: string): Promise<string> {
  try {
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    const res = await ctx.get(url);
    return `HTTP ${res.status()} ${res.statusText()}\n\n${await res.text()}`;
  } catch (e) {
    return `(failed to fetch ${url}: ${String(e)})`;
  }
}

export async function attachFailureArtifacts(
  { page }: { page: Page },
  testInfo: TestInfo,
) {
  if (testInfo.status === testInfo.expectedStatus) return;
  try {
    const url = page?.url?.() || "(no page)";
    await testInfo.attach("page-url.txt", { body: url, contentType: "text/plain" });

    const html = await page?.content().catch(() => "<unavailable>");
    if (html) {
      await testInfo.attach("page.html", { body: html, contentType: "text/html" });
    }

    const blocks = await page
      ?.evaluate(() =>
        Array.from(
          document.head.querySelectorAll('script[type="application/ld+json"]'),
        ).map((s) => {
          try {
            return { ok: true, data: JSON.parse(s.textContent || "null") };
          } catch (e) {
            return { ok: false, error: String(e), text: s.textContent };
          }
        }),
      )
      .catch(() => [] as unknown[]);
    await testInfo.attach("jsonld-blocks.json", {
      body: JSON.stringify(blocks ?? [], null, 2),
      contentType: "application/json",
    });

    const consoleLog: string[] = ((page as any)?.__consoleLog) || [];
    await testInfo.attach("browser-console.log", {
      body: consoleLog.join("\n") || "(no console output)",
      contentType: "text/plain",
    });

    await page
      ?.screenshot({ fullPage: true })
      .then((buf) => testInfo.attach("page.png", { body: buf, contentType: "image/png" }))
      .catch(() => {});

    // Always grab the live SEO directive files — useful regardless of which
    // spec failed (often the root cause shows up only when you compare
    // canonical URLs against what's actually listed in sitemap.xml).
    await testInfo.attach("sitemap.xml", {
      body: await safeFetch(`${BASE}/sitemap.xml`),
      contentType: "text/plain",
    });
    await testInfo.attach("robots.txt", {
      body: await safeFetch(`${BASE}/robots.txt`),
      contentType: "text/plain",
    });
  } catch {
    // best-effort — never fail the test in cleanup.
  }
}
