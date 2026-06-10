import { test, expect } from "./fixtures/deterministic";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";
import { request } from "@playwright/test";

// Verify every <loc> in the staging sitemap.xml is actually reachable
// and that any redirect target equals the page's own canonical. A 404
// or a sneaky redirect to /not-found is a silent indexing leak.

test.afterEach(attachFailureArtifacts);

const BASE =
  process.env.STAGING_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://id-preview--8f8ab8bf-14f5-4085-9849-266b90f727c8.lovable.app";

// Cap how many URLs we probe per CI run so the gate stays fast.
const MAX_URLS = Number(process.env.SITEMAP_PROBE_MAX || 75);
const CONCURRENCY = 8;
const TIMEOUT_MS = 15_000;

async function loadSitemapLocs(): Promise<string[]> {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  const res = await ctx.get(`${BASE}/sitemap.xml`);
  expect(res.status(), "sitemap.xml should 200").toBe(200);
  const body = await res.text();
  return Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
}

interface ProbeResult {
  url: string;
  status: number;
  finalUrl: string;
  redirected: boolean;
  error?: string;
}

async function probe(url: string): Promise<ProbeResult> {
  const ctx = await request.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { "user-agent": "Mozilla/5.0 (compatible; SEO-Merge-Gate/1.0)" },
  });
  try {
    const res = await ctx.get(url, { timeout: TIMEOUT_MS, maxRedirects: 5 });
    const finalUrl = res.url();
    return {
      url,
      status: res.status(),
      finalUrl,
      redirected: finalUrl !== url,
    };
  } catch (e) {
    return { url, status: 0, finalUrl: url, redirected: false, error: String(e) };
  }
}

async function readCanonicalFor(url: string): Promise<string | null> {
  // Use a fresh browser context so client-rendered Helmet canonicals work.
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(400);
    return page.evaluate(
      () =>
        document.head
          .querySelector('link[rel="canonical"]')
          ?.getAttribute("href") || null,
    );
  } finally {
    await browser.close();
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

test("every sitemap URL returns 200", async () => {
  test.setTimeout(180_000);
  const all = await loadSitemapLocs();
  expect(all.length, "sitemap must contain at least one <loc>").toBeGreaterThan(0);
  const sample = all.slice(0, MAX_URLS);

  const results = await mapWithConcurrency(sample, CONCURRENCY, probe);
  const broken = results.filter((r) => r.status < 200 || r.status >= 400);
  expect(
    broken,
    `sitemap URLs returning non-2xx/3xx:\n${JSON.stringify(broken, null, 2)}`,
  ).toEqual([]);
});

test("redirected sitemap URLs land on a page whose canonical equals the redirect target", async () => {
  test.setTimeout(240_000);
  const all = await loadSitemapLocs();
  const sample = all.slice(0, MAX_URLS);

  const probes = await mapWithConcurrency(sample, CONCURRENCY, probe);
  const redirected = probes.filter(
    (r) => r.redirected && r.status >= 200 && r.status < 400,
  );

  const mismatches: Array<{ source: string; finalUrl: string; canonical: string | null }> = [];
  // Resolve canonicals sequentially — each spins a browser; keep it slow but reliable.
  for (const r of redirected) {
    const canonical = await readCanonicalFor(r.finalUrl).catch(() => null);
    if (!canonical) {
      mismatches.push({ source: r.url, finalUrl: r.finalUrl, canonical: null });
      continue;
    }
    // Normalise: strip trailing slash for comparison.
    const norm = (u: string) => u.replace(/\/$/, "");
    if (norm(canonical) !== norm(r.finalUrl)) {
      mismatches.push({ source: r.url, finalUrl: r.finalUrl, canonical });
    }
  }

  expect(
    mismatches,
    `sitemap entries whose redirect target's canonical mismatches:\n${JSON.stringify(mismatches, null, 2)}`,
  ).toEqual([]);
});
