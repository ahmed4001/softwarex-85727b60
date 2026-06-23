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
  loadAllowlistEntries,
  matchingAllowlistEntry,
  validateAllowlistConfig,
  AllowlistConfigError,
  KNOWN_GATES,
  lineOf,
  snippetAt,
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

  it("throws AllowlistConfigError on invalid JSON", () => {
    writeFileSync(join(tmp, "seo-host-allowlist.json"), "{not json");
    expect(() => loadAllowlist("jsonld-hosts", {}, tmp)).toThrow(AllowlistConfigError);
  });

  it("throws AllowlistConfigError on unknown gate key", () => {
    writeFileSync(join(tmp, "seo-host-allowlist.json"), JSON.stringify({
      "socialurl-hosts": ["cdn.example.com"], // typo
    }));
    expect(() => loadAllowlist("jsonld-hosts", {}, tmp)).toThrow(/unknown gate key/);
  });

  it("throws AllowlistConfigError on invalid wildcard pattern", () => {
    writeFileSync(join(tmp, "seo-host-allowlist.json"), JSON.stringify({
      "jsonld-hosts": ["*"], // bare wildcard
    }));
    expect(() => loadAllowlist("jsonld-hosts", {}, tmp)).toThrow(/bare "\*" wildcard/);
  });
});

describe("validateAllowlistConfig", () => {
  it("returns no errors for the canonical empty config", () => {
    const obj = Object.fromEntries(KNOWN_GATES.map((g) => [g, []]));
    obj._default = [];
    expect(validateAllowlistConfig(obj)).toEqual([]);
  });

  it("rejects array root, primitive root, null", () => {
    expect(validateAllowlistConfig([])).toHaveLength(1);
    expect(validateAllowlistConfig("nope")).toHaveLength(1);
    expect(validateAllowlistConfig(null)).toHaveLength(1);
  });

  it("ignores underscore metadata keys other than _default", () => {
    expect(validateAllowlistConfig({ _comment: "free-form", _notes: ["anything"] })).toEqual([]);
  });

  it("flags unknown gate keys with the list of known gates", () => {
    const errs = validateAllowlistConfig({ "social-urls": [] }); // missing -hosts suffix
    expect(errs.some((e) => /unknown gate key "social-urls"/.test(e))).toBe(true);
    expect(errs.some((e) => /known gates/.test(e))).toBe(true);
  });

  it("flags non-array values", () => {
    const errs = validateAllowlistConfig({ "jsonld-hosts": "cdn.example.com" });
    expect(errs[0]).toMatch(/must be an array/);
  });

  it("accepts valid hostnames + single leading wildcards", () => {
    expect(validateAllowlistConfig({
      _default: ["cdn.example.com", "*.example.com", "img-cdn.sub.example.co.uk"],
    })).toEqual([]);
  });

  it("rejects bare wildcard, double-star, mid-string star, urls, ports, paths", () => {
    const errs = validateAllowlistConfig({
      "jsonld-hosts": ["*", "**.example.com", "cdn.*.example.com", "https://cdn.example.com", "cdn.example.com/path", "cdn.example.com:443"],
    });
    // At least one error per bad entry.
    expect(errs.length).toBeGreaterThanOrEqual(6);
  });

  it("rejects empty and non-string entries", () => {
    const errs = validateAllowlistConfig({ "jsonld-hosts": ["", 42 as any, "  "] });
    expect(errs.length).toBe(3);
  });
});

describe("lineOf", () => {
  it("returns 1-indexed line of first match", () => {
    const text = "alpha\nbeta\ngamma\ndelta";
    expect(lineOf(text, "alpha")).toBe(1);
    expect(lineOf(text, "beta")).toBe(2);
    expect(lineOf(text, "gamma")).toBe(3);
    expect(lineOf(text, "delta")).toBe(4);
  });
  it("respects fromIndex when the needle repeats", () => {
    const text = "x\nfoo\ny\nfoo\nz";
    expect(lineOf(text, "foo")).toBe(2);
    expect(lineOf(text, "foo", 5)).toBe(4);
  });
  it("returns 1 when needle missing or empty", () => {
    expect(lineOf("abc", "")).toBe(1);
    expect(lineOf("abc", "zzz")).toBe(1);
    expect(lineOf("", "anything")).toBe(1);
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

describe("validateAllowlistConfig — $schema + metadata keys", () => {
  it("accepts a top-level $schema reference (editor JSON Schema support)", () => {
    expect(validateAllowlistConfig({
      $schema: "./seo-host-allowlist.schema.json",
      _default: ["cdn.example.com"],
      "jsonld-hosts": [],
    })).toEqual([]);
  });

  it("still rejects unknown gate-like keys even when $schema is present", () => {
    const errs = validateAllowlistConfig({
      $schema: "./seo-host-allowlist.schema.json",
      "social-urls": [], // typo
    });
    expect(errs.some((e) => /unknown gate key "social-urls"/.test(e))).toBe(true);
  });
});

describe("snippetAt", () => {
  it("returns a trimmed, single-line excerpt with ellipses", () => {
    const text = `line one\n  <meta property="og:url" content="https://other.com/abc"/>\nline three`;
    const s = snippetAt(text, "https://other.com/abc", 20);
    expect(s).toContain("og:url");
    expect(s).toContain("https://other.com/abc");
    expect(s).not.toContain("\n");
    expect(s.startsWith("…") || !s.startsWith(" ")).toBe(true);
  });

  it("escapes pipe characters so it renders in a markdown table cell", () => {
    expect(snippetAt("a | b https://x.com c | d", "https://x.com")).toContain("\\|");
  });

  it("returns empty string when needle is absent", () => {
    expect(snippetAt("hello", "nope")).toBe("");
    expect(snippetAt("hello", "")).toBe("");
  });
});

describe("matchingAllowlistEntry", () => {
  it("returns the explicit entry that matched", () => {
    expect(matchingAllowlistEntry("cdn.example.com", "site.com", ["cdn.example.com"])).toBe("cdn.example.com");
  });
  it("returns the wildcard entry that matched", () => {
    expect(matchingAllowlistEntry("a.b.foo.com", "site.com", ["*.foo.com"])).toBe("*.foo.com");
  });
  it("returns null for the expected host (no allowlist credit)", () => {
    expect(matchingAllowlistEntry("site.com", "site.com", ["site.com"])).toBe(null);
  });
  it("returns null when nothing matches", () => {
    expect(matchingAllowlistEntry("nope.com", "site.com", ["*.foo.com"])).toBe(null);
  });
});

describe("loadAllowlistEntries — origin tracking", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "seo-origin-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("tags each entry with where it came from, preserving order + dedupe", () => {
    writeFileSync(join(tmp, "seo-host-allowlist.json"), JSON.stringify({
      _default: ["g.example.com", "shared.example.com"],
      "jsonld-hosts": ["j.example.com", "shared.example.com"],
    }));
    const entries = loadAllowlistEntries(
      "jsonld-hosts",
      { SEO_ALLOWED_HOSTS_JSONLD_HOSTS: "env-gate.example.com", SEO_ALLOWED_HOSTS: "env-global.example.com" },
      tmp,
    );
    const map = Object.fromEntries(entries.map((e) => [e.entry, e.source]));
    expect(map["j.example.com"]).toBe("file:gate");
    expect(map["shared.example.com"]).toBe("file:gate"); // first-seen wins (gate beats _default)
    expect(map["g.example.com"]).toBe("file:_default");
    expect(map["env-gate.example.com"]).toBe("env:gate");
    expect(map["env-global.example.com"]).toBe("env:global");
  });
});

describe("finalizeGate — allowlist usage + snippet enrichment", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "seo-usage-"));
    mkdirSync(join(tmp, "reports"));
    writeFileSync(join(tmp, "seo-host-allowlist.json"), JSON.stringify({
      "social-image-hosts": ["cdn.allowed.com", "*.unused-wildcard.com"],
    }));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("records match counts, unused entries, and snippet on the report", () => {
    const reportDir = join(tmp, "reports");
    const html = `<html>\n<head>\n<meta property="og:image" content="https://cdn.allowed.com/x.png">\n</head>\n</html>`;
    const cwd = process.cwd();
    process.chdir(tmp);
    try {
      finalizeGate({
        gate: "social-image-hosts",
        siteUrl: "https://example.com",
        expectedHost: "example.com",
        violations: [
          { file: "a.html", tag: "og:image", url: "https://cdn.allowed.com/x.png", reason: "host cdn.allowed.com != example.com" },
        ],
        sources: { "a.html": html },
        env: { SEO_REPORT_DIR: reportDir },
      });
    } finally {
      process.chdir(cwd);
    }
    const report = JSON.parse(readFileSync(join(reportDir, "social-image-hosts.json"), "utf8"));
    expect(report.allowlist_match_counts["cdn.allowed.com"]).toBe(1);
    expect(report.allowlist_unused).toContain("*.unused-wildcard.com");
    expect(report.filtered_out[0].allowlistEntry).toBe("cdn.allowed.com");
    expect(report.filtered_out[0].snippet).toContain("og:image");
    expect(report.filtered_out[0].snippet).toContain("cdn.allowed.com");
  });
});

});
