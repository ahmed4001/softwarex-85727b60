import { test, expect, request } from "@playwright/test";

// Fetch sitemap.xml and robots.txt directly from STAGING_BASE_URL and
// assert SEO directives + allowed/disallowed paths. These run as raw
// HTTP requests (no browser) so we see exactly what crawlers see.

const BASE =
  process.env.STAGING_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://id-preview--8f8ab8bf-14f5-4085-9849-266b90f727c8.lovable.app";

const EXPECTED_DISALLOW = ["/admin/", "/vendor/", "/login", "/dashboard"];
const EXPECTED_ALLOWED = ["/", "/products", "/blog", "/categories"];

test.describe("robots.txt", () => {
  test("serves a valid robots.txt with expected directives", async () => {
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    const res = await ctx.get(`${BASE}/robots.txt`);
    expect(res.status(), "robots.txt should 200").toBe(200);
    const ct = res.headers()["content-type"] || "";
    expect(ct).toMatch(/text\/plain/i);

    const body = await res.text();
    expect(body).toMatch(/User-agent:\s*\*/i);
    expect(body).toMatch(/Allow:\s*\//i);

    for (const path of EXPECTED_DISALLOW) {
      expect(body, `should disallow ${path}`).toMatch(
        new RegExp(`Disallow:\\s*${path.replace(/[/]/g, "\\/")}`, "i"),
      );
    }

    // Global block (`Disallow: /` on User-agent: *) would deindex the site.
    const wildcardBlock = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*(\n|$)/i;
    const globallyBlocked =
      wildcardBlock.test(body) &&
      !/User-agent:\s*\*[\s\S]*?Allow:\s*\//i.test(body);
    expect(globallyBlocked, "site must not be globally blocked").toBe(false);

    // Sitemap directive should be present and absolute.
    const sitemapLine = body.match(/Sitemap:\s*(\S+)/i);
    expect(sitemapLine, "Sitemap: directive present").not.toBeNull();
    expect(sitemapLine![1]).toMatch(/^https?:\/\//);
  });
});

test.describe("sitemap.xml", () => {
  test("serves a valid sitemap.xml with expected URLs", async () => {
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    const res = await ctx.get(`${BASE}/sitemap.xml`);
    expect(res.status(), "sitemap.xml should 200").toBe(200);
    const ct = res.headers()["content-type"] || "";
    expect(ct).toMatch(/xml/i);

    const body = await res.text();
    expect(body).toMatch(/<\?xml/);
    expect(body).toMatch(/<urlset[\s>]|<sitemapindex[\s>]/);

    // Extract all <loc> values.
    const locs = Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g)).map(
      (m) => m[1].trim(),
    );
    expect(locs.length, "sitemap must contain at least one <loc>").toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc, `${loc} should be absolute`).toMatch(/^https?:\/\//);
    }

    // None of the disallowed paths should appear in the sitemap.
    for (const blocked of EXPECTED_DISALLOW) {
      const hit = locs.find((l) => new URL(l).pathname.startsWith(blocked));
      expect(hit, `sitemap must not include disallowed path ${blocked}`).toBeUndefined();
    }

    // At least one of the canonical public paths should be present.
    const paths = locs.map((l) => new URL(l).pathname);
    const hasAllowed = EXPECTED_ALLOWED.some((p) =>
      paths.some((sp) => sp === p || sp.startsWith(p === "/" ? "/" : p + "/")),
    );
    expect(hasAllowed, "sitemap should include core public routes").toBe(true);
  });
});
