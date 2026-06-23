/**
 * CI gate: scan prerendered HTML files under dist/ and fail if any
 * <meta property="og:url"> or <meta name="twitter:url"> tag points at
 * a host different from the configured SITE_URL.
 *
 * Requires `bun run build` (vite build + prerender) to have produced
 * dist/<route>/index.html files beforehand.
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-social-url-hosts.ts
 *
 * Tunables (env):
 *   SOCIAL_URL_CHECK_SAMPLE  — pages per section (default 25)
 *   SOCIAL_URL_CHECK_DIRS    — comma-separated dist subdirs
 *                              (default "product,category,compare,blog,guides")
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { finalizeGate, reportAndExit, lineOf, type Violation } from "./lib/seo-hosts";

const GATE = "social-url-hosts";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();
const SAMPLE = Math.max(1, Number(process.env.SOCIAL_URL_CHECK_SAMPLE) || 25);
const SECTIONS = (process.env.SOCIAL_URL_CHECK_DIRS || "product,category,compare,blog,guides")
  .split(",").map((s) => s.trim()).filter(Boolean);

console.log(`[check-social-url-hosts] SITE_URL=${SITE_URL} expected host=${EXPECTED_HOST} sample=${SAMPLE}/section`);

const distDir = resolve("dist");
if (!existsSync(distDir)) {
  console.error("[check-social-url-hosts] dist/ not found — run `bun run build` first");
  process.exit(2);
}

type Violation = { file: string; tag: string; url: string; reason: string; line?: number };
const violations: Violation[] = [];
let scanned = 0;

function extractMeta(html: string, attr: "property" | "name", value: string): string[] {
  // Tolerate attribute ordering: content before/after property/name.
  const re = new RegExp(
    `<meta\\b[^>]*?(?:${attr}=["']${value}["'][^>]*?content=["']([^"']*)["']|content=["']([^"']*)["'][^>]*?${attr}=["']${value}["'])[^>]*>`,
    "gi",
  );
  const out: string[] = [];
  for (const m of html.matchAll(re)) out.push(m[1] ?? m[2] ?? "");
  return out;
}

function checkUrl(file: string, tag: string, url: string, source: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    violations.push({ file, tag, url: "(empty)", reason: "empty content attribute" });
    return;
  }
  let absolute = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    try { absolute = new URL(trimmed, SITE_URL + "/").toString(); } catch { /* fall through */ }
  }
  const line = lineOf(source, url);
  try {
    const host = new URL(absolute).hostname.toLowerCase();
    if (host !== EXPECTED_HOST) {
      violations.push({ file, tag, url: trimmed, reason: `host ${host} != ${EXPECTED_HOST}`, line });
    }
  } catch {
    violations.push({ file, tag, url: trimmed, reason: "unparseable URL", line });
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
  const picked = Array.from(new Set([...head, ...tail]));
  return picked.map((name) => join(sectionDir, name, "index.html"));
}

for (const section of SECTIONS) {
  const sectionDir = join(distDir, section);
  const files = sampleHtmlFiles(sectionDir);
  if (files.length === 0) {
    console.log(`[check-social-url-hosts] ${section}: no prerendered pages found, skipping`);
    continue;
  }
  console.log(`[check-social-url-hosts] ${section}: scanning ${files.length} prerendered page(s)`);
  for (const file of files) {
    scanned++;
    const html = readFileSync(file, "utf8");
    const rel = file.replace(distDir + "/", "");
    const ogUrls = extractMeta(html, "property", "og:url");
    const twUrls = extractMeta(html, "name", "twitter:url");
    for (const url of ogUrls) checkUrl(rel, "og:url", url, html);
    for (const url of twUrls) checkUrl(rel, "twitter:url", url, html);
  }
}

console.log(`[${GATE}] scanned ${scanned} file(s) across ${SECTIONS.length} section(s)`);

const { kept, filteredOut } = finalizeGate({
  gate: GATE, siteUrl: SITE_URL, expectedHost: EXPECTED_HOST, violations,
  workspacePrefix: "dist/",
});
reportAndExit(GATE, kept, filteredOut, "all og:url + twitter:url tags match SITE_URL host");
