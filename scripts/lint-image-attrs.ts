#!/usr/bin/env tsx
/**
 * CI lint: every <img> in src/**\/*.tsx must have:
 *   - an `alt` attribute (any value, including "")
 *   - a `loading` attribute (or be explicitly marked eager via fetchpriority)
 *   - a `decoding` attribute
 *
 * Exits non-zero on any violation, with file:line for each offender.
 *
 * Run via `npm run lint:images`. CI wires this into the build gate.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const EXTS = new Set([".tsx", ".jsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, out);
    } else if ([...EXTS].some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

interface Violation {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

const IMG_RE = /<img\b[^>]*?>/gms;

function check(file: string): Violation[] {
  const src = readFileSync(file, "utf8");
  const violations: Violation[] = [];
  let m: RegExpExecArray | null;
  while ((m = IMG_RE.exec(src)) !== null) {
    const tag = m[0];
    // Skip when alt/loading/decoding come from spread props (heuristic).
    const hasSpread = /\{\.\.\.\w+/.test(tag);
    if (hasSpread) continue;

    const missing: string[] = [];
    if (!/\balt\s*=/.test(tag)) missing.push("alt");
    if (!/\bloading\s*=/.test(tag) && !/fetchpriority\s*=\s*["']?high/.test(tag)) {
      missing.push("loading");
    }
    if (!/\bdecoding\s*=/.test(tag)) missing.push("decoding");

    if (missing.length) {
      const before = src.slice(0, m.index);
      const line = before.split("\n").length;
      violations.push({
        file: relative(process.cwd(), file),
        line,
        snippet: tag.replace(/\s+/g, " ").slice(0, 140),
        reason: `missing ${missing.join(", ")}`,
      });
    }
  }
  return violations;
}

const all: Violation[] = [];
for (const f of walk(ROOT)) all.push(...check(f));

if (all.length) {
  console.error(`\n✗ Image attribute lint: ${all.length} violation(s)\n`);
  for (const v of all) {
    console.error(`  ${v.file}:${v.line}  [${v.reason}]\n    ${v.snippet}`);
  }
  console.error("\nEvery <img> needs alt, loading, and decoding attributes.");
  console.error("Use loading=\"eager\" + fetchpriority=\"high\" for above-the-fold images.\n");
  process.exit(1);
}
console.log("✓ All <img> tags have alt + loading + decoding attributes.");
