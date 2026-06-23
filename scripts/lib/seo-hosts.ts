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
  /**
   * Trimmed single-line excerpt of the source around the URL, e.g. the
   * full <meta>/<loc>/JSON property containing the bad host. Surfaced in
   * the aggregated report so a reviewer doesn't need to open the file
   * to understand the root cause.
   */
  snippet?: string;
  /**
   * For violations that were *filtered out* by the allowlist, the
   * exact entry that matched (e.g. "*.cdn.example.com"). Empty on kept
   * violations. Used to compute allowlist usage stats in the report.
   */
  allowlistEntry?: string;
};

export type AllowlistEntryOrigin =
  | "file:gate"
  | "file:_default"
  | "env:gate"
  | "env:global";

export type AllowlistEntry = {
  /** Lowercased entry text, e.g. "cdn.example.com" or "*.example.com". */
  entry: string;
  /** Where this entry came from — used in the usage report. */
  source: AllowlistEntryOrigin;
};

export type GateReport = {
  gate: string;
  site_url: string;
  expected_host: string;
  generated_at: string;
  /** Flat lowercased entries (backwards-compatible). */
  allowlisted_hosts: string[];
  /** Per-entry origin tracking — drives the "used vs. unused" summary. */
  allowlist_entries: AllowlistEntry[];
  /** entry → number of filtered-out violations that matched it. */
  allowlist_match_counts: Record<string, number>;
  /** Entries that did not match anything during this run. */
  allowlist_unused: string[];
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

/**
 * Return the first allowlist entry (in the supplied iteration order)
 * that explains why `host` is allowed, or `null` if nothing matches.
 * Used by finalizeGate to attribute each filtered-out violation back
 * to a specific allowlist row.
 *
 * NOTE: matching the expected host is NOT counted as an allowlist hit.
 */
export function matchingAllowlistEntry(
  host: string,
  expectedHost: string,
  entries: readonly string[],
): string | null {
  if (host === expectedHost) return null;
  for (const entry of entries) {
    if (entry === host) return entry;
    if (entry.startsWith("*.")) {
      const suffix = entry.slice(1);
      if (host.endsWith(suffix) && host.length > suffix.length) return entry;
    }
  }
  return null;
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
    // Free-form metadata keys: underscore-prefixed (e.g. "_comment"),
    // EXCEPT "_default" which must follow the host-list schema, and
    // "$"-prefixed (e.g. "$schema") used by JSON Schema-aware editors.
    if (key.startsWith("$")) continue;
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
 * Resolve the effective ordered allowlist for a gate, preserving where
 * each entry came from. Lowercased + deduped (first-seen wins). Order:
 *   1. file: gate-specific
 *   2. file: _default
 *   3. env:  gate-specific (SEO_ALLOWED_HOSTS_<GATE>)
 *   4. env:  global (SEO_ALLOWED_HOSTS)
 */
export function loadAllowlistEntries(
  gate: string,
  env: NodeJS.ProcessEnv = process.env,
  rootDir = process.cwd(),
): AllowlistEntry[] {
  const file = readAllowlistFile(rootDir);
  const out: AllowlistEntry[] = [];
  const seen = new Set<string>();
  const push = (entry: string, source: AllowlistEntryOrigin) => {
    const e = entry.toLowerCase();
    if (seen.has(e)) return;
    seen.add(e);
    out.push({ entry: e, source });
  };
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  for (const h of asList(file[gate])) push(h, "file:gate");
  for (const h of asList(file["_default"])) push(h, "file:_default");
  const envGateName = `SEO_ALLOWED_HOSTS_${gate.replace(/-/g, "_").toUpperCase()}`;
  for (const h of (env[envGateName] ?? "").split(",").map((s) => s.trim()).filter(Boolean)) push(h, "env:gate");
  for (const h of (env.SEO_ALLOWED_HOSTS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) push(h, "env:global");
  return out;
}

/**
 * Backwards-compatible Set form. See loadAllowlistEntries for origin
 * tracking.
 */
export function loadAllowlist(gate: string, env: NodeJS.ProcessEnv = process.env, rootDir = process.cwd()): Set<string> {
  return new Set(loadAllowlistEntries(gate, env, rootDir).map((e) => e.entry));
}

/**
 * Return the 1-indexed line number where `needle` first appears in `text`,
 * or 1 when the needle is empty / not found.
 */
export function lineOf(text: string, needle: string, fromIndex = 0): number {
  if (!needle || !text) return 1;
  const idx = text.indexOf(needle, fromIndex);
  if (idx < 0) return 1;
  let line = 1;
  for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/**
 * Extract a one-line excerpt of `text` containing the first occurrence
 * of `needle`, with up to `span` characters of context on each side.
 * Newlines / extra whitespace are collapsed so it renders cleanly in a
 * markdown table cell. Returns `""` if the needle is missing.
 */
export function snippetAt(text: string, needle: string, span = 140, fromIndex = 0): string {
  if (!needle || !text) return "";
  const idx = text.indexOf(needle, fromIndex);
  if (idx < 0) return "";
  const start = Math.max(0, idx - span);
  const end = Math.min(text.length, idx + needle.length + span);
  let slice = text.slice(start, end);
  // Collapse whitespace and pipe chars (markdown table cell hostile).
  slice = slice.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${slice}${suffix}`;
}

// ---------- HTML extractors ----------

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

export function extractCanonicalHrefs(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/gi)) out.push(m[1]);
  for (const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/gi)) out.push(m[1]);
  return Array.from(new Set(out));
}

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

export function extractJsonLdBlocks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    out.push(m[1].trim());
  }
  return out;
}

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

export function extractSitemapLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
}

export function extractSitemapIndexLocs(xml: string): string[] {
  const out: string[] = [];
  for (const block of xml.match(/<sitemap\b[\s\S]*?<\/sitemap>/gi) ?? []) {
    const m = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i);
    if (m) out.push(m[1]);
  }
  return out;
}

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
  /**
   * Optional map of `file → original source text`. When provided,
   * finalizeGate fills in `violation.snippet` for any violation whose
   * `url` is present in the source. Lets the aggregator surface the
   * offending tag/JSON line without re-reading the file.
   */
  sources?: Record<string, string>;
  env?: NodeJS.ProcessEnv;
}): { kept: Violation[]; filteredOut: Violation[]; exitCode: number } {
  const env = args.env ?? process.env;
  const allowEntries = loadAllowlistEntries(args.gate, env);
  const entryList = allowEntries.map((e) => e.entry);
  const matchCounts: Record<string, number> = {};

  const kept: Violation[] = [];
  const filteredOut: Violation[] = [];
  for (const v of args.violations) {
    // Auto-fill snippet from sources map when caller provided it.
    if (!v.snippet && args.sources && v.url && args.sources[v.file]) {
      const s = snippetAt(args.sources[v.file], v.url);
      if (s) v.snippet = s;
    }
    const host = hostOf(v.url, args.siteUrl);
    if (host && host !== args.expectedHost) {
      const matchedEntry = matchingAllowlistEntry(host, args.expectedHost, entryList);
      if (matchedEntry) {
        v.allowlistEntry = matchedEntry;
        matchCounts[matchedEntry] = (matchCounts[matchedEntry] ?? 0) + 1;
        filteredOut.push(v);
        continue;
      }
    }
    if (args.workspacePrefix && !v.workspacePath) {
      v.workspacePath = (args.workspacePrefix.replace(/\/+$/, "") + "/" + v.file).replace(/\/{2,}/g, "/");
    }
    kept.push(v);
  }

  const unused = entryList.filter((e) => !matchCounts[e]);

  // Write per-gate JSON report.
  const reportDir = env.SEO_REPORT_DIR;
  if (reportDir) {
    mkdirSync(resolve(reportDir), { recursive: true });
    const report: GateReport = {
      gate: args.gate,
      site_url: args.siteUrl,
      expected_host: args.expectedHost,
      generated_at: new Date().toISOString(),
      allowlisted_hosts: entryList.slice().sort(),
      allowlist_entries: allowEntries,
      allowlist_match_counts: matchCounts,
      allowlist_unused: unused,
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

export function emitAnnotation(gate: string, expectedHost: string, v: Violation): void {
  const file = v.workspacePath ?? v.file;
  const line = v.line ?? 1;
  const title = `SEO host mismatch (${gate})`;
  const safe = (s: string) =>
    s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/:/g, "%3A").replace(/,/g, "%2C");
  const tail = v.snippet ? `; snippet: ${v.snippet}` : "";
  const msg = `[${v.tag}] ${v.url}  (${v.reason}); expected host=${expectedHost}${tail}`;
  console.log(`::error file=${safe(file)},line=${line},title=${safe(title)}::${safe(msg)}`);
}

export function reportAndExit(gate: string, kept: Violation[], filteredOut: Violation[], successMessage: string): never {
  if (filteredOut.length) {
    console.log(`[${gate}] allowlisted ${filteredOut.length} off-SITE_URL violation(s)`);
  }
  if (kept.length > 0) {
    console.error(`\n[${gate}] FAILED — ${kept.length} violation(s):\n`);
    for (const v of kept.slice(0, 50)) {
      const snip = v.snippet ? `\n      snippet: ${v.snippet}` : "";
      console.error(`  ${v.file} [${v.tag}]: ${v.url}  (${v.reason})${snip}`);
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
