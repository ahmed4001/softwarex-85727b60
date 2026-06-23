/**
 * CI gate: validate PWA manifest URL fields against SITE_URL.
 *
 * Looks for public/manifest.json, public/manifest.webmanifest, or
 * public/site.webmanifest. Validates these fields when present:
 *   - start_url           (absolute → must match SITE_URL host;
 *                          relative is fine — same-origin by spec)
 *   - scope               (same rule as start_url)
 *   - id                  (same rule)
 *   - icons[].src         (absolute → host must match; relative is fine)
 *   - screenshots[].src   (same rule)
 *   - shortcuts[].url     (same rule)
 *   - related_applications[].url  (skipped — legitimately off-origin)
 *
 * Also scans <link rel="manifest"> in index.html to surface drift
 * (e.g. linking a manifest file that doesn't exist).
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-manifest-hosts.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { finalizeGate, reportAndExit, lineOf, type Violation } from "./lib/seo-hosts";

const GATE = "manifest-hosts";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();

console.log(`[check-manifest-hosts] SITE_URL=${SITE_URL} expected host=${EXPECTED_HOST}`);

const candidates = ["manifest.json", "manifest.webmanifest", "site.webmanifest"];
const publicDir = resolve("public");
const found = candidates.map((c) => resolve(publicDir, c)).filter((p) => existsSync(p));

if (found.length === 0) {
  console.log("[check-manifest-hosts] OK — no PWA manifest in public/, nothing to validate");
  process.exit(0);
}

type Violation = { file: string; field: string; url: string; reason: string; line?: number };
const violations: Violation[] = [];
let currentSource = "";

function checkAbsoluteUrl(file: string, field: string, value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return;
  const v = value.trim();
  // Per the manifest spec, relative URLs resolve against the manifest's
  // origin — so anything not starting with a scheme is implicitly
  // same-origin and OK. Only absolute URLs need a host check.
  if (!/^https?:\/\//i.test(v)) return;
  const line = currentSource ? lineOf(currentSource, value) : 1;
  try {
    const host = new URL(v).hostname.toLowerCase();
    if (host !== EXPECTED_HOST) {
      violations.push({ file, field, url: v, reason: `host ${host} != ${EXPECTED_HOST}`, line });
    }
  } catch {
    violations.push({ file, field, url: v, reason: "unparseable URL", line });
  }
}

const sources: Record<string, string> = {};

for (const path of found) {
  const rel = path.replace(resolve(".") + "/", "");
  let manifest: any;
  const raw = readFileSync(path, "utf8");
  currentSource = raw;
  sources[rel] = raw;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    violations.push({ file: rel, field: "(file)", url: "(parse)", reason: `invalid JSON: ${(e as Error).message}`, line: 1 });
    continue;
  }

  checkAbsoluteUrl(rel, "start_url", manifest.start_url);
  checkAbsoluteUrl(rel, "scope", manifest.scope);
  checkAbsoluteUrl(rel, "id", manifest.id);

  for (const [i, icon] of (manifest.icons ?? []).entries()) {
    checkAbsoluteUrl(rel, `icons[${i}].src`, icon?.src);
  }
  for (const [i, s] of (manifest.screenshots ?? []).entries()) {
    checkAbsoluteUrl(rel, `screenshots[${i}].src`, s?.src);
  }
  for (const [i, sc] of (manifest.shortcuts ?? []).entries()) {
    checkAbsoluteUrl(rel, `shortcuts[${i}].url`, sc?.url);
    for (const [j, icon] of (sc?.icons ?? []).entries()) {
      checkAbsoluteUrl(rel, `shortcuts[${i}].icons[${j}].src`, icon?.src);
    }
  }
}

// Cross-check: <link rel="manifest"> in index.html should reference
// a manifest file we just validated (or at least one that exists).
const indexPath = resolve("index.html");
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, "utf8");
  currentSource = html;
  sources["index.html"] = html;
  const m = html.match(/<link[^>]+rel=["']manifest["'][^>]*href=["']([^"']+)["']/i);
  if (m) {
    const href = m[1];
    if (/^https?:\/\//i.test(href)) {
      checkAbsoluteUrl("index.html", 'link[rel=manifest] href', href);
    } else {
      const localName = href.replace(/^\/+/, "").split(/[?#]/)[0];
      if (localName && !existsSync(resolve(publicDir, localName))) {
        violations.push({
          file: "index.html",
          field: "link[rel=manifest] href",
          url: href,
          reason: `referenced ${localName} not found in public/`,
          line: lineOf(html, href),
        });
      }
    }
  }
}

console.log(`[${GATE}] scanned ${found.length} manifest file(s)`);

const normalized: Violation[] = violations.map((v) => ({ file: v.file, tag: v.field, url: v.url, reason: v.reason, line: v.line }));
const { kept, filteredOut } = finalizeGate({
  gate: GATE, siteUrl: SITE_URL, expectedHost: EXPECTED_HOST, violations: normalized,
  sources,
  // v.file is already workspace-relative ("public/manifest.json", "index.html").
});
reportAndExit(GATE, kept, filteredOut, "manifest URL fields match SITE_URL host");
