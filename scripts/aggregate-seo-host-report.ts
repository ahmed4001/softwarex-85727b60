/**
 * CI aggregator: run every SEO host gate, capture stdout/stderr,
 * parse violation lines into a unified report, and write:
 *
 *   seo-host-report/report.json   — structured per-gate violations
 *   seo-host-report/report.md     — human-readable summary for PR comments
 *
 * Exit code = bitwise OR of gate exit codes (0 if all passed). The
 * wrapper itself NEVER hides a failing gate — it just makes the set
 * of failures discoverable in one place.
 *
 * Each underlying gate prints violations in a consistent format:
 *
 *   [check-<gate>] FAILED — N violation(s):
 *     <file> [<tag>]: <url>  (<reason>)
 *     <file> [<tag>]: <url>  (<reason>)
 *
 * We parse those lines verbatim — no script changes required.
 *
 * Usage:
 *   SITE_URL=https://example.com tsx scripts/aggregate-seo-host-report.ts
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE_URL = process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com";
const LABEL = process.env.REPORT_LABEL || "default";
const OUT_DIR = resolve("seo-host-report");
mkdirSync(OUT_DIR, { recursive: true });

type Violation = { file: string; tag: string; url: string; reason: string };
type GateResult = {
  gate: string;
  command: string;
  exit_code: number;
  status: "passed" | "failed" | "error";
  violation_count: number;
  violations: Violation[];
  stdout_tail: string;
  stderr_tail: string;
};

const GATES: { name: string; script: string; needsBuild: boolean }[] = [
  { name: "sitemap-hosts",          script: "scripts/check-sitemap-hosts.ts",        needsBuild: false },
  { name: "sitemap-index-hosts",    script: "scripts/check-sitemap-index-hosts.ts",  needsBuild: false },
  { name: "manifest-hosts",         script: "scripts/check-manifest-hosts.ts",       needsBuild: false },
  { name: "prerender-canonicals",   script: "scripts/check-prerender-canonicals.ts", needsBuild: true  },
  { name: "jsonld-hosts",           script: "scripts/check-jsonld-hosts.ts",         needsBuild: true  },
  { name: "social-url-hosts",       script: "scripts/check-social-url-hosts.ts",     needsBuild: true  },
  { name: "social-image-hosts",     script: "scripts/check-social-image-hosts.ts",   needsBuild: true  },
  { name: "hreflang-hosts",         script: "scripts/check-hreflang-hosts.ts",       needsBuild: true  },
];

// Match: "  <file> [<tag>]: <url>  (<reason>)"
// First two whitespace chars are emitted by every gate's violation print loop.
const VIOLATION_RE = /^\s{2,}(\S.*?)\s+\[([^\]]+)\]:\s+(.+?)\s+\(([^)]+)\)\s*$/;

function tail(s: string, lines = 20): string {
  const arr = s.split(/\r?\n/);
  return arr.slice(-lines).join("\n");
}

function runGate(name: string, script: string): GateResult {
  const command = `tsx ${script}`;
  const res = spawnSync("tsx", [script], {
    env: { ...process.env, SITE_URL },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const exit = res.status ?? (res.error ? 2 : 0);
  const combined = (res.stdout || "") + "\n" + (res.stderr || "");
  const violations: Violation[] = [];
  for (const line of combined.split(/\r?\n/)) {
    const m = line.match(VIOLATION_RE);
    if (!m) continue;
    violations.push({ file: m[1].trim(), tag: m[2].trim(), url: m[3].trim(), reason: m[4].trim() });
  }
  let status: GateResult["status"] = "passed";
  if (res.error) status = "error";
  else if (exit !== 0) status = "failed";
  return {
    gate: name,
    command,
    exit_code: exit,
    status,
    violation_count: violations.length,
    violations,
    stdout_tail: tail(res.stdout || ""),
    stderr_tail: tail(res.stderr || ""),
  };
}

const results: GateResult[] = [];
let aggregateExit = 0;
for (const g of GATES) {
  console.log(`\n=== [${LABEL}] running ${g.name} (${g.script}) ===`);
  const r = runGate(g.name, g.script);
  results.push(r);
  aggregateExit |= r.exit_code & 0xff;
  console.log(`=== [${LABEL}] ${g.name}: ${r.status} (exit=${r.exit_code}, violations=${r.violation_count}) ===`);
}

const totalViolations = results.reduce((n, r) => n + r.violation_count, 0);
const failedGates = results.filter((r) => r.status !== "passed");

const report = {
  label: LABEL,
  site_url: SITE_URL,
  generated_at: new Date().toISOString(),
  total_violations: totalViolations,
  failed_gate_count: failedGates.length,
  gates: results,
};
writeFileSync(resolve(OUT_DIR, `report-${LABEL}.json`), JSON.stringify(report, null, 2));

// ---- Markdown summary ----
const md: string[] = [];
md.push(`# SEO host-gate report — \`${LABEL}\``);
md.push("");
md.push(`- **SITE_URL**: \`${SITE_URL}\``);
md.push(`- **Generated**: ${report.generated_at}`);
md.push(`- **Total violations**: ${totalViolations}`);
md.push(`- **Failed gates**: ${failedGates.length} / ${results.length}`);
md.push("");
md.push("## Gate summary");
md.push("");
md.push("| Gate | Status | Exit | Violations |");
md.push("|---|---|---:|---:|");
for (const r of results) {
  const icon = r.status === "passed" ? "✅" : r.status === "failed" ? "❌" : "💥";
  md.push(`| \`${r.gate}\` | ${icon} ${r.status} | ${r.exit_code} | ${r.violation_count} |`);
}
md.push("");

for (const r of results) {
  if (r.violation_count === 0 && r.status === "passed") continue;
  md.push(`## \`${r.gate}\` — ${r.status} (${r.violation_count} violation(s))`);
  md.push("");
  if (r.violation_count > 0) {
    md.push("| File | Tag | URL | Reason |");
    md.push("|---|---|---|---|");
    for (const v of r.violations.slice(0, 100)) {
      md.push(`| \`${v.file}\` | \`${v.tag}\` | \`${v.url}\` | ${v.reason} |`);
    }
    if (r.violation_count > 100) md.push(`\n_…and ${r.violation_count - 100} more violation(s) truncated_`);
    md.push("");
  }
  if (r.status === "error" || (r.violation_count === 0 && r.status === "failed")) {
    md.push("<details><summary>stderr tail</summary>\n\n```\n" + r.stderr_tail + "\n```\n\n</details>");
    md.push("");
  }
}

writeFileSync(resolve(OUT_DIR, `report-${LABEL}.md`), md.join("\n"));

console.log(`\n[aggregate-seo-host-report] wrote ${OUT_DIR}/report-${LABEL}.{json,md}`);
console.log(`[aggregate-seo-host-report] totalViolations=${totalViolations} failedGates=${failedGates.length} aggregateExit=${aggregateExit}`);

process.exit(aggregateExit);
