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
    if (/^https?:\/\//i.test(url)) return new URL(url).hostname.toLowerCase();
    if (base) return new URL(url, base.replace(/\/+$/, "") + "/").hostname.toLowerCase();
    return null;
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

export type AllowlistFile = Record<string, unknown>;

/**
 * Canonical list of gate names. Any non-underscore key in the allowlist
 * JSON must be one of these — `validateAllowlistConfig` fails fast on
 * typos like `socialurl-hosts`.
 */
export const KNOWN_GATES = [
  "sitemap-hosts",
  "sitemap-index-hosts",
  "manifest-hosts",
  "prerender-canonicals",
  "jsonld-hosts",
  "social-url-hosts",
  "social-image-hosts",
  "hreflang-hosts",
] as const;
export type GateName = (typeof KNOWN_GATES)[number];

export class AllowlistConfigError extends Error {
  constructor(public errors: string[]) {
    super(`Invalid seo-host-allowlist.json:\n  - ${errors.join("\n  - ")}`);
    this.name = "AllowlistConfigError";
  }
}

/**
 * Host patterns allowed in the allowlist:
 *   - bare hostname:        "cdn.example.com"
 *   - wildcard subdomain:   "*.example.com"  (matches one or more labels)
 *
 * Bare `*`, leading/trailing dots, double dots, schemes, and paths are rejected.
 */
const HOST_PATTERN_RE =
  /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * Validate the parsed allowlist JSON. Returns a list of human-readable
 * errors (empty = valid). Pure — does not touch disk.
 */
export function validateAllowlistConfig(
  parsed: unknown,
  knownGates: readonly string[] = KNOWN_GATES,
): string[] {
  const errors: string[] = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return ["root must be a JSON object"];
  }
  const known = new Set(knownGates);
  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    // Underscore-prefixed metadata keys (e.g. "_comment") are free-form,
    // EXCEPT "_default" which must follow the host-list schema.
    if (key.startsWith("_") && key !== "_default") continue;
    if (key !== "_default" && !known.has(key)) {
      errors.push(`unknown gate key "${key}" (known gates: ${[...known].sort().join(", ")})`);
      continue;
    }
    if (!Array.isArray(raw)) {
      errors.push(`key "${key}" must be an array of host strings`);
      continue;
    }
    raw.forEach((entry, i) => {
      if (typeof entry !== "string" || entry.trim() === "") {
        errors.push(`${key}[${i}]: must be a non-empty string`);
        return;
      }
      const t = entry.trim();
      if (/^\*\.?$/.test(t)) {
        errors.push(`${key}[${i}]: "${entry}" — bare "*" wildcard not allowed`);
        return;
      }
      if (t.includes("*") && !/^\*\./.test(t)) {
        errors.push(`${key}[${i}]: "${entry}" — wildcards must be of the form "*.host" (single leading "*.")`);
        return;
      }
      if (t.indexOf("*", 1) >= 0) {
        errors.push(`${key}[${i}]: "${entry}" — only one leading wildcard label allowed`);
        return;
      }
      if (/^https?:\/\//i.test(t) || t.includes("/") || t.includes(":")) {
        errors.push(`${key}[${i}]: "${entry}" — must be a bare hostname, not a URL`);
        return;
      }
      if (!HOST_PATTERN_RE.test(t)) {
        errors.push(`${key}[${i}]: "${entry}" — invalid hostname pattern`);
      }
    });
  }
  return errors;
}

export function readAllowlistFile(rootDir = process.cwd()): AllowlistFile {
  const p = resolve(rootDir, ALLOWLIST_FILE);
  if (!existsSync(p)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    throw new AllowlistConfigError([`${ALLOWLIST_FILE}: invalid JSON — ${(e as Error).message}`]);
  }
  const errors = validateAllowlistConfig(parsed);
  if (errors.length) throw new AllowlistConfigError(errors);
  return parsed as AllowlistFile;
}

/**
 * Resolve the effective allowlist for a gate, combining:
 *   - the gate's entry in seo-host-allowlist.json
 *   - the "_default" entry in that file (applies to every gate)
 *   - the env var SEO_ALLOWED_HOSTS_<GATE_UPPER_SNAKE> (comma-separated)
 *   - the env var SEO_ALLOWED_HOSTS (comma-separated, applies globally)
 *
 * Returns lowercased Set. Wildcard entries like "*.example.com" supported.
 * Throws AllowlistConfigError if the file is invalid.
 */
export function loadAllowlist(gate: string, env: NodeJS.ProcessEnv = process.env, rootDir = process.cwd()): Set<string> {
  const file = readAllowlistFile(rootDir);
  const out = new Set<string>();
  const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  for (const h of asList(file[gate])) out.add(h.toLowerCase());
  for (const h of asList(file["_default"])) out.add(h.toLowerCase());
  const envGate = `SEO_ALLOWED_HOSTS_${gate.replace(/-/g, "_").toUpperCase()}`;
  for (const h of (env[envGate] ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) out.add(h);
  for (const h of (env.SEO_ALLOWED_HOSTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) out.add(h);
  return out;
}

/**
 * Return the 1-indexed line number where `needle` first appears in `text`,
 * or 1 when the needle is empty / not found. Used by gates to annotate
 * violations on the real source line instead of a hard-coded line=1.
 */
export function lineOf(text: string, needle: string, fromIndex = 0): number {
  if (!needle || !text) return 1;
  const idx = text.indexOf(needle, fromIndex);
  if (idx < 0) return 1;
  let line = 1;
  for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
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

/**
 * Standard tail printer for gate scripts: prints kept violations and
 * exits the process. Always call this AFTER finalizeGate.
 */
export function reportAndExit(gate: string, kept: Violation[], filteredOut: Violation[], successMessage: string): never {
  if (filteredOut.length) {
    console.log(`[${gate}] allowlisted ${filteredOut.length} off-SITE_URL violation(s)`);
  }
  if (kept.length > 0) {
    console.error(`\n[${gate}] FAILED — ${kept.length} violation(s):\n`);
    for (const v of kept.slice(0, 50)) {
      console.error(`  ${v.file} [${v.tag}]: ${v.url}  (${v.reason})`);
    }
    if (kept.length > 50) console.error(`  …and ${kept.length - 50} more`);
    process.exit(1);
  }
  console.log(`[${gate}] ${successMessage}`);
  process.exit(0);
}

// ---------- Path helpers (exported for the aggregator + tests) ----------

export function findGateReports(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return require("node:fs").readdirSync(dir).filter((f: string) => f.endsWith(".json")).map((f: string) => join(dir, f));
}
