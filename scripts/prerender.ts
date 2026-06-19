/**
 * Build-time prerender for high-value marketing routes + all DB-driven detail pages.
 *
 * How it works:
 *   1. `vite build` produces dist/ with an SPA shell.
 *   2. This script boots `vite preview` against dist/.
 *   3. Slugs are pulled from Supabase REST (same source as generate-sitemap.ts).
 *   4. A worker pool of Playwright pages snapshots each route concurrently and
 *      writes `dist/<route>/index.html`.
 *   5. Vercel serves the static HTML before falling back to the SPA rewrite,
 *      so crawlers + first-paint get fully-rendered HTML.
 *
 * Env knobs (all optional):
 *   PRERENDER_LIMIT_PRODUCTS      default 500
 *   PRERENDER_LIMIT_CATEGORIES    default 200
 *   PRERENDER_LIMIT_BLOG          default 500
 *   PRERENDER_LIMIT_GLOSSARY      default 500
 *   PRERENDER_LIMIT_COMPARISONS   default 500
 *   PRERENDER_LIMIT_ALTERNATIVES  default 500
 *   PRERENDER_LIMIT_GUIDES        default 500
 *   PRERENDER_CONCURRENCY         default 6
 *   PRERENDER_ALL=1               ignore all caps
 *   PRERENDER_STRICT=1            non-zero exit on any failure
 *
 * Run with: `npm run build:prerender`
 * Requires Playwright Chromium: `npx playwright install --with-deps chromium`
 */

import { chromium, type Browser } from "playwright";
import { preview, type PreviewServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}`;
const NAV_TIMEOUT = 30_000;
const SETTLE_MS = 600;

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://ffeimjfunghzxgeqiwma.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg";

const STATIC_ROUTES: string[] = [
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
  "/activity",
];

const ALL = process.env.PRERENDER_ALL === "1";
const CONCURRENCY = Math.max(1, Number(process.env.PRERENDER_CONCURRENCY) || 6);

function cap(envKey: string, fallback: number): number {
  if (ALL) return 5000; // Supabase REST hard cap per request
  const v = Number(process.env[envKey]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

async function fetchRows(
  table: string,
  select: string,
  filter = "",
  order = "",
  limit = 5000,
): Promise<any[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}${order}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[prerender] ${table} -> ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.warn(`[prerender] ${table} failed`, (e as Error).message);
    return [];
  }
}

const toRoutes = (
  rows: any[],
  prefix: string,
  qualityKey?: string,
): string[] =>
  (rows || [])
    .filter(
      (r) =>
        r?.slug &&
        (!qualityKey ||
          (r[qualityKey] && String(r[qualityKey]).length > 40)),
    )
    .map((r) => `${prefix}/${r.slug}`);

async function collectRoutes(): Promise<string[]> {
  const [products, categories, posts, comparisons, alternatives, guides, glossary] =
    await Promise.all([
      fetchRows(
        "products",
        "slug,description",
        "&is_active=eq.true",
        "&order=avg_rating.desc.nullslast",
        cap("PRERENDER_LIMIT_PRODUCTS", 500),
      ),
      fetchRows(
        "categories",
        "slug,description",
        "&is_active=eq.true",
        "",
        cap("PRERENDER_LIMIT_CATEGORIES", 200),
      ),
      fetchRows(
        "blog_posts",
        "slug",
        "&status=eq.published",
        "&order=updated_at.desc",
        cap("PRERENDER_LIMIT_BLOG", 500),
      ),
      fetchRows(
        "comparisons",
        "slug",
        "&is_published=eq.true",
        "",
        cap("PRERENDER_LIMIT_COMPARISONS", 500),
      ),
      fetchRows(
        "alternative_pages",
        "slug",
        "",
        "",
        cap("PRERENDER_LIMIT_ALTERNATIVES", 500),
      ),
      fetchRows(
        "buyer_guides",
        "slug",
        "",
        "",
        cap("PRERENDER_LIMIT_GUIDES", 500),
      ),
      fetchRows(
        "glossary_terms",
        "slug,definition",
        "",
        "&order=updated_at.desc",
        cap("PRERENDER_LIMIT_GLOSSARY", 500),
      ),
    ]);

  const dynamic = [
    ...toRoutes(products, "/product", "description"),
    ...toRoutes(categories, "/category", "description"),
    ...toRoutes(posts, "/blog"),
    ...toRoutes(comparisons, "/compare"),
    ...toRoutes(alternatives, "/alternatives"),
    ...toRoutes(guides, "/guides"),
    ...toRoutes(glossary, "/glossary", "definition"),
  ];

  console.log(
    `[prerender] slugs: products=${products.length} categories=${categories.length} blog=${posts.length} compare=${comparisons.length} alt=${alternatives.length} guides=${guides.length} glossary=${glossary.length}`,
  );

  return Array.from(new Set([...STATIC_ROUTES, ...dynamic]));
}

async function snapshot(
  browser: Browser,
  distDir: string,
  route: string,
): Promise<boolean> {
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}${route}`, {
      waitUntil: "networkidle",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(SETTLE_MS);

    const html = await page.evaluate(() => {
      document.documentElement.setAttribute("data-prerendered", "true");
      return "<!doctype html>\n" + document.documentElement.outerHTML;
    });

    const outPath =
      route === "/"
        ? path.join(distDir, "index.html")
        : path.join(distDir, route.replace(/^\//, ""), "index.html");
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf8");
    return true;
  } catch (err) {
    console.warn(`[prerender] ✗ ${route}: ${(err as Error).message}`);
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}

async function runPool(
  browser: Browser,
  distDir: string,
  routes: string[],
): Promise<{ ok: number; fail: number }> {
  let i = 0;
  let ok = 0;
  let fail = 0;
  const total = routes.length;

  const worker = async () => {
    while (true) {
      const idx = i++;
      if (idx >= total) return;
      const route = routes[idx];
      const success = await snapshot(browser, distDir, route);
      success ? ok++ : fail++;
      const done = ok + fail;
      if (done % 25 === 0 || done === total) {
        console.log(`[prerender] ${done}/${total} done, ${fail} failed`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { ok, fail };
}

async function main() {
  const distDir = path.resolve("dist");
  if (!existsSync(distDir)) {
    console.error("[prerender] dist/ not found — run `vite build` first.");
    process.exit(1);
  }

  const routes = await collectRoutes();
  console.log(
    `[prerender] ${routes.length} routes total (concurrency=${CONCURRENCY}${ALL ? ", ALL=1" : ""})`,
  );

  let server: PreviewServer | undefined;
  let browser: Browser | undefined;
  try {
    server = await preview({
      preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
    });
    console.log(`[prerender] preview server ready at ${BASE}`);

    browser = await chromium.launch();
    const { ok, fail } = await runPool(browser, distDir, routes);
    console.log(
      `[prerender] done: ${ok} ok, ${fail} failed (of ${routes.length})`,
    );
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
