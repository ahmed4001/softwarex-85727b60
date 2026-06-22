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
 *   PRERENDER_LIMIT_PRODUCTS      default ALL
 *   PRERENDER_LIMIT_CATEGORIES    default ALL
 *   PRERENDER_LIMIT_BLOG          default ALL
 *   PRERENDER_LIMIT_GLOSSARY      default ALL
 *   PRERENDER_LIMIT_COMPARISONS   default ALL
 *   PRERENDER_LIMIT_ALTERNATIVES  default ALL
 *   PRERENDER_LIMIT_GUIDES        default ALL
 *   PRERENDER_LIMIT_DEALS         default ALL
 *   PRERENDER_LIMIT_PAGES         default ALL
 *   PRERENDER_LIMIT_LISTS         default ALL
 *   PRERENDER_LIMIT_STACKS        default ALL
 *   PRERENDER_LIMIT_DISCUSSIONS   default ALL
 *   PRERENDER_LIMIT_LANDING       default ALL
 *   PRERENDER_LIMIT_BEST          default ALL
 *   PRERENDER_LIMIT_PROFILES      default ALL
 *   PRERENDER_CONCURRENCY         default 3
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
  "/activity",
  "/alternatives",
  "/awards",
  "/blog",
  "/categories",
  "/choose-plan",
  "/pricing",
  "/compare-pricing",
  "/compare",
  "/deals",
  "/discussions",
  "/guides",
  "/glossary",
  "/leaderboard",
  "/login",
  "/lists",
  "/lists/new",
  "/partners",
  "/search",
  "/stacks",
  "/submit-product",
  // Legacy/static aliases kept for already-linked URLs.
  "/buyer-guides",
  "/submit",
  "/tech-stacks",
];

const CONCURRENCY = Math.max(1, Number(process.env.PRERENDER_CONCURRENCY) || 3);
const PAGE_SIZE = 1000; // Supabase REST default max

function cap(envKey: string): number {
  const v = Number(process.env[envKey]);
  return Number.isFinite(v) && v > 0 ? v : Infinity;
}

async function fetchRows(
  table: string,
  select: string,
  filter = "",
  order = "",
  limit = Infinity,
): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  while (all.length < limit) {
    const take = Math.min(PAGE_SIZE, limit - all.length);
    const to = from + take - 1;
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}${order}`;
    try {
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${from}-${to}`,
          "Range-Unit": "items",
        },
      });
      if (!res.ok) {
        console.warn(`[prerender] ${table} -> ${res.status}`);
        break;
      }
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < take) break;
      from += batch.length;
    } catch (e) {
      console.warn(`[prerender] ${table} failed`, (e as Error).message);
      break;
    }
  }
  return all;
}

const toRoutes = (rows: any[], prefix: string): string[] =>
  (rows || []).filter((r) => r?.slug).map((r) => `${prefix}/${r.slug}`);

const landingRoutes = (rows: any[]): string[] =>
  (rows || [])
    .filter((r) => r?.slug)
    .map((r) => {
      switch (r.page_type) {
        case "feature":
          return `/features/${r.slug}`;
        case "use_case":
          return `/use-cases/${r.slug}`;
        case "industry":
          return `/industry/${r.slug}`;
        case "template":
          return `/templates/${r.slug}`;
        default:
          return `/${r.slug}`;
      }
    });

async function collectRoutes(): Promise<string[]> {
  const [products, categories, posts, comparisons, guides, glossary, deals, pages, lists, stacks, discussions, landing, bestLanding, profiles] =
    await Promise.all([
      fetchRows("products", "slug", "&is_active=eq.true", "&order=info_score.desc.nullslast,avg_rating.desc.nullslast", cap("PRERENDER_LIMIT_PRODUCTS")),
      fetchRows("categories", "slug", "&is_active=eq.true", "&order=product_count.desc.nullslast", cap("PRERENDER_LIMIT_CATEGORIES")),
      fetchRows("blog_posts", "slug", "&status=eq.published", "&order=updated_at.desc.nullslast", cap("PRERENDER_LIMIT_BLOG")),
      fetchRows("comparisons", "slug", "&is_published=eq.true&slug=not.is.null", "&order=view_count.desc.nullslast", cap("PRERENDER_LIMIT_COMPARISONS")),
      fetchRows("buyer_guides", "slug", "&is_published=eq.true", "&order=updated_at.desc", cap("PRERENDER_LIMIT_GUIDES")),
      fetchRows("glossary_terms", "slug", "", "&order=updated_at.desc", cap("PRERENDER_LIMIT_GLOSSARY")),
      fetchRows("deals", "slug", "&is_visible=eq.true&review_status=eq.approved", "&order=updated_at.desc", cap("PRERENDER_LIMIT_DEALS")),
      fetchRows("pages", "slug", "&is_active=eq.true", "&order=updated_at.desc.nullslast", cap("PRERENDER_LIMIT_PAGES")),
      fetchRows("lists", "slug", "&is_published=eq.true", "&order=updated_at.desc", cap("PRERENDER_LIMIT_LISTS")),
      fetchRows("tech_stacks", "slug", "&is_published=eq.true", "&order=updated_at.desc", cap("PRERENDER_LIMIT_STACKS")),
      fetchRows("discussions", "slug", "&slug=not.is.null", "&order=updated_at.desc", cap("PRERENDER_LIMIT_DISCUSSIONS")),
      fetchRows("keyword_landing_pages", "slug,page_type", "&is_published=eq.true&status=eq.published", "&order=updated_at.desc", cap("PRERENDER_LIMIT_LANDING")),
      fetchRows("seo_landing_pages", "slug", "&is_published=eq.true", "&order=updated_at.desc", cap("PRERENDER_LIMIT_BEST")),
      fetchRows("profiles", "username", "&username=not.is.null", "&order=review_count.desc.nullslast", cap("PRERENDER_LIMIT_PROFILES")),
    ]);

  // Alternatives are generated from product slugs per app routing (/alternatives/:slug)
  const altLimit = cap("PRERENDER_LIMIT_ALTERNATIVES");
  const alternatives = Number.isFinite(altLimit)
    ? products.slice(0, altLimit)
    : products;

  const dynamic = [
    ...toRoutes(products, "/product"),
    ...toRoutes(categories, "/category"),
    ...toRoutes(posts, "/blog"),
    ...toRoutes(comparisons, "/compare"),
    ...toRoutes(guides, "/guides"),
    ...toRoutes(glossary, "/glossary"),
    ...toRoutes(deals, "/deals"),
    ...toRoutes(alternatives, "/alternatives"),
    ...toRoutes(pages, "/page"),
    ...toRoutes(lists, "/lists"),
    ...toRoutes(stacks, "/stacks"),
    ...toRoutes(discussions, "/discussions"),
    ...landingRoutes(landing),
    ...toRoutes(bestLanding, "/best"),
    ...profiles.filter((p) => p?.username).flatMap((p) => [`/author/${p.username}`, `/user/${p.username}`]),
  ];

  console.log(
    `[prerender] slugs: products=${products.length} categories=${categories.length} blog=${posts.length} compare=${comparisons.length} guides=${guides.length} glossary=${glossary.length} deals=${deals.length} alternatives=${alternatives.length} pages=${pages.length} lists=${lists.length} stacks=${stacks.length} discussions=${discussions.length} landing=${landing.length} best=${bestLanding.length} profiles=${profiles.length}`,
  );

  return Array.from(new Set([...STATIC_ROUTES, ...dynamic]));
}

interface RouteReport {
  route: string;
  ok: boolean;
  status?: number;
  title?: string;
  titleLen?: number;
  descLen?: number;
  canonical?: string;
  jsonLdCount?: number;
  corrections?: string[];
  error?: string;
}

async function snapshot(
  browser: Browser,
  distDir: string,
  route: string,
): Promise<RouteReport> {
  const page = await browser.newPage();
  const report: RouteReport = { route, ok: false, corrections: [] };
  try {
    const resp = await page.goto(`${BASE}${route}`, {
      waitUntil: "networkidle",
      timeout: NAV_TIMEOUT,
    });
    report.status = resp?.status();
    await page.waitForTimeout(SETTLE_MS);

    const meta = await page.evaluate(() => {
      const t = document.title || "";
      const d = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
      const c = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
      const j = document.querySelectorAll('script[type="application/ld+json"]').length;
      return { t, d, c, j };
    });
    report.title = meta.t;
    report.titleLen = meta.t.length;
    report.descLen = meta.d.length;
    report.canonical = meta.c;
    report.jsonLdCount = meta.j;

    // SEO field corrections (warn-level signals)
    if (!meta.t) report.corrections!.push("missing-title");
    if (meta.t.length > 70) report.corrections!.push(`title-too-long(${meta.t.length})`);
    if (!meta.d) report.corrections!.push("missing-description");
    if (meta.d.length > 160) report.corrections!.push(`desc-too-long(${meta.d.length})`);
    if (!meta.c) report.corrections!.push("missing-canonical");
    else if (!meta.c.startsWith("https://reviewhunts.com")) {
      report.corrections!.push(`canonical-host(${meta.c})`);
    }
    if (meta.j === 0) report.corrections!.push("no-json-ld");

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
    report.ok = true;
    return report;
  } catch (err) {
    report.error = (err as Error).message;
    console.warn(`[prerender] ✗ ${route}: ${report.error}`);
    return report;
  } finally {
    await page.close().catch(() => {});
  }
}

async function runPool(
  browser: Browser,
  distDir: string,
  routes: string[],
): Promise<{ ok: number; fail: number; reports: RouteReport[] }> {
  let i = 0;
  let ok = 0;
  let fail = 0;
  const reports: RouteReport[] = [];
  const total = routes.length;

  const worker = async () => {
    while (true) {
      const idx = i++;
      if (idx >= total) return;
      const route = routes[idx];
      const r = await snapshot(browser, distDir, route);
      reports.push(r);
      if (r.ok) {
        ok++;
        const flag = r.corrections && r.corrections.length ? ` ⚠ ${r.corrections.join(",")}` : "";
        console.log(`[prerender] ✓ ${route} [${r.status}] title=${r.titleLen} desc=${r.descLen} ld=${r.jsonLdCount}${flag}`);
      } else {
        fail++;
      }
      const done = ok + fail;
      if (done % 25 === 0 || done === total) {
        console.log(`[prerender] ${done}/${total} done, ${fail} failed`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { ok, fail, reports };
}

async function main() {
  const distDir = path.resolve("dist");
  if (!existsSync(distDir)) {
    console.error("[prerender] dist/ not found — run `vite build` first.");
    process.exit(1);
  }

  const routes = await collectRoutes();
  console.log(
    `[prerender] ${routes.length} routes total (concurrency=${CONCURRENCY})`,
  );

  let server: PreviewServer | undefined;
  let browser: Browser | undefined;
  try {
    server = await preview({
      preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
    });
    console.log(`[prerender] preview server ready at ${BASE}`);

    browser = await chromium.launch();
    const { ok, fail, reports } = await runPool(browser, distDir, routes);

    // Persist a build-time manifest of prerendered routes + SEO field signals.
    const manifestPath = path.join(distDir, "prerender-manifest.json");
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: routes.length,
          ok,
          fail,
          reports: reports.sort((a, b) => a.route.localeCompare(b.route)),
        },
        null,
        2,
      ),
      "utf8",
    );

    const flagged = reports.filter((r) => r.ok && r.corrections && r.corrections.length);
    console.log(
      `[prerender] done: ${ok} ok, ${fail} failed (of ${routes.length}); ${flagged.length} routes with SEO warnings`,
    );
    if (flagged.length > 0) {
      console.log(`[prerender] SEO warnings sample:`);
      for (const r of flagged.slice(0, 20)) {
        console.log(`  - ${r.route}: ${r.corrections!.join(", ")}`);
      }
    }
    console.log(`[prerender] manifest: ${manifestPath}`);
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
