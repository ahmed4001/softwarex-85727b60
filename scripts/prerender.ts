/**
 * Build-time prerender for high-value marketing routes.
 *
 * How it works:
 *   1. `vite build` produces dist/ with an SPA shell (dist/index.html).
 *   2. This script boots `vite preview` against dist/.
 *   3. Playwright (Chromium) loads each route, waits for the React app to
 *      render + data to settle, then snapshots `document.documentElement.outerHTML`.
 *   4. Each snapshot is written to `dist/<route>/index.html`.
 *   5. Vercel serves the static HTML first (rewrites only fire if no file
 *      matches), so crawlers + first-paint get fully-rendered HTML.
 *
 * Dynamic detail pages (/products/:slug, /blog/:slug, ...) are intentionally
 * NOT prerendered here — there are too many and they're DB-driven. They
 * still render client-side and rely on react-helmet-async for meta tags.
 * To prerender them too, extend ROUTES with a list pulled from the sitemap.
 *
 * Run with: `npm run build:prerender`
 * Requires Playwright Chromium: `npx playwright install --with-deps chromium`
 */

import { chromium, type Browser } from "playwright";
import { preview, type PreviewServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROUTES: string[] = [
  "/",
  "/pricing",
  "/compare",
  "/deals",
  "/blog",
  "/categories",
  "/glossary",
  "/buyer-guides",
  "/alternatives",
  "/lists",
  "/tech-stacks",
  "/discussions",
  "/leaderboard",
  "/awards",
  "/partners",
  "/submit",
  "/awards",
  "/activity",
];

const UNIQUE_ROUTES = Array.from(new Set(ROUTES));
const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}`;
const NAV_TIMEOUT = 30_000;
const SETTLE_MS = 800;

async function snapshot(browser: Browser, distDir: string, route: string) {
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}${route}`, {
      waitUntil: "networkidle",
      timeout: NAV_TIMEOUT,
    });
    // Give react-helmet-async a tick to flush head mutations and any
    // post-mount Supabase queries to render their first state.
    await page.waitForTimeout(SETTLE_MS);

    // Strip the Vite preview's injected dev banner if any, plus
    // <script type="module"> reload hooks (none in preview mode, but defensive).
    const html = await page.evaluate(() => {
      // Mark the document as prerendered so the client knows to hydrate.
      document.documentElement.setAttribute("data-prerendered", "true");
      return "<!doctype html>\n" + document.documentElement.outerHTML;
    });

    const outPath =
      route === "/"
        ? path.join(distDir, "index.html")
        : path.join(distDir, route.replace(/^\//, ""), "index.html");
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf8");
    console.log(`[prerender] ✓ ${route.padEnd(20)} -> ${path.relative(distDir, outPath)}`);
    return true;
  } catch (err) {
    console.warn(`[prerender] ✗ ${route}: ${(err as Error).message}`);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  const distDir = path.resolve("dist");
  if (!existsSync(distDir)) {
    console.error("[prerender] dist/ not found — run `vite build` first.");
    process.exit(1);
  }

  let server: PreviewServer | undefined;
  let browser: Browser | undefined;
  try {
    server = await preview({
      preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
    });
    console.log(`[prerender] preview server ready at ${BASE}`);

    browser = await chromium.launch();
    let ok = 0;
    let fail = 0;
    for (const route of UNIQUE_ROUTES) {
      const success = await snapshot(browser, distDir, route);
      success ? ok++ : fail++;
    }
    console.log(`[prerender] done: ${ok} ok, ${fail} failed (of ${UNIQUE_ROUTES.length})`);
    if (fail > 0 && process.env.PRERENDER_STRICT === "1") {
      process.exit(1);
    }
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => {
      if (!server?.httpServer) return resolve();
      server.httpServer.close(() => resolve());
    });
  }
}

main().catch((err) => {
  console.error("[prerender] fatal:", err);
  process.exit(1);
});
