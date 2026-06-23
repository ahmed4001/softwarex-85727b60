/**
 * CI gate: scan prerendered HTML under dist/ and fail if any
 * <meta property="og:image"> or <meta name="twitter:image"> tag
 * (incl. og:image:url, og:image:secure_url, twitter:image:src)
 * resolves to a host different from SITE_URL.
 *
 * Hosting images on a third-party CDN is a common, valid choice —
 * but it's a project policy decision. This gate enforces the
 * "all OG/Twitter previews self-hosted" policy. If the project
 * legitimately uses a separate image CDN, extend ALLOWED_IMAGE_HOSTS.
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-social-image-hosts.ts
 *
 * Tunables (env):
 *   SOCIAL_IMAGE_CHECK_SAMPLE  — pages per section (default 25)
 *   SOCIAL_IMAGE_CHECK_DIRS    — comma-separated dist subdirs
 *                                (default "product,category,compare,blog,guides")
 *   SOCIAL_IMAGE_ALLOWED_HOSTS — comma-separated extra allowed hosts
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { finalizeGate, reportAndExit, lineOf, type Violation } from "./lib/seo-hosts";

const GATE = "social-image-hosts";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();
const SAMPLE = Math.max(1, Number(process.env.SOCIAL_IMAGE_CHECK_SAMPLE) || 25);
const SECTIONS = (process.env.SOCIAL_IMAGE_CHECK_DIRS || "product,category,compare,blog,guides")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED_IMAGE_HOSTS = new Set<string>([
  EXPECTED_HOST,
  ...(process.env.SOCIAL_IMAGE_ALLOWED_HOSTS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
]);

console.log(`[check-social-image-hosts] SITE_URL=${SITE_URL} expected host=${EXPECTED_HOST} sample=${SAMPLE}/section`);
if (ALLOWED_IMAGE_HOSTS.size > 1) {
  console.log(`[check-social-image-hosts] also allowed: ${[...ALLOWED_IMAGE_HOSTS].filter((h) => h !== EXPECTED_HOST).join(", ")}`);
}

const distDir = resolve("dist");
if (!existsSync(distDir)) {
  console.error("[check-social-image-hosts] dist/ not found — run `bun run build` first");
  process.exit(2);
}

const OG_PROPS = ["og:image", "og:image:url", "og:image:secure_url"];
const TW_NAMES = ["twitter:image", "twitter:image:src"];

type Violation = { file: string; tag: string; url: string; reason: string; line?: number };
const violations: Violation[] = [];
let scanned = 0;

function extractMeta(html: string, attr: "property" | "name", value: string): string[] {
  const re = new RegExp(
    `<meta\\b[^>]*?(?:${attr}=["']${value.replace(/:/g, "\\:")}["'][^>]*?content=["']([^"']*)["']|content=["']([^"']*)["'][^>]*?${attr}=["']${value.replace(/:/g, "\\:")}["'])[^>]*>`,
    "gi",
  );
  const out: string[] = [];
  for (const m of html.matchAll(re)) out.push(m[1] ?? m[2] ?? "");
  return out;
}

function checkImageUrl(file: string, tag: string, url: string, source: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    violations.push({ file, tag, url: "(empty)", reason: "empty content attribute" });
    return;
  }
  const line = lineOf(source, url);
  if (!/^https?:\/\//i.test(trimmed)) {
    // OG/Twitter image specs require ABSOLUTE URLs — relative paths
    // are silently rejected by most crawlers. Flag them.
    violations.push({ file, tag, url: trimmed, reason: "image URL must be absolute (https://…)", line });
    return;
  }
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (!ALLOWED_IMAGE_HOSTS.has(host)) {
      violations.push({ file, tag, url: trimmed, reason: `host ${host} not in allowed set (${[...ALLOWED_IMAGE_HOSTS].join(", ")})`, line });
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
  return Array.from(new Set([...head, ...tail])).map((n) => join(sectionDir, n, "index.html"));
}

for (const section of SECTIONS) {
  const sectionDir = join(distDir, section);
  const files = sampleHtmlFiles(sectionDir);
  if (files.length === 0) {
    console.log(`[check-social-image-hosts] ${section}: no prerendered pages found, skipping`);
    continue;
  }
  console.log(`[check-social-image-hosts] ${section}: scanning ${files.length} prerendered page(s)`);
  for (const file of files) {
    scanned++;
    const html = readFileSync(file, "utf8");
    const rel = file.replace(distDir + "/", "");
    for (const prop of OG_PROPS) {
      for (const url of extractMeta(html, "property", prop)) checkImageUrl(rel, prop, url, html);
    }
    for (const nm of TW_NAMES) {
      for (const url of extractMeta(html, "name", nm)) checkImageUrl(rel, nm, url, html);
    }
  }
}

console.log(`[${GATE}] scanned ${scanned} file(s) across ${SECTIONS.length} section(s)`);

const { kept, filteredOut } = finalizeGate({
  gate: GATE, siteUrl: SITE_URL, expectedHost: EXPECTED_HOST, violations,
  workspacePrefix: "dist/",
});
reportAndExit(GATE, kept, filteredOut, "all og:image + twitter:image tags match allowed hosts");
