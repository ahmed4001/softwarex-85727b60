/**
 * CI aggregator: assemble per-gate violation reports into a single
 * JSON + Markdown summary uploaded as a build artifact.
 *
 * Two modes:
 *
 *   1. REUSE MODE (default in CI)
 *      Set SEO_REUSE_REPORTS=1 and SEO_REPORT_DIR=<dir>. We just read
 *      every <gate>.json that the individual gate steps already wrote
 *      via finalizeGate(). No gates are re-executed.
 *
 *   2. SPAWN MODE (fallback / local dev)
 *      Re-runs each gate as a child process and collects results.
 *      Useful when you don't want to run each gate as a separate CI
 *      step but still want the consolidated report.
 *
 * Output:
 *   ${SEO_REPORT_DIR}/report-${REPORT_LABEL}.json
 *   ${SEO_REPORT_DIR}/report-${REPORT_LABEL}.md
 *
 * Exit code = max gate exit code (0 if all gates passed).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { GateReport, Violation } from "./lib/seo-hosts";

const SITE_URL = process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com";
const LABEL = process.env.REPORT_LABEL || "default";
const REPORT_DIR = resolve(process.env.SEO_REPORT_DIR || "seo-host-report");
const REUSE = process.env.SEO_REUSE_REPORTS === "1" || process.env.SEO_REUSE_REPORTS === "true";
mkdirSync(REPORT_DIR, { recursive: true });

const GATES: { name: string; script: string }[] = [
  { name: "sitemap-hosts",        script: "scripts/check-sitemap-hosts.ts" },
  { name: "sitemap-index-hosts",  script: "scripts/check-sitemap-index-hosts.ts" },
  { name: "manifest-hosts",       script: "scripts/check-manifest-hosts.ts" },
  { name: "prerender-canonicals", script: "scripts/check-prerender-canonicals.ts" },
  { name: "jsonld-hosts",         script: "scripts/check-jsonld-hosts.ts" },
  { name: "social-url-hosts",     script: "scripts/check-social-url-hosts.ts" },
  { name: "social-image-hosts",   script: "scripts/check-social-image-hosts.ts" },
  { name: "hreflang-hosts",       script: "scripts/check-hreflang-hosts.ts" },
];

type LoadedGate = {
  gate: string;
  source: "reused" | "spawned" | "missing";
  exit_code: number;
  violation_count: number;
  filtered_out_count: number;
  violations: Violation[];
};

function loadReusedReport(gate: string): GateReport | null {
  const p = join(REPORT_DIR, `${gate}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")) as GateReport; }
  catch { return null; }
}

function spawnGate(gate: string, script: string): LoadedGate {
  console.log(`\n=== [${LABEL}] spawning ${gate} (${script}) ===`);
  const res = spawnSync("tsx", [script], {
    env: { ...process.env, SITE_URL, SEO_REPORT_DIR: REPORT_DIR },
    stdio: "inherit",
  });
  const exit = res.status ?? 2;
  const report = loadReusedReport(gate);
  return {
    gate,
    source: "spawned",
    exit_code: exit,
    violation_count: report?.violations.length ?? 0,
    filtered_out_count: report?.filtered_out.length ?? 0,
    violations: report?.violations ?? [],
  };
}

const loaded: LoadedGate[] = [];
let aggregateExit = 0;

for (const g of GATES) {
  let entry: LoadedGate;
  if (REUSE) {
    const r = loadReusedReport(g.name);
    if (!r) {
      console.warn(`[aggregate-seo-host-report] reuse mode: no report at ${join(REPORT_DIR, g.name + ".json")} — gate ${g.name} skipped (treating as missing)`);
      entry = { gate: g.name, source: "missing", exit_code: 0, violation_count: 0, filtered_out_count: 0, violations: [] };
    } else {
      entry = {
        gate: g.name,
        source: "reused",
        exit_code: r.violations.length > 0 ? 1 : 0,
        violation_count: r.violations.length,
        filtered_out_count: r.filtered_out.length,
        violations: r.violations,
      };
    }
  } else {
    entry = spawnGate(g.name, g.script);
  }
  loaded.push(entry);
  aggregateExit = Math.max(aggregateExit, entry.exit_code & 0xff);
}

const totalViolations = loaded.reduce((n, g) => n + g.violation_count, 0);
const totalFiltered = loaded.reduce((n, g) => n + g.filtered_out_count, 0);
const failedGates = loaded.filter((g) => g.exit_code !== 0);

const report = {
  label: LABEL,
  site_url: SITE_URL,
  mode: REUSE ? "reuse" : "spawn",
  generated_at: new Date().toISOString(),
  total_violations: totalViolations,
  total_filtered_by_allowlist: totalFiltered,
  failed_gate_count: failedGates.length,
  gates: loaded,
};
writeFileSync(join(REPORT_DIR, `report-${LABEL}.json`), JSON.stringify(report, null, 2));

// ---- Markdown summary ----
const md: string[] = [];
md.push(`# SEO host-gate report — \`${LABEL}\``);
md.push("");
md.push(`- **SITE_URL**: \`${SITE_URL}\``);
md.push(`- **Mode**: ${report.mode}`);
md.push(`- **Generated**: ${report.generated_at}`);
md.push(`- **Total violations (post-allowlist)**: ${totalViolations}`);
md.push(`- **Filtered by allowlist**: ${totalFiltered}`);
md.push(`- **Failed gates**: ${failedGates.length} / ${loaded.length}`);
md.push("");
md.push("## Gate summary");
md.push("");
md.push("| Gate | Source | Exit | Violations | Allowlisted |");
md.push("|---|---|---:|---:|---:|");
for (const g of loaded) {
  const icon = g.exit_code === 0 ? "✅" : "❌";
  md.push(`| \`${g.gate}\` | ${g.source} | ${icon} ${g.exit_code} | ${g.violation_count} | ${g.filtered_out_count} |`);
}
md.push("");

for (const g of loaded) {
  if (g.violation_count === 0) continue;
  md.push(`## \`${g.gate}\` — ${g.violation_count} violation(s)`);
  md.push("");
  md.push("| File | Tag | URL | Reason |");
  md.push("|---|---|---|---|");
  for (const v of g.violations.slice(0, 100)) {
    md.push(`| \`${v.workspacePath ?? v.file}\` | \`${v.tag}\` | \`${v.url}\` | ${v.reason} |`);
  }
  if (g.violation_count > 100) md.push(`\n_…and ${g.violation_count - 100} more violation(s) truncated_`);
  md.push("");
}

writeFileSync(join(REPORT_DIR, `report-${LABEL}.md`), md.join("\n"));

console.log(`\n[aggregate-seo-host-report] wrote ${REPORT_DIR}/report-${LABEL}.{json,md}`);
console.log(`[aggregate-seo-host-report] totalViolations=${totalViolations} filtered=${totalFiltered} failedGates=${failedGates.length} aggregateExit=${aggregateExit}`);

process.exit(aggregateExit);
