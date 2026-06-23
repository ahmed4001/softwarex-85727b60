/**
 * CI gate: walk prerendered HTML in dist/, parse every
 * <script type="application/ld+json"> block, and fail if any @id or url
 * field (anywhere in the JSON tree, including nested @graph nodes)
 * resolves to a host different from the configured SITE_URL.
 *
 * Requires `bun run build` (vite build + prerender) beforehand.
 *
 * Usage:
 *   SITE_URL=https://reviewhunts.com tsx scripts/check-jsonld-hosts.ts
 *
 * Tunables (env):
 *   JSONLD_CHECK_SAMPLE — pages per section (default 25)
 *   JSONLD_CHECK_DIRS   — comma-separated dist subdirs (default
 *                         "product,category,compare,blog,guides")
 *   JSONLD_CHECK_FIELDS — JSON keys to validate (default "@id,url,mainEntityOfPage,sameAs")
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const EXPECTED_HOST = new URL(SITE_URL).hostname.toLowerCase();
const SAMPLE = Math.max(1, Number(process.env.JSONLD_CHECK_SAMPLE) || 25);
const SECTIONS = (process.env.JSONLD_CHECK_DIRS || "product,category,compare,blog,guides")
  .split(",").map((s) => s.trim()).filter(Boolean);
const FIELDS = new Set(
  (process.env.JSONLD_CHECK_FIELDS || "@id,url,mainEntityOfPage,sameAs")
    .split(",").map((s) => s.trim()).filter(Boolean),
);
// sameAs commonly references off-site social profiles (twitter.com, etc.)
// — never flag those. Only @id / url / mainEntityOfPage must be same-host.
const SAME_HOST_REQUIRED = new Set(["@id", "url", "mainEntityOfPage"]);

console.log(`[check-jsonld-hosts] SITE_URL=${SITE_URL} host=${EXPECTED_HOST} sample=${SAMPLE}/section fields=${[...FIELDS].join(",")}`);

const distDir = resolve("dist");
if (!existsSync(distDir)) {
  console.error("[check-jsonld-hosts] dist/ not found — run `bun run build` first");
  process.exit(2);
}

type Violation = { file: string; pointer: string; field: string; url: string; reason: string };
const violations: Violation[] = [];
let scanned = 0;
let blocksParsed = 0;
let blocksInvalid = 0;

function urlHostOrNull(value: string): string | null {
  try {
    const abs = /^https?:\/\//i.test(value) ? value : new URL(value, SITE_URL + "/").toString();
    return new URL(abs).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function checkValue(file: string, pointer: string, field: string, value: unknown) {
  if (typeof value !== "string" || !value) return;
  // Ignore non-URL strings (@id can be a CURIE / opaque token).
  if (!/^https?:\/\//i.test(value) && !value.startsWith("/")) return;
  const host = urlHostOrNull(value);
  if (host == null) {
    violations.push({ file, pointer, field, url: value, reason: "unparseable URL" });
    return;
  }
  if (host !== EXPECTED_HOST && SAME_HOST_REQUIRED.has(field)) {
    violations.push({ file, pointer, field, url: value, reason: `host ${host} != ${EXPECTED_HOST}` });
  }
}

function walk(file: string, node: unknown, pointer: string) {
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(file, child, `${pointer}/${i}`));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const childPtr = `${pointer}/${k}`;
      if (FIELDS.has(k)) {
        if (Array.isArray(v)) v.forEach((item, i) => checkValue(file, `${childPtr}/${i}`, k, item));
        else if (typeof v === "string") checkValue(file, childPtr, k, v);
        else if (v && typeof v === "object" && "@id" in (v as any) && typeof (v as any)["@id"] === "string") {
          // e.g. mainEntityOfPage: { "@id": "https://..." }
          checkValue(file, `${childPtr}/@id`, k, (v as any)["@id"]);
        }
      }
      walk(file, v, childPtr);
    }
  }
}

function sampleHtmlFiles(sectionDir: string): string[] {
  if (!existsSync(sectionDir)) return [];
  const entries = readdirSync(sectionDir).filter((name) => {
    const p = join(sectionDir, name);
    try { return statSync(p).isDirectory() && existsSync(join(p, "index.html")); } catch { return false; }
  });
  entries.sort();
  const head = entries.slice(0, SAMPLE);
  const tail = entries.length > SAMPLE * 2 ? entries.slice(-SAMPLE) : [];
  return Array.from(new Set([...head, ...tail])).map((name) => join(sectionDir, name, "index.html"));
}

const LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

for (const section of SECTIONS) {
  const sectionDir = join(distDir, section);
  const files = sampleHtmlFiles(sectionDir);
  console.log(`[check-jsonld-hosts] ${section}: scanning ${files.length} page(s)`);
  for (const file of files) {
    scanned++;
    const rel = file.replace(distDir + "/", "");
    const html = readFileSync(file, "utf8");
    let blockIdx = 0;
    for (const m of html.matchAll(LD_RE)) {
      blocksParsed++;
      const raw = m[1].trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        blocksInvalid++;
        violations.push({ file: rel, pointer: `/script[${blockIdx}]`, field: "(parse)", url: "", reason: "JSON.parse failed" });
        blockIdx++;
        continue;
      }
      walk(rel, parsed, `/script[${blockIdx}]`);
      blockIdx++;
    }
  }
}

console.log(`[check-jsonld-hosts] scanned ${scanned} file(s), parsed ${blocksParsed} JSON-LD block(s) (${blocksInvalid} invalid)`);

if (violations.length > 0) {
  console.error(`\n[check-jsonld-hosts] FAILED — ${violations.length} violation(s):\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file} ${v.pointer} [${v.field}]: ${v.url || "(no value)"}  (${v.reason})`);
  }
  if (violations.length > 50) console.error(`  …and ${violations.length - 50} more`);
  process.exit(1);
}

console.log("[check-jsonld-hosts] OK — all JSON-LD @id / url / mainEntityOfPage hosts match SITE_URL");
