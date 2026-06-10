// SEO regression: static SEO assets that ship with the build.
// Runs in node env via vitest; reads files from repo root.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("SEO: index.html", () => {
  const html = read("index.html");

  it("has a non-default <title>", () => {
    const m = html.match(/<title>([^<]+)<\/title>/);
    expect(m, "title tag present").toBeTruthy();
    const title = m![1].trim();
    expect(title.length).toBeGreaterThan(10);
    expect(title.length).toBeLessThan(70);
    expect(title.toLowerCase()).not.toBe("lovable app");
    expect(title.toLowerCase()).not.toContain("lovable generated");
  });

  it("has a meta description of reasonable length", () => {
    const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    expect(m, "meta description present").toBeTruthy();
    const desc = m![1];
    expect(desc.length).toBeGreaterThan(30);
    expect(desc.length).toBeLessThan(170);
    expect(desc.toLowerCase()).not.toContain("lovable generated");
  });

  it("does NOT carry a static <link rel=canonical> (per-route Helmet owns it)", () => {
    // Helmet writes its own canonical per route; a static one would duplicate.
    expect(html).not.toMatch(/<link\s+rel=["']canonical["']/i);
  });

  it("has og:title, og:description, og:type, og:url", () => {
    for (const prop of ["og:title", "og:description", "og:type", "og:url"]) {
      const re = new RegExp(`<meta\\s+property=["']${prop}["']`, "i");
      expect(html, `${prop} present`).toMatch(re);
    }
  });

  it("ships sitewide Organization or WebSite JSON-LD", () => {
    const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    expect(scripts.length, "at least one JSON-LD block").toBeGreaterThan(0);
    const parsed = scripts.map((m) => {
      try { return JSON.parse(m[1].trim()); } catch { return null; }
    });
    expect(parsed.every(Boolean), "all JSON-LD blocks parse").toBe(true);
    const types = parsed.map((p: any) => p?.["@type"]);
    expect(types.some((t) => t === "Organization" || t === "WebSite")).toBe(true);
  });
});

describe("SEO: robots.txt", () => {
  const txt = read("public/robots.txt");

  it("allows crawlers by default", () => {
    expect(txt).toMatch(/User-agent:\s*\*/);
    expect(txt).toMatch(/Allow:\s*\//);
    expect(txt).not.toMatch(/^\s*Disallow:\s*\/\s*$/m); // never block whole site
  });

  it("disallows admin + vendor surfaces", () => {
    expect(txt).toMatch(/Disallow:\s*\/admin\/?/);
    expect(txt).toMatch(/Disallow:\s*\/vendor\/?/);
  });

  it("advertises a sitemap on the production domain", () => {
    const m = txt.match(/Sitemap:\s*(\S+)/i);
    expect(m, "Sitemap directive present").toBeTruthy();
    expect(m![1]).toMatch(/^https?:\/\/[^\s]+\/sitemap\.xml$/);
  });
});

describe("SEO: sitemap.xml", () => {
  it("exists and is a well-formed urlset", () => {
    expect(existsSync(resolve(root, "public/sitemap.xml"))).toBe(true);
    const xml = read("public/sitemap.xml");
    expect(xml).toMatch(/<\?xml\s+version=["']1\.0["']/);
    expect(xml).toMatch(/<urlset\s+xmlns=/);
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length, "has entries").toBeGreaterThan(0);
    // All locs must be absolute https URLs.
    for (const u of urls.slice(0, 50)) {
      expect(u).toMatch(/^https?:\/\//);
    }
  });

  it("includes core static routes", () => {
    const xml = read("public/sitemap.xml");
    for (const path of ["/", "/categories", "/blog", "/pricing", "/stacks"]) {
      const re = new RegExp(`<loc>https?://[^<]*${path.replace(/\//g, "\\/")}</loc>`);
      expect(xml, `sitemap includes ${path}`).toMatch(re);
    }
  });

  it("does not contain stale /tech-stacks route", () => {
    const xml = read("public/sitemap.xml");
    expect(xml).not.toMatch(/<loc>[^<]*\/tech-stacks<\/loc>/);
  });
});

describe("SEO: llms.txt", () => {
  it("exists with required H1 and at least one section", () => {
    const path = resolve(root, "public/llms.txt");
    expect(existsSync(path), "public/llms.txt present").toBe(true);
    const txt = readFileSync(path, "utf8");
    expect(txt).toMatch(/^#\s+\S/m); // H1
    expect(txt).toMatch(/^##\s+\S/m); // at least one H2 section
    expect(txt).toMatch(/^-\s+\[[^\]]+\]\(\/[^)]*\)/m); // link list entry
  });
});
