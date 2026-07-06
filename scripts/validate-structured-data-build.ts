/**
 * Build-time gate: after `vite build && prerender`, walk every
 * dist/**\/index.html file, extract JSON-LD blocks and OG meta tags,
 * and fail (exit 1) on any invalid structured data.
 *
 * Blocks deploys when BreadcrumbList / Review / Dataset / Product /
 * BlogPosting / FAQPage / OG tags are malformed.
 *
 * Usage:
 *   bun run build && tsx scripts/validate-structured-data-build.ts
 *
 * Env tunables:
 *   SITE_URL — expected host for og:url (default https://reviewhunts.com)
 *   SDATA_SAMPLE_PER_DIR — cap per subdir (default 50, 0 = no cap)
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { validateJsonLd } from "../src/lib/jsonLdValidator";
import { validateOgTags } from "../src/lib/ogTagValidator";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname;
const SAMPLE = Math.max(0, Number(process.env.SDATA_SAMPLE_PER_DIR) || 50);
const DIRS = (process.env.SDATA_DIRS || "product,category,compare,blog,guides,glossary")
  .split(",").map((s) => s.trim()).filter(Boolean);

const distDir = resolve("dist");
if (!existsSync(distDir)) {
  console.error("[validate-structured-data-build] dist/ missing — run `bun run build:prerender` first");
  process.exit(2);
}

interface Failure { file: string; kind: "jsonld" | "og"; type?: string; errors: string[] }
const failures: Failure[] = [];
let filesScanned = 0;

function findHtmlFiles(dir: string, out: string[] = [], limit = SAMPLE): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      findHtmlFiles(full, out, limit);
      if (limit > 0 && out.length >= limit) return out;
    } else if (entry === "index.html") {
      out.push(full);
      if (limit > 0 && out.length >= limit) return out;
    }
  }
  return out;
}

function extractJsonLd(html: string): { blocks: object[]; parseErrors: string[] } {
  const blocks: object[] = [];
  const parseErrors: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch (e) {
      parseErrors.push(`malformed JSON-LD block: ${(e as Error).message}`);
    }
  }
  return { blocks, parseErrors };
}

function extractOgTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const re = /<meta\s+[^>]*(?:property|name)=["']((?:og|twitter):[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) tags[m[1].toLowerCase()] = m[2];
  // also allow content= before property=
  const re2 = /<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']((?:og|twitter):[^"']+)["'][^>]*>/gi;
  while ((m = re2.exec(html))) tags[m[2].toLowerCase()] ||= m[1];
  return tags;
}

// Discover section dirs beneath dist/
const targetFiles: string[] = [];
// Always include root index.html (homepage)
const homeIndex = join(distDir, "index.html");
if (existsSync(homeIndex)) targetFiles.push(homeIndex);
for (const section of DIRS) {
  const sectionDir = join(distDir, section);
  const found = findHtmlFiles(sectionDir);
  targetFiles.push(...found);
}

console.log(`[validate-structured-data-build] SITE_URL=${SITE_URL} files=${targetFiles.length}`);

for (const file of targetFiles) {
  filesScanned++;
  const html = readFileSync(file, "utf-8");
  const rel = file.replace(distDir + "/", "");

  // JSON-LD
  const { blocks, parseErrors } = extractJsonLd(html);
  if (parseErrors.length) failures.push({ file: rel, kind: "jsonld", errors: parseErrors });
  const { invalid } = validateJsonLd(blocks);
  for (const inv of invalid) {
    failures.push({ file: rel, kind: "jsonld", type: inv.type, errors: inv.errors });
  }

  // OG / Twitter
  const tags = extractOgTags(html);
  // Only enforce OG on non-empty pages (skip 404 shells etc.)
  if (Object.keys(tags).length > 0) {
    const ogErrs = validateOgTags({ tags, source: rel }, { expectedHost: EXPECTED_HOST });
    if (ogErrs.length) failures.push({ file: rel, kind: "og", errors: ogErrs });
  }
}

if (failures.length === 0) {
  console.log(`✅ Structured-data gate PASSED — ${filesScanned} files scanned`);
  process.exit(0);
}

console.error(`❌ Structured-data gate FAILED — ${failures.length} issue(s) across ${filesScanned} files\n`);
for (const f of failures.slice(0, 100)) {
  console.error(`• ${f.file} [${f.kind}${f.type ? ` ${f.type}` : ""}]`);
  for (const e of f.errors) console.error(`    - ${e}`);
}
if (failures.length > 100) console.error(`  …and ${failures.length - 100} more`);
process.exit(1);
