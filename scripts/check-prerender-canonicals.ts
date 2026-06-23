/**
 * CI gate: scan a sample of prerendered product/category HTML files
 * under dist/ and fail if any <link rel="canonical"> (or og:url) hosts
 * a different domain than the configured SITE_URL.
 *
 * Requires `bun run build` (which runs vite build + prerender) to have
 * produced dist/<route>/index.html files beforehand.
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-prerender-canonicals.ts
 *
 * Tunables (env):
 *   PRERENDER_CHECK_SAMPLE  — pages per section (default 25)
 *   PRERENDER_CHECK_DIRS    — comma-separated dist subdirs (default "product,category")
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();
const SAMPLE = Math.max(1, Number(process.env.PRERENDER_CHECK_SAMPLE) || 25);
const SECTIONS = (process.env.PRERENDER_CHECK_DIRS || "product,category")
  .split(",").map((s) => s.trim()).filter(Boolean);

console.log(`[check-prerender-canonicals] SITE_URL=${SITE_URL} expected host=${EXPECTED_HOST} sample=${SAMPLE}/section`);

const distDir = resolve("dist");
if (!existsSync(distDir)) {
  console.error("[check-prerender-canonicals] dist/ not found — run `bun run build` first");
  process.exit(2);
}

type Violation = { file: string; tag: string; url: string; reason: string };
const violations: Violation[] = [];
let scanned = 0;

function extract(html: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(re)) out.push(m[1]);
  return out;
}

function checkUrl(file: string, tag: string, url: string) {
  const trimmed = url.trim();
  if (!trimmed) return;
  let absolute = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    // Relative canonical/og:url — resolve against SITE_URL so a same-origin
    // path is treated as matching, but anything else still fails clearly.
    try { absolute = new URL(trimmed, SITE_URL + "/").toString(); } catch { /* fall through */ }
  }
  try {
    const host = new URL(absolute).hostname.toLowerCase();
    if (host !== EXPECTED_HOST) {
      violations.push({ file, tag, url: trimmed, reason: `host ${host} != ${EXPECTED_HOST}` });
    }
  } catch {
    violations.push({ file, tag, url: trimmed, reason: "unparseable URL" });
  }
}

function sampleHtmlFiles(sectionDir: string): string[] {
  if (!existsSync(sectionDir)) return [];
  const entries = readdirSync(sectionDir).filter((name) => {
    const p = join(sectionDir, name);
    return statSync(p).isDirectory() && existsSync(join(p, "index.html"));
  });
  // Deterministic sample: sort alphabetically, take first SAMPLE, plus
  // last SAMPLE if pool is large — covers head + tail of slug space.
  entries.sort();
  const head = entries.slice(0, SAMPLE);
  const tail = entries.length > SAMPLE * 2 ? entries.slice(-SAMPLE) : [];
  const picked = Array.from(new Set([...head, ...tail]));
  return picked.map((name) => join(sectionDir, name, "index.html"));
}

for (const section of SECTIONS) {
  const sectionDir = join(distDir, section);
  const files = sampleHtmlFiles(sectionDir);
  console.log(`[check-prerender-canonicals] ${section}: scanning ${files.length} prerendered page(s)`);
  for (const file of files) {
    scanned++;
    const html = readFileSync(file, "utf8");
    const rel = file.replace(distDir + "/", "");
    const canonicals = extract(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/gi);
    const ogUrls = extract(html, /<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/gi);
    if (canonicals.length === 0) {
      violations.push({ file: rel, tag: "canonical", url: "(missing)", reason: "no <link rel=canonical> in HTML" });
    }
    for (const url of canonicals) checkUrl(rel, "canonical", url);
    for (const url of ogUrls) checkUrl(rel, "og:url", url);
  }
}

console.log(`[check-prerender-canonicals] scanned ${scanned} file(s) across ${SECTIONS.length} section(s)`);

if (violations.length > 0) {
  console.error(`\n[check-prerender-canonicals] FAILED — ${violations.length} violation(s):\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file} [${v.tag}]: ${v.url}  (${v.reason})`);
  }
  if (violations.length > 50) console.error(`  …and ${violations.length - 50} more`);
  process.exit(1);
}

console.log("[check-prerender-canonicals] OK — all sampled canonicals + og:url tags match SITE_URL host");
