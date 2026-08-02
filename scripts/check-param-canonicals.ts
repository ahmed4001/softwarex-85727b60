/**
 * CI gate: canonical correctness for parameterised URLs.
 *
 * Three layers:
 *   1. Policy self-check — a fixed table of URL cases asserted against
 *      src/lib/canonical-params.ts (runs everywhere, no build needed).
 *   2. Prerendered HTML — dist/compare/index.html + dist/search/index.html
 *      must carry a bare canonical/og:url (skipped when dist/ is absent).
 *   3. Live check (optional) — set PARAM_CANONICAL_BASE_URL to fetch the
 *      real param URLs and validate the served head tags.
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-param-canonicals.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { finalizeGate, reportAndExit, lineOf, type Violation } from "./lib/seo-hosts";
import {
  PARAM_CANONICAL_PATHS,
  canonicalPolicyFor,
  validateParamCanonical,
} from "../src/lib/canonical-params";

const GATE = "param-canonicals";
const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();
const LIVE_BASE = (process.env.PARAM_CANONICAL_BASE_URL || "").replace(/\/+$/, "");

const violations: Violation[] = [];
const sources: Record<string, string> = {};

// ---------- 1. Policy self-check ----------
const CASES: Array<{ url: string; canonicalPath: string; robots: string }> = [
  { url: "/compare", canonicalPath: "/compare", robots: "index, follow" },
  { url: "/compare?products=a,b", canonicalPath: "/compare", robots: "noindex, follow" },
  { url: "/compare?products=a,b&sort=price", canonicalPath: "/compare", robots: "noindex, follow" },
  { url: "/compare/", canonicalPath: "/compare", robots: "index, follow" },
  { url: "/search", canonicalPath: "/search", robots: "index, follow" },
  { url: "/search?q=crm", canonicalPath: "/search", robots: "noindex, follow" },
  { url: "/search?q=crm&page=2", canonicalPath: "/search", robots: "noindex, follow" },
];

for (const c of CASES) {
  const [pathname, search = ""] = c.url.split("?");
  const policy = canonicalPolicyFor(pathname, search);
  if (policy.canonicalPath !== c.canonicalPath) {
    violations.push({
      file: "src/lib/canonical-params.ts",
      tag: "policy:canonical",
      url: c.url,
      reason: `expected canonical path ${c.canonicalPath}, got ${policy.canonicalPath}`,
    });
  }
  if (policy.robots !== c.robots) {
    violations.push({
      file: "src/lib/canonical-params.ts",
      tag: "policy:robots",
      url: c.url,
      reason: `expected robots "${c.robots}", got "${policy.robots}"`,
    });
  }
}
console.log(`[${GATE}] policy self-check: ${CASES.length} case(s)`);

// ---------- helpers ----------
const attr = (html: string, re: RegExp): string | undefined => html.match(re)?.[1];

function checkHtml(label: string, url: string, html: string) {
  sources[label] = html;
  const canonical = attr(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ?? "";
  const ogUrl = attr(html, /<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']*)["']/i);
  const robots = attr(html, /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  const found = validateParamCanonical({ url, canonical, ogUrl, robots, siteUrl: SITE_URL });
  for (const v of found) {
    violations.push({
      file: label,
      tag: v.tag,
      url: v.actual,
      reason: `${v.reason} (expected ${v.expected})`,
      line: v.actual && v.actual !== "(missing)" ? lineOf(html, v.actual) : undefined,
    });
  }
}

// ---------- 2. Prerendered HTML ----------
const distDir = resolve("dist");
if (existsSync(distDir)) {
  for (const p of PARAM_CANONICAL_PATHS) {
    const file = join(distDir, p.replace(/^\//, ""), "index.html");
    if (!existsSync(file)) {
      console.log(`[${GATE}] dist${p}/index.html not prerendered — skipping`);
      continue;
    }
    checkHtml(`dist${p}/index.html`, p, readFileSync(file, "utf8"));
  }
} else {
  console.log(`[${GATE}] dist/ not found — skipping prerender layer`);
}

// ---------- 3. Live check ----------
async function liveChecks() {
  if (!LIVE_BASE) {
    console.log(`[${GATE}] PARAM_CANONICAL_BASE_URL unset — skipping live layer`);
    return;
  }
  const urls = [
    "/compare",
    "/compare?products=a,b",
    "/search",
    "/search?q=crm",
  ];
  for (const u of urls) {
    try {
      const res = await fetch(`${LIVE_BASE}${u}`, { headers: { "user-agent": "reviewhunts-seo-gate" } });
      const html = await res.text();
      checkHtml(`live ${u}`, u, html);
    } catch (err) {
      violations.push({ file: `live ${u}`, tag: "fetch", url: `${LIVE_BASE}${u}`, reason: String(err) });
    }
  }
}

await liveChecks();

const { kept, filteredOut } = finalizeGate({
  gate: GATE,
  siteUrl: SITE_URL,
  expectedHost: EXPECTED_HOST,
  violations,
  sources,
});
reportAndExit(GATE, kept, filteredOut, "compare/search param URLs canonicalise to their bare path");
