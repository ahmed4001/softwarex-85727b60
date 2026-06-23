/**
 * Unit tests for the SEO host gate helpers.
 *
 * These cover the pure extraction + allowlist + finalizeGate logic
 * that every gate script depends on. Pin parsing behavior so JSON-LD,
 * og/twitter, manifest, sitemap, and hreflang scanning stays correct
 * over time.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  expectedHostFromSiteUrl,
  hostOf,
  isAllowedHost,
  loadAllowlist,
  extractMetaContent,
  extractCanonicalHrefs,
  extractHreflangLinks,
  extractJsonLdBlocks,
  walkJsonLdUrls,
  extractSitemapLocs,
  extractSitemapIndexLocs,
  parseRobotsSitemapLines,
  finalizeGate,
  emitAnnotation,
  type Violation,
} from "./seo-hosts";

describe("expectedHostFromSiteUrl", () => {
  it("lowercases and strips path/port", () => {
    expect(expectedHostFromSiteUrl("https://Example.COM/foo")).toBe("example.com");
    expect(expectedHostFromSiteUrl("https://example.com:8080/")).toBe("example.com");
  });
});

describe("hostOf", () => {
  it("returns lowercased host for absolute URLs", () => {
    expect(hostOf("https://EXAMPLE.com/a")).toBe("example.com");
  });
  it("resolves relative paths against base", () => {
    expect(hostOf("/a/b", "https://example.com")).toBe("example.com");
  });
  it("returns null for garbage", () => {
    expect(hostOf("not a url", undefined)).toBe(null);
  });
});

describe("isAllowedHost", () => {
  it("matches expected host", () => {
    expect(isAllowedHost("example.com", "example.com", new Set())).toBe(true);
  });
  it("matches explicit allowlist entry", () => {
    expect(isAllowedHost("cdn.foo.com", "example.com", new Set(["cdn.foo.com"]))).toBe(true);
  });
  it("supports wildcard prefix", () => {
    const allow = new Set(["*.foo.com"]);
    expect(isAllowedHost("cdn.foo.com", "example.com", allow)).toBe(true);
    expect(isAllowedHost("a.b.foo.com", "example.com", allow)).toBe(true);
    expect(isAllowedHost("foo.com", "example.com", allow)).toBe(false); // bare suffix excluded
    expect(isAllowedHost("notfoo.com", "example.com", allow)).toBe(false);
  });
});

describe("loadAllowlist", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "seo-allow-"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("reads gate + _default entries from the file", () => {
    writeFileSync(join(tmp, "seo-host-allowlist.json"), JSON.stringify({
      _default: ["global.example.com"],
      "social-image-hosts": ["cdn.example.com"],
    }));
    const set = loadAllowlist("social-image-hosts", {}, tmp);
    expect(set.has("cdn.example.com")).toBe(true);
    expect(set.has("global.example.com")).toBe(true);
    expect(set.has("nope.example.com")).toBe(false);
  });

  it("merges env override SEO_ALLOWED_HOSTS_<GATE>", () => {
    const set = loadAllowlist("social-image-hosts", { SEO_ALLOWED_HOSTS_SOCIAL_IMAGE_HOSTS: "img.a.com, img.b.com" }, tmp);
    expect(set.has("img.a.com")).toBe(true);
    expect(set.has("img.b.com")).toBe(true);
  });

  it("merges global env SEO_ALLOWED_HOSTS", () => {
    const set = loadAllowlist("jsonld-hosts", { SEO_ALLOWED_HOSTS: "everywhere.com" }, tmp);
    expect(set.has("everywhere.com")).toBe(true);
  });

  it("returns empty set when file missing and no env", () => {
    expect(loadAllowlist("anything", {}, tmp).size).toBe(0);
  });
});

describe("extractMetaContent", () => {
  it("extracts og:url regardless of attribute order", () => {
    const html = `
      <meta property="og:url" content="https://a.com/x">
      <meta content="https://b.com/y" property="og:url" />
    `;
    expect(extractMetaContent(html, "property", "og:url")).toEqual(["https://a.com/x", "https://b.com/y"]);
  });

  it("extracts twitter:image:src (name attr, colons in value)", () => {
    const html = `<meta name="twitter:image:src" content="https://cdn.example.com/img.png">`;
    expect(extractMetaContent(html, "name", "twitter:image:src")).toEqual(["https://cdn.example.com/img.png"]);
  });

  it("returns empty when tag absent", () => {
    expect(extractMetaContent("<meta name='other' content='x'>", "property", "og:url")).toEqual([]);
  });
});

describe("extractCanonicalHrefs", () => {
  it("matches rel before or after href", () => {
    const html = `
      <link rel="canonical" href="https://a.com/1">
      <link href="https://b.com/2" rel="canonical">
    `;
    expect(extractCanonicalHrefs(html).sort()).toEqual(["https://a.com/1", "https://b.com/2"]);
  });
});

describe("extractHreflangLinks", () => {
  it("captures hreflang + href, ignores non-hreflang alternates", () => {
    const html = `
      <link rel="alternate" hreflang="en" href="https://a.com/en">
      <link rel="alternate" hreflang="x-default" href="https://a.com/">
      <link rel="alternate" type="application/rss+xml" href="/rss.xml">
    `;
    const out = extractHreflangLinks(html);
    expect(out).toEqual([
      { hreflang: "en", href: "https://a.com/en" },
      { hreflang: "x-default", href: "https://a.com/" },
    ]);
  });
});

describe("extractJsonLdBlocks + walkJsonLdUrls", () => {
  it("pulls every ld+json block and finds @id/url at any depth", () => {
    const html = `
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Product", "@id": "https://a.com/p/1", url: "https://a.com/p/1", sameAs: ["https://twitter.com/x"] },
          { "@type": "BreadcrumbList", itemListElement: [{ "@id": "https://b.com/x" }] },
        ],
        mainEntityOfPage: { "@id": "https://a.com/p/1" },
      })}</script>
    `;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(1);
    const parsed = JSON.parse(blocks[0]);
    const fields = new Set(["@id", "url", "mainEntityOfPage", "sameAs"]);
    const found = walkJsonLdUrls(parsed, fields);
    const values = found.map((f) => f.value);
    expect(values).toContain("https://a.com/p/1");
    expect(values).toContain("https://b.com/x");
    expect(values).toContain("https://twitter.com/x"); // sameAs surfaced for caller to decide
    // mainEntityOfPage object-form @id extraction
    expect(found.some((f) => f.field === "mainEntityOfPage" && f.value === "https://a.com/p/1")).toBe(true);
  });
});

describe("sitemap + robots extractors", () => {
  it("extractSitemapLocs handles urlset + sitemapindex uniformly", () => {
    const xml = `<urlset><url><loc>https://a.com/1</loc></url><url><loc>https://a.com/2</loc></url></urlset>`;
    expect(extractSitemapLocs(xml)).toEqual(["https://a.com/1", "https://a.com/2"]);
  });

  it("extractSitemapIndexLocs only takes <loc> inside <sitemap> blocks", () => {
    const xml = `
      <sitemapindex>
        <sitemap><loc>https://a.com/sitemap-1.xml</loc></sitemap>
        <sitemap><loc>https://a.com/sitemap-2.xml</loc></sitemap>
      </sitemapindex>
    `;
    expect(extractSitemapIndexLocs(xml)).toEqual([
      "https://a.com/sitemap-1.xml",
      "https://a.com/sitemap-2.xml",
    ]);
  });

  it("parseRobotsSitemapLines is case-insensitive and ignores comments", () => {
    const txt = `User-agent: *\nAllow: /\nSitemap: https://a.com/sitemap.xml\n# Sitemap: https://b.com/ignored.xml\nsitemap: https://a.com/sitemap-2.xml\n`;
    expect(parseRobotsSitemapLines(txt)).toEqual([
      "https://a.com/sitemap.xml",
      "https://a.com/sitemap-2.xml",
    ]);
  });
});

describe("finalizeGate", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "seo-finalize-"));
    mkdirSync(join(tmp, "reports"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const baseViolations = (): Violation[] => [
    { file: "a.html", tag: "og:url", url: "https://other.com/a", reason: "host other.com != example.com" },
    { file: "b.html", tag: "og:image", url: "https://cdn.allowed.com/img.png", reason: "host cdn.allowed.com != example.com" },
    { file: "c.html", tag: "canonical", url: "https://example.com/c", reason: "host example.com" },
  ];

  it("filters allowlisted hosts and exits 0 when nothing remains", () => {
    const res = finalizeGate({
      gate: "social-image-hosts",
      siteUrl: "https://example.com",
      expectedHost: "example.com",
      violations: [{ file: "b.html", tag: "og:image", url: "https://cdn.allowed.com/x", reason: "host cdn.allowed.com != example.com" }],
      env: { SEO_ALLOWED_HOSTS: "cdn.allowed.com" },
    });
    expect(res.kept).toHaveLength(0);
    expect(res.filteredOut).toHaveLength(1);
    expect(res.exitCode).toBe(0);
  });

  it("keeps real mismatches and exits 1", () => {
    const res = finalizeGate({
      gate: "social-url-hosts",
      siteUrl: "https://example.com",
      expectedHost: "example.com",
      violations: baseViolations(),
      env: { SEO_ALLOWED_HOSTS: "cdn.allowed.com" },
    });
    // a.html stays (other.com not allowed); b.html filtered out; c.html stays (host matches but caller already classified it as violation)
    expect(res.kept.map((v) => v.file).sort()).toEqual(["a.html", "c.html"]);
    expect(res.filteredOut.map((v) => v.file)).toEqual(["b.html"]);
    expect(res.exitCode).toBe(1);
  });

  it("writes per-gate JSON report when SEO_REPORT_DIR is set", () => {
    const reportDir = join(tmp, "reports");
    finalizeGate({
      gate: "hreflang-hosts",
      siteUrl: "https://example.com",
      expectedHost: "example.com",
      violations: [{ file: "a.html", tag: "alt", url: "https://other.com/x", reason: "host mismatch" }],
      workspacePrefix: "dist/",
      env: { SEO_REPORT_DIR: reportDir },
    });
    const report = JSON.parse(readFileSync(join(reportDir, "hreflang-hosts.json"), "utf8"));
    expect(report.gate).toBe("hreflang-hosts");
    expect(report.expected_host).toBe("example.com");
    expect(report.violations[0].workspacePath).toBe("dist/a.html");
    expect(report.raw_violation_count).toBe(1);
    expect(report.filtered_violation_count).toBe(1);
  });
});

describe("emitAnnotation", () => {
  it("emits a properly-encoded workflow-command line", () => {
    const logged: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => { logged.push(msg); };
    try {
      emitAnnotation("social-url-hosts", "example.com", {
        file: "product/foo/index.html",
        workspacePath: "dist/product/foo/index.html",
        tag: "og:url",
        url: "https://other.com/foo",
        reason: "host other.com != example.com",
        line: 3,
      });
    } finally {
      console.log = orig;
    }
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("::error file=dist/product/foo/index.html,line=3,title=SEO host mismatch");
    expect(logged[0]).toContain("%3A"); // encoded colon
  });
});
