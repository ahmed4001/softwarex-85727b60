/**
 * CI gate: validate seo-host-allowlist.json before any SEO host check
 * runs. Lets the workflow fail fast with annotated, file-pinned errors
 * instead of every downstream host gate exploding with the same
 * AllowlistConfigError trace.
 *
 * Validation layers:
 *   1. JSON parses
 *   2. Project's own validator (validateAllowlistConfig — strict gate
 *      keys, wildcard rules, no schemes/ports/paths, no empty entries)
 *   3. JSON Schema (seo-host-allowlist.schema.json) via Ajv, when the
 *      schema file exists. Catches structural drift between the JSON
 *      and the schema that ships to editors.
 *
 * On failure: writes one `::error file=…,line=…` workflow command per
 * problem so the GitHub PR shows each error on its own line.
 *
 * Usage:
 *   bun run validate:seo-host-allowlist
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { validateAllowlistConfig, KNOWN_GATES } from "./lib/seo-hosts";

const ALLOWLIST = resolve("seo-host-allowlist.json");
const SCHEMA = resolve("seo-host-allowlist.schema.json");
const IN_CI = process.env.GITHUB_ACTIONS === "true" || process.env.GITHUB_ACTIONS === "1";

type FoundError = { line: number; message: string };
const errors: FoundError[] = [];

function annotate(message: string, line = 1) {
  if (!IN_CI) return;
  const safe = (s: string) =>
    s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/:/g, "%3A").replace(/,/g, "%2C");
  console.log(`::error file=seo-host-allowlist.json,line=${line},title=${safe("SEO host allowlist invalid")}::${safe(message)}`);
}

if (!existsSync(ALLOWLIST)) {
  console.log("[validate-seo-host-allowlist] OK — seo-host-allowlist.json not present, nothing to validate");
  process.exit(0);
}

const raw = readFileSync(ALLOWLIST, "utf8");
const lines = raw.split(/\r?\n/);
function lineForKey(key: string): number {
  const idx = lines.findIndex((l) => l.includes(`"${key}"`));
  return idx >= 0 ? idx + 1 : 1;
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  const msg = (e as Error).message;
  // node's JSON.parse "at position N" → line/column
  const m = msg.match(/position\s+(\d+)/i);
  let line = 1;
  if (m) {
    const pos = Number(m[1]);
    line = raw.slice(0, pos).split(/\r?\n/).length;
  }
  errors.push({ line, message: `invalid JSON — ${msg}` });
}

if (parsed !== undefined) {
  // Layer 2: project validator.
  for (const err of validateAllowlistConfig(parsed)) {
    const keyMatch = err.match(/^(?:key\s+"|unknown gate key\s+"|([^[:]+))(?:")?([^"\]]+)?/);
    let line = 1;
    // Try "key[i]" or "key" prefix.
    const km = err.match(/^([A-Za-z_$][\w-]*)/);
    if (km) line = lineForKey(km[1]);
    const uk = err.match(/unknown gate key "([^"]+)"/);
    if (uk) line = lineForKey(uk[1]);
    errors.push({ line, message: err });
  }

  // Layer 3: JSON Schema (advisory but enforced if schema exists).
  if (existsSync(SCHEMA) && errors.length === 0) {
    try {
      const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
      const ajv = new Ajv({ allErrors: true, strict: false });
      const validate = ajv.compile(schema);
      if (!validate(parsed)) {
        for (const e of validate.errors ?? []) {
          const path = e.instancePath || "(root)";
          const keyHint = (e.instancePath || "").split("/").filter(Boolean)[0];
          const line = keyHint ? lineForKey(keyHint) : 1;
          errors.push({ line, message: `JSON Schema: ${path} ${e.message ?? ""}`.trim() });
        }
      }
    } catch (e) {
      errors.push({ line: 1, message: `failed to load JSON Schema: ${(e as Error).message}` });
    }
  }
}

if (errors.length === 0) {
  console.log(`[validate-seo-host-allowlist] OK — seo-host-allowlist.json valid (known gates: ${KNOWN_GATES.join(", ")})`);
  process.exit(0);
}

console.error(`[validate-seo-host-allowlist] FAILED — ${errors.length} problem(s) in seo-host-allowlist.json:`);
for (const e of errors) {
  console.error(`  line ${e.line}: ${e.message}`);
  annotate(e.message, e.line);
}
process.exit(1);
