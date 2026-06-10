import { test, expect } from "./fixtures/deterministic";
import { request } from "@playwright/test";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";

test.afterEach(attachFailureArtifacts);

// Fetch sitemap.xml and robots.txt from STAGING_BASE_URL and assert
// the exact directives. These run as raw HTTP requests (no browser)
// so we see exactly what crawlers see.

const BASE =
  process.env.STAGING_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://id-preview--8f8ab8bf-14f5-4085-9849-266b90f727c8.lovable.app";

// EXACT expected wildcard Disallow set. Keep in lock-step with
// public/robots.txt. Adding/removing a path here forces the author to
// update robots.txt too — preventing accidental indexing drift.
const EXPECTED_WILDCARD_DISALLOW = [
  "/admin/",
  "/vendor/",
  "/login",
  "/dashboard",
] as const;

// Path prefixes that MUST NOT appear in sitemap.xml under any
// circumstances (private/admin surfaces).
const FORBIDDEN_SITEMAP_PREFIXES = [
  "/admin",
  "/vendor",
  "/login",
  "/dashboard",
  "/auth",
  "/checkout",
  "/settings",
];

// Public sections the sitemap is expected to cover.
const EXPECTED_PUBLIC_SECTIONS = ["/", "/products", "/blog", "/categories"];

function parseRobots(body: string) {
  const lines = body.split(/\r?\n/);
  const blocks: Array<{ agents: string[]; allow: string[]; disallow: string[] }> = [];
  let current: { agents: string[]; allow: string[]; disallow: string[] } | null = null;
  const sitemaps: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [k, ...rest] = line.split(":");
    const key = k.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.allow.length || current.disallow.length) {
        current = { agents: [], allow: [], disallow: [] };
        blocks.push(current);
      }
      current.agents.push(value);
    } else if (key === "allow" && current) {
      current.allow.push(value);
    } else if (key === "disallow" && current) {
      current.disallow.push(value);
    } else if (key === "sitemap") {
      sitemaps.push(value);
    }
  }
  return { blocks, sitemaps };
}

test.describe("robots.txt", () => {
  test("matches the exact expected directive set", async () => {
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    const res = await ctx.get(`${BASE}/robots.txt`);
    expect(res.status(), "robots.txt should 200").toBe(200);
    expect(res.headers()["content-type"] || "").toMatch(/text\/plain/i);

    const body = await res.text();
    const { blocks, sitemaps } = parseRobots(body);

    // ---- wildcard block ----
    const wildcard = blocks.find((b) => b.agents.includes("*"));
    expect(wildcard, "User-agent: * block present").toBeTruthy();

    expect(
      wildcard!.allow.some((p) => p === "/"),
      "wildcard block must Allow: /",
    ).toBe(true);

    // Never a global block on *.
    expect(
      wildcard!.disallow.includes("/"),
      "site must not be globally blocked",
    ).toBe(false);

    // Exact match — sort both sides for stable comparison.
    expect(
      [...wildcard!.disallow].sort(),
      "wildcard Disallow set must match exactly",
    ).toEqual([...EXPECTED_WILDCARD_DISALLOW].sort());

    // ---- sitemap directive ----
    expect(sitemaps.length, "exactly one Sitemap: directive").toBe(1);
    expect(sitemaps[0]).toMatch(/^https?:\/\//);
    expect(sitemaps[0]).toMatch(/sitemap\.xml$/);
  });
});

test.describe("sitemap.xml", () => {
  test("contains only allowed public URLs", async () => {
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    const res = await ctx.get(`${BASE}/sitemap.xml`);
    expect(res.status(), "sitemap.xml should 200").toBe(200);
    expect(res.headers()["content-type"] || "").toMatch(/xml/i);

    const body = await res.text();
    expect(body).toMatch(/<\?xml/);
    expect(body).toMatch(/<urlset[\s>]|<sitemapindex[\s>]/);

    const locs = Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g)).map(
      (m) => m[1].trim(),
    );
    expect(locs.length, "sitemap must contain at least one <loc>").toBeGreaterThan(0);

    // Every loc is an absolute URL with no whitespace and exactly once.
    const seen = new Set<string>();
    for (const loc of locs) {
      expect(loc).toMatch(/^https?:\/\/\S+$/);
      expect(seen.has(loc), `duplicate <loc> for ${loc}`).toBe(false);
      seen.add(loc);
    }

    // No disallowed/private path is ever indexed.
    const paths = locs.map((l) => new URL(l).pathname);
    const leaked = paths.filter((p) =>
      FORBIDDEN_SITEMAP_PREFIXES.some(
        (pref) => p === pref || p.startsWith(pref + "/") || p.startsWith(pref) && p.length > pref.length && !/^[a-z0-9]/i.test(p[pref.length]),
      ),
    );
    expect(leaked, `forbidden paths in sitemap: ${leaked.join(", ")}`).toEqual([]);

    // Also assert exact wildcard-Disallow prefixes are absent.
    for (const blocked of EXPECTED_WILDCARD_DISALLOW) {
      const hit = paths.find((p) => p === blocked.replace(/\/$/, "") || p.startsWith(blocked));
      expect(hit, `sitemap leaks disallowed path ${blocked}`).toBeUndefined();
    }

    // At least one of every expected public section should be present.
    for (const section of EXPECTED_PUBLIC_SECTIONS) {
      const hasIt = paths.some(
        (p) => p === section || (section !== "/" && p.startsWith(section + "/")),
      );
      // "/" must exist explicitly.
      if (section === "/") {
        expect(paths, `sitemap missing root URL`).toContain("/");
      } else {
        expect(hasIt, `sitemap missing ${section}*`).toBe(true);
      }
    }
  });
});
