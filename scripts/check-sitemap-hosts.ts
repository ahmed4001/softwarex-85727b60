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
import { finalizeGate, reportAndExit, lineOf, type Violation } from "./lib/seo-hosts";

const GATE = "sitemap-hosts";
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
const violations: Violation[] = [];

function checkUrl(file: string, tag: string, url: string, source: string, fromIndex = 0) {
  const trimmed = url.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
  const line = lineOf(source, url, fromIndex);
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host !== EXPECTED_HOST) {
      violations.push({ file, tag, url: trimmed, reason: `host ${host} != ${EXPECTED_HOST}`, line });
    }
  } catch {
    violations.push({ file, tag, url: trimmed, reason: "unparseable URL", line });
  }
}

const sources: Record<string, string> = {};
const sitemapFiles = readdirSync(publicDir).filter((f) => /^sitemap.*\.xml$/i.test(f));
for (const name of sitemapFiles) {
  const file = resolve(publicDir, name);
  const xml = readFileSync(file, "utf8");
  sources[name] = xml;
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) checkUrl(name, "loc", m[1], xml, m.index ?? 0);
}

const robotsPath = resolve(publicDir, "robots.txt");
if (existsSync(robotsPath)) {
  const robots = readFileSync(robotsPath, "utf8");
  sources["robots.txt"] = robots;
  for (const line of robots.split(/\r?\n/)) {
    const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
    if (m) checkUrl("robots.txt", "robots Sitemap:", m[1], robots);
  }
}

const scanned = sitemapFiles.length + (existsSync(robotsPath) ? 1 : 0);
console.log(`[${GATE}] scanned ${scanned} file(s)`);

const { kept, filteredOut } = finalizeGate({
  gate: GATE, siteUrl: SITE_URL, expectedHost: EXPECTED_HOST, violations,
  workspacePrefix: "public/",
  sources,
});
reportAndExit(GATE, kept, filteredOut, "all sitemap + robots URLs match SITE_URL host");
