/**
 * CI gate: regenerate sitemap output and assert every URL in
 * public/sitemap*.xml and public/robots.txt uses the host of the
 * configured SITE_URL. Fails non-zero on any mismatch so a stale
 * checked-in sitemap or a wrong-env build can't ship.
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-sitemap-hosts.ts
 *   SITE_URL=https://staging.example.com tsx scripts/check-sitemap-hosts.ts
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();

console.log(`[check-sitemap-hosts] SITE_URL=${SITE_URL} expected host=${EXPECTED_HOST}`);

// 1. Regenerate sitemap with the same SITE_URL so we test fresh output.
const gen = spawnSync("tsx", ["scripts/generate-sitemap.ts"], {
  stdio: "inherit",
  env: { ...process.env, SITE_URL },
});
if (gen.status !== 0) {
  console.error("[check-sitemap-hosts] generate-sitemap.ts failed");
  process.exit(gen.status ?? 1);
}

const publicDir = resolve("public");
const violations: { file: string; url: string; reason: string }[] = [];

function checkUrl(file: string, url: string) {
  const trimmed = url.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host !== EXPECTED_HOST) {
      violations.push({ file, url: trimmed, reason: `host ${host} != ${EXPECTED_HOST}` });
    }
  } catch {
    violations.push({ file, url: trimmed, reason: "unparseable URL" });
  }
}

// 2. Walk every sitemap*.xml in public/ — extract <loc> values.
const sitemapFiles = readdirSync(publicDir).filter((f) => /^sitemap.*\.xml$/i.test(f));
for (const name of sitemapFiles) {
  const file = resolve(publicDir, name);
  const xml = readFileSync(file, "utf8");
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    checkUrl(name, m[1]);
  }
}

// 3. Check robots.txt — Sitemap: directives must point at SITE_URL host.
const robotsPath = resolve(publicDir, "robots.txt");
if (existsSync(robotsPath)) {
  const robots = readFileSync(robotsPath, "utf8");
  for (const line of robots.split(/\r?\n/)) {
    const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
    if (m) checkUrl("robots.txt", m[1]);
  }
}

const scanned = sitemapFiles.length + (existsSync(robotsPath) ? 1 : 0);
console.log(`[check-sitemap-hosts] scanned ${scanned} file(s)`);

if (violations.length > 0) {
  console.error(`\n[check-sitemap-hosts] FAILED — ${violations.length} URL(s) with wrong host:\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}: ${v.url}  (${v.reason})`);
  }
  if (violations.length > 50) console.error(`  …and ${violations.length - 50} more`);
  process.exit(1);
}

console.log("[check-sitemap-hosts] OK — all sitemap + robots URLs match SITE_URL host");
