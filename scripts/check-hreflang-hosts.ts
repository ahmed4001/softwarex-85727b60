/**
 * CI gate: scan prerendered HTML under dist/ and fail if any
 * <link rel="alternate" hreflang="…" href="…"> points at a host
 * different from SITE_URL. Includes the x-default alternate.
 *
 * Note: hreflang URLs must be absolute per Google's spec, so
 * relative hrefs are also flagged.
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-hreflang-hosts.ts
 *
 * Tunables (env):
 *   HREFLANG_CHECK_SAMPLE  — pages per section (default 25)
 *   HREFLANG_CHECK_DIRS    — comma-separated dist subdirs
 *                            (default "product,category,compare,blog,guides")
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { finalizeGate, reportAndExit, lineOf, type Violation } from "./lib/seo-hosts";

const GATE = "hreflang-hosts";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();
const SAMPLE = Math.max(1, Number(process.env.HREFLANG_CHECK_SAMPLE) || 25);
const SECTIONS = (process.env.HREFLANG_CHECK_DIRS || "product,category,compare,blog,guides")
  .split(",").map((s) => s.trim()).filter(Boolean);

console.log(`[check-hreflang-hosts] SITE_URL=${SITE_URL} expected host=${EXPECTED_HOST} sample=${SAMPLE}/section`);

const distDir = resolve("dist");
if (!existsSync(distDir)) {
  console.error("[check-hreflang-hosts] dist/ not found — run `bun run build` first");
  process.exit(2);
}

type Violation = { file: string; hreflang: string; url: string; reason: string; line?: number };
const violations: Violation[] = [];
let scanned = 0;
let hreflangsFound = 0;

// Match <link> tags carrying both rel=alternate and hreflang in either
// attribute order. Capture hreflang value + href value.
const linkRe = /<link\b[^>]*\brel=["']alternate["'][^>]*>/gi;
const hreflangAttrRe = /\bhreflang=["']([^"']+)["']/i;
const hrefAttrRe = /\bhref=["']([^"']+)["']/i;

function checkUrl(file: string, hreflang: string, url: string, source: string, fromIndex: number) {
  const trimmed = url.trim();
  const line = lineOf(source, url, fromIndex);
  if (!trimmed) {
    violations.push({ file, hreflang, url: "(empty)", reason: "empty href", line });
    return;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    violations.push({ file, hreflang, url: trimmed, reason: "hreflang href must be absolute (https://…)", line });
    return;
  }
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host !== EXPECTED_HOST) {
      violations.push({ file, hreflang, url: trimmed, reason: `host ${host} != ${EXPECTED_HOST}`, line });
    }
  } catch {
    violations.push({ file, hreflang, url: trimmed, reason: "unparseable URL", line });
  }
}

function sampleHtmlFiles(sectionDir: string): string[] {
  if (!existsSync(sectionDir)) return [];
  const entries = readdirSync(sectionDir).filter((name) => {
    const p = join(sectionDir, name);
    try { return statSync(p).isDirectory() && existsSync(join(p, "index.html")); }
    catch { return false; }
  });
  entries.sort();
  const head = entries.slice(0, SAMPLE);
  const tail = entries.length > SAMPLE * 2 ? entries.slice(-SAMPLE) : [];
  return Array.from(new Set([...head, ...tail])).map((n) => join(sectionDir, n, "index.html"));
}

const sources: Record<string, string> = {};
for (const section of SECTIONS) {
  const sectionDir = join(distDir, section);
  const files = sampleHtmlFiles(sectionDir);
  if (files.length === 0) {
    console.log(`[check-hreflang-hosts] ${section}: no prerendered pages found, skipping`);
    continue;
  }
  console.log(`[check-hreflang-hosts] ${section}: scanning ${files.length} prerendered page(s)`);
  for (const file of files) {
    scanned++;
    const html = readFileSync(file, "utf8");
    const rel = file.replace(distDir + "/", "");
    sources[rel] = html;
    for (const tag of html.match(linkRe) ?? []) {
      const hl = tag.match(hreflangAttrRe);
      const hf = tag.match(hrefAttrRe);
      if (!hl) continue;
      hreflangsFound++;
      const tagIdx = html.indexOf(tag);
      if (!hf) {
        violations.push({ file: rel, hreflang: hl[1], url: "(missing)", reason: "alternate link without href", line: lineOf(html, tag) });
        continue;
      }
      checkUrl(rel, hl[1], hf[1], html, Math.max(0, tagIdx));
    }
  }
}

console.log(`[${GATE}] scanned ${scanned} file(s), found ${hreflangsFound} hreflang link(s)`);

const normalized: Violation[] = violations.map((v) => ({
  file: v.file, tag: `hreflang=${v.hreflang}`, url: v.url, reason: v.reason, line: v.line,
}));
const { kept, filteredOut } = finalizeGate({
  gate: GATE, siteUrl: SITE_URL, expectedHost: EXPECTED_HOST, violations: normalized,
  workspacePrefix: "dist/",
  sources,
});
reportAndExit(GATE, kept, filteredOut, "all hreflang alternates match SITE_URL host");
