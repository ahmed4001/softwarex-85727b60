/**
 * Shared helpers for every SEO host gate.
 *
 * Goals:
 *   1. Extractors are pure functions on strings — easy to unit-test
 *      without touching the filesystem.
 *   2. Allowlist + violation reporting + GitHub annotations live here
 *      so individual gate scripts stay short and consistent.
 *
 * Imported by every scripts/check-*.ts gate and by
 * scripts/aggregate-seo-host-report.ts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

// ---------- Types ----------

export type Violation = {
  /** File path used in the violation message — printed verbatim by gates. */
  file: string;
  /** Field/tag the violation came from (e.g. "canonical", "og:url", "@id"). */
  tag: string;
  /** Offending URL, or "(missing)" / "(empty)" / "(parse)" sentinel. */
  url: string;
  /** Human-readable explanation. */
  reason: string;
  /**
   * Workspace-relative path (e.g. "dist/product/foo/index.html") used for
   * GitHub annotations. Defaults to `file` if a gate does not set it.
   */
  workspacePath?: string;
  /** 1-indexed line within `workspacePath`, when known. */
  line?: number;
};

export type GateReport = {
  gate: string;
  site_url: string;
  expected_host: string;
  generated_at: string;
  allowlisted_hosts: string[];
  raw_violation_count: number;
  filtered_violation_count: number;
  violations: Violation[];
  filtered_out: Violation[];
};

// ---------- Host helpers ----------

export function expectedHostFromSiteUrl(siteUrl: string): string {
  return new URL(siteUrl).hostname.toLowerCase();
}

export function hostOf(url: string, base?: string): string | null {
  try {
    const abs = /^https?:\/\//i.test(url) ? url : new URL(url, (base ?? "https://placeholder.invalid").replace(/\/+$/, "") + "/").toString();
    return new URL(abs).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isAllowedHost(host: string, expectedHost: string, allowlist: ReadonlySet<string>): boolean {
  if (host === expectedHost) return true;
  if (allowlist.has(host)) return true;
  // Wildcard prefix support: "*.example.com" matches "cdn.example.com".
  for (const entry of allowlist) {
    if (entry.startsWith("*.")) {
      const suffix = entry.slice(1); // ".example.com"
      if (host.endsWith(suffix) && host.length > suffix.length) return true;
    }
  }
  return false;
}

// ---------- Allowlist config ----------

const ALLOWLIST_FILE = "seo-host-allowlist.json";

export type AllowlistFile = Record<string, string[]>;

export function readAllowlistFile(rootDir = process.cwd()): AllowlistFile {
  const p = resolve(rootDir, ALLOWLIST_FILE);
  if (!existsSync(p)) return {};
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as AllowlistFile;
  } catch { /* fall through */ }
  return {};
}

/**
 * Resolve the effective allowlist for a gate, combining:
 *   - the gate's entry in seo-host-allowlist.json
 *   - the "_default" entry in that file (applies to every gate)
 *   - the env var SEO_ALLOWED_HOSTS_<GATE_UPPER_SNAKE> (comma-separated)
 *   - the env var SEO_ALLOWED_HOSTS (comma-separated, applies globally)
 *
 * Returns lowercased Set. Wildcard entries like "*.example.com" supported.
 */
export function loadAllowlist(gate: string, env: NodeJS.ProcessEnv = process.env, rootDir = process.cwd()): Set<string> {
  const file = readAllowlistFile(rootDir);
  const out = new Set<string>();
  for (const h of file[gate] ?? []) out.add(h.toLowerCase());
  for (const h of file["_default"] ?? []) out.add(h.toLowerCase());
  const envGate = `SEO_ALLOWED_HOSTS_${gate.replace(/-/g, "_").toUpperCase()}`;
  for (const h of (env[envGate] ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) out.add(h);
  for (const h of (env.SEO_ALLOWED_HOSTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) out.add(h);
  return out;
}

// ---------- HTML extractors ----------

/**
 * Extract `content` attribute for every `<meta {attr}="{value}">` tag,
 * tolerant of attribute ordering and quote style.
 */
export function extractMetaContent(html: string, attr: "property" | "name", value: string): string[] {
  const v = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta\\b[^>]*?(?:${attr}=["']${v}["'][^>]*?content=["']([^"']*)["']|content=["']([^"']*)["'][^>]*?${attr}=["']${v}["'])[^>]*>`,
    "gi",
  );
  const out: string[] = [];
  for (const m of html.matchAll(re)) out.push(m[1] ?? m[2] ?? "");
  return out;
}

/** Extract `href` from every `<link rel="canonical">` tag. */
export function extractCanonicalHrefs(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/gi)) out.push(m[1]);
  for (const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/gi)) out.push(m[1]);
  return Array.from(new Set(out));
}

/** Extract `[{hreflang, href}]` for every `<link rel="alternate" hreflang="…">`. */
export function extractHreflangLinks(html: string): { hreflang: string; href: string | null }[] {
  const out: { hreflang: string; href: string | null }[] = [];
  const linkRe = /<link\b[^>]*\brel=["']alternate["'][^>]*>/gi;
  for (const tag of html.match(linkRe) ?? []) {
    const hl = tag.match(/\bhreflang=["']([^"']+)["']/i);
    if (!hl) continue;
    const hf = tag.match(/\bhref=["']([^"']+)["']/i);
    out.push({ hreflang: hl[1], href: hf ? hf[1] : null });
  }
  return out;
}

/** Extract raw JSON text inside every `<script type="application/ld+json">`. */
export function extractJsonLdBlocks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    out.push(m[1].trim());
  }
  return out;
}

/**
 * Walk a parsed JSON-LD node and return every URL-like value found
 * under one of `fields`. Pointer paths follow JSON Pointer-ish syntax.
 */
export function walkJsonLdUrls(
  node: unknown,
  fields: ReadonlySet<string>,
  pointer = "",
): { pointer: string; field: string; value: string }[] {
  const out: { pointer: string; field: string; value: string }[] = [];
  const recurse = (n: unknown, p: string) => {
    if (Array.isArray(n)) {
      n.forEach((c, i) => recurse(c, `${p}/${i}`));
      return;
    }
    if (n && typeof n === "object") {
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
        const cp = `${p}/${k}`;
        if (fields.has(k)) {
          if (typeof v === "string") out.push({ pointer: cp, field: k, value: v });
          else if (Array.isArray(v)) {
            v.forEach((item, i) => {
              if (typeof item === "string") out.push({ pointer: `${cp}/${i}`, field: k, value: item });
            });
          } else if (v && typeof v === "object" && typeof (v as any)["@id"] === "string") {
            out.push({ pointer: `${cp}/@id`, field: k, value: (v as any)["@id"] });
          }
        }
        recurse(v, cp);
      }
    }
  };
  recurse(node, pointer);
  return out;
}

/** Extract every `<loc>…</loc>` text node from a sitemap (urlset or sitemapindex). */
export function extractSitemapLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
}

/** Extract `<loc>` values that appear inside `<sitemap>` blocks (index-only). */
export function extractSitemapIndexLocs(xml: string): string[] {
  const out: string[] = [];
  for (const block of xml.match(/<sitemap\b[\s\S]*?<\/sitemap>/gi) ?? []) {
    const m = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Parse `Sitemap:` directives from robots.txt content (case-insensitive). */
export function parseRobotsSitemapLines(txt: string): string[] {
  const out: string[] = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
    if (m) out.push(m[1]);
  }
  return out;
}

// ---------- Violation reporting + GitHub annotations ----------

/**
 * Apply allowlist filtering, write per-gate JSON report (when
 * SEO_REPORT_DIR is set), emit GitHub annotations (when GITHUB_ACTIONS
 * is truthy), and return the filtered violations and a recommended
 * exit code (0 if filtered list is empty).
 *
 * Gates call this once at the end of their script.
 */
export function finalizeGate(args: {
  gate: string;
  siteUrl: string;
  expectedHost: string;
  violations: Violation[];
  /** Optional prefix prepended to v.file when building workspacePath
   *  for annotations (e.g. "public/", "dist/"). */
  workspacePrefix?: string;
  env?: NodeJS.ProcessEnv;
}): { kept: Violation[]; filteredOut: Violation[]; exitCode: number } {
  const env = args.env ?? process.env;
  const allow = loadAllowlist(args.gate, env);

  const kept: Violation[] = [];
  const filteredOut: Violation[] = [];
  for (const v of args.violations) {
    const host = hostOf(v.url, args.siteUrl);
    if (host && host !== args.expectedHost && isAllowedHost(host, args.expectedHost, allow)) {
      filteredOut.push(v);
      continue;
    }
    if (args.workspacePrefix && !v.workspacePath) {
      v.workspacePath = (args.workspacePrefix.replace(/\/+$/, "") + "/" + v.file).replace(/\/{2,}/g, "/");
    }
    kept.push(v);
  }

  // Write per-gate JSON report.
  const reportDir = env.SEO_REPORT_DIR;
  if (reportDir) {
    mkdirSync(resolve(reportDir), { recursive: true });
    const report: GateReport = {
      gate: args.gate,
      site_url: args.siteUrl,
      expected_host: args.expectedHost,
      generated_at: new Date().toISOString(),
      allowlisted_hosts: [...allow].sort(),
      raw_violation_count: args.violations.length,
      filtered_violation_count: kept.length,
      violations: kept,
      filtered_out: filteredOut,
    };
    writeFileSync(resolve(reportDir, `${args.gate}.json`), JSON.stringify(report, null, 2));
  }

  // Emit GitHub annotations for each kept violation.
  if (env.GITHUB_ACTIONS === "true" || env.GITHUB_ACTIONS === "1") {
    for (const v of kept.slice(0, 50)) {
      emitAnnotation(args.gate, args.expectedHost, v);
    }
  }

  return { kept, filteredOut, exitCode: kept.length > 0 ? 1 : 0 };
}

/**
 * Print a `::error file=…,line=…,title=…::message` workflow command so
 * GitHub renders the violation inline on the PR's Files Changed tab.
 */
export function emitAnnotation(gate: string, expectedHost: string, v: Violation): void {
  const file = v.workspacePath ?? v.file;
  const line = v.line ?? 1;
  const title = `SEO host mismatch (${gate})`;
  const safe = (s: string) =>
    s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/:/g, "%3A").replace(/,/g, "%2C");
  const msg = `[${v.tag}] ${v.url}  (${v.reason}); expected host=${expectedHost}`;
  console.log(`::error file=${safe(file)},line=${line},title=${safe(title)}::${safe(msg)}`);
}

// ---------- Path helpers (exported for the aggregator + tests) ----------

export function findGateReports(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return require("node:fs").readdirSync(dir).filter((f: string) => f.endsWith(".json")).map((f: string) => join(dir, f));
}
