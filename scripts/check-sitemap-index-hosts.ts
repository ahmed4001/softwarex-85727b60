/**
 * CI gate: validate that every <sitemap><loc> entry inside any
 * <sitemapindex> in public/sitemap*.xml uses the current SITE_URL
 * host, AND that each referenced nested sitemap file resolves to a
 * local file whose own <loc> entries also use the SITE_URL host.
 *
 * Complements check-sitemap-hosts.ts (which flat-scans every <loc>)
 * by asserting the index → nested relationship is internally
 * consistent and host-correct.
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-sitemap-index-hosts.ts
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();

console.log(`[check-sitemap-index-hosts] SITE_URL=${SITE_URL} expected host=${EXPECTED_HOST}`);

const publicDir = resolve("public");
const violations: { file: string; kind: string; url: string; reason: string }[] = [];

function hostOk(url: string): { ok: boolean; reason?: string } {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host !== EXPECTED_HOST) return { ok: false, reason: `host ${host} != ${EXPECTED_HOST}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "unparseable URL" };
  }
}

const xmlFiles = readdirSync(publicDir).filter((f) => /^sitemap.*\.xml$/i.test(f));
let indexCount = 0;
let nestedChecked = 0;

for (const name of xmlFiles) {
  const xml = readFileSync(resolve(publicDir, name), "utf8");
  if (!/<sitemapindex\b/i.test(xml)) continue;
  indexCount++;

  // Match <sitemap>…<loc>URL</loc>…</sitemap> blocks specifically (skip <url><loc>).
  const blockRe = /<sitemap\b[\s\S]*?<\/sitemap>/gi;
  for (const block of xml.match(blockRe) ?? []) {
    const m = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i);
    if (!m) {
      violations.push({ file: name, kind: "sitemapindex entry", url: "(missing)", reason: "<sitemap> block without <loc>" });
      continue;
    }
    const url = m[1];
    const check = hostOk(url);
    if (!check.ok) {
      violations.push({ file: name, kind: "sitemapindex entry", url, reason: check.reason! });
      continue;
    }

    // Cross-check: nested sitemap file should exist locally and its
    // own <loc> entries must also use SITE_URL host.
    const nestedName = basename(new URL(url).pathname);
    const nestedPath = resolve(publicDir, nestedName);
    if (!existsSync(nestedPath)) {
      violations.push({
        file: name,
        kind: "sitemapindex entry",
        url,
        reason: `referenced nested sitemap ${nestedName} not found in public/`,
      });
      continue;
    }
    nestedChecked++;
    const nestedXml = readFileSync(nestedPath, "utf8");
    for (const lm of nestedXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      const nestedUrl = lm[1];
      const c = hostOk(nestedUrl);
      if (!c.ok) {
        violations.push({ file: nestedName, kind: "nested <loc>", url: nestedUrl, reason: c.reason! });
      }
    }
  }
}

console.log(`[check-sitemap-index-hosts] scanned ${indexCount} sitemapindex file(s), ${nestedChecked} nested sitemap(s)`);

if (indexCount === 0) {
  console.log("[check-sitemap-index-hosts] OK — no <sitemapindex> found, nothing to validate");
  process.exit(0);
}

if (violations.length > 0) {
  console.error(`\n[check-sitemap-index-hosts] FAILED — ${violations.length} violation(s):\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file} [${v.kind}]: ${v.url}  (${v.reason})`);
  }
  if (violations.length > 50) console.error(`  …and ${violations.length - 50} more`);
  process.exit(1);
}

console.log("[check-sitemap-index-hosts] OK — sitemapindex + nested sitemaps all match SITE_URL host");
