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
import { KNOWN_GATES, type GateReport, type Violation } from "./lib/seo-hosts";

const SITE_URL = process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com";
const LABEL = process.env.REPORT_LABEL || "default";
const REPORT_DIR = resolve(process.env.SEO_REPORT_DIR || "seo-host-report");
const REUSE = process.env.SEO_REUSE_REPORTS === "1" || process.env.SEO_REUSE_REPORTS === "true";

const ALL_GATES: { name: string; script: string }[] = [
  { name: "sitemap-hosts",        script: "scripts/check-sitemap-hosts.ts" },
  { name: "sitemap-index-hosts",  script: "scripts/check-sitemap-index-hosts.ts" },
  { name: "manifest-hosts",       script: "scripts/check-manifest-hosts.ts" },
  { name: "prerender-canonicals", script: "scripts/check-prerender-canonicals.ts" },
  { name: "jsonld-hosts",         script: "scripts/check-jsonld-hosts.ts" },
  { name: "social-url-hosts",     script: "scripts/check-social-url-hosts.ts" },
  { name: "social-image-hosts",   script: "scripts/check-social-image-hosts.ts" },
  { name: "hreflang-hosts",       script: "scripts/check-hreflang-hosts.ts" },
];

// ----- CLI parsing -----
//   --gate <name>      Run/aggregate just one gate and exit with its status.
//                      Equivalent env var: SEO_ONLY_GATE=<name>
//   --list-gates       Print the known gate names and exit.
//   --help / -h        Print usage and exit.
const argv = process.argv.slice(2);
function takeFlag(name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  return undefined;
}
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`Usage: tsx scripts/aggregate-seo-host-report.ts [--gate <name>] [--list-gates]

Modes:
  default   Run/aggregate all SEO host gates.
  --gate    Run/aggregate just one gate (great for local debugging).
            Equivalent env var: SEO_ONLY_GATE=<name>.

Other env:
  SEO_REUSE_REPORTS=1   Reuse per-gate <gate>.json under SEO_REPORT_DIR.
  SEO_REPORT_DIR=<dir>  Where per-gate + aggregated reports are written.
  SITE_URL=<url>        Expected host base for all gates.
  REPORT_LABEL=<label>  Filename suffix for the aggregated report.

Known gates:
  ${KNOWN_GATES.join("\n  ")}
`);
  process.exit(0);
}
if (argv.includes("--list-gates")) {
  for (const g of ALL_GATES) console.log(g.name);
  process.exit(0);
}
const onlyGate = takeFlag("--gate") || process.env.SEO_ONLY_GATE || null;
const GATES = onlyGate ? ALL_GATES.filter((g) => g.name === onlyGate) : ALL_GATES;
if (onlyGate && GATES.length === 0) {
  console.error(`[aggregate-seo-host-report] unknown gate "${onlyGate}". Known gates:\n  ${ALL_GATES.map((g) => g.name).join("\n  ")}`);
  process.exit(2);
}

mkdirSync(REPORT_DIR, { recursive: true });
if (onlyGate) console.log(`[aggregate-seo-host-report] single-gate mode → ${onlyGate}`);

type LoadedGate = {
  gate: string;
  source: "reused" | "spawned" | "missing";
  exit_code: number;
  violation_count: number;
  filtered_out_count: number;
  violations: Violation[];
  /** Per-entry usage stats lifted from the gate's JSON report. */
  allowlist_entries: { entry: string; source: string }[];
  allowlist_match_counts: Record<string, number>;
  allowlist_unused: string[];
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
    allowlist_entries: report?.allowlist_entries ?? [],
    allowlist_match_counts: report?.allowlist_match_counts ?? {},
    allowlist_unused: report?.allowlist_unused ?? [],
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
      entry = {
        gate: g.name, source: "missing", exit_code: 0,
        violation_count: 0, filtered_out_count: 0, violations: [],
        allowlist_entries: [], allowlist_match_counts: {}, allowlist_unused: [],
      };
    } else {
      entry = {
        gate: g.name,
        source: "reused",
        exit_code: r.violations.length > 0 ? 1 : 0,
        violation_count: r.violations.length,
        filtered_out_count: r.filtered_out.length,
        violations: r.violations,
        allowlist_entries: r.allowlist_entries ?? [],
        allowlist_match_counts: r.allowlist_match_counts ?? {},
        allowlist_unused: r.allowlist_unused ?? [],
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

// Aggregate allowlist usage across gates so the markdown can show
// "this CDN matched on 12 violations across 3 gates" and
// "these entries never matched — consider removing".
type UsageRow = { entry: string; sources: Set<string>; gates: Set<string>; matches: number };
const usedMap = new Map<string, UsageRow>();
const unusedMap = new Map<string, UsageRow>();
function bump(map: Map<string, UsageRow>, entry: string, gate: string, src: string, matches: number) {
  const row = map.get(entry) ?? { entry, sources: new Set(), gates: new Set(), matches: 0 };
  row.sources.add(src);
  row.gates.add(gate);
  row.matches += matches;
  map.set(entry, row);
}
for (const g of loaded) {
  for (const e of g.allowlist_entries) {
    const count = g.allowlist_match_counts[e.entry] ?? 0;
    if (count > 0) bump(usedMap, e.entry, g.gate, e.source, count);
    else if (g.allowlist_unused.includes(e.entry)) bump(unusedMap, e.entry, g.gate, e.source, 0);
  }
}
const usedRows = [...usedMap.values()].sort((a, b) => b.matches - a.matches || a.entry.localeCompare(b.entry));
// If the same entry shows up as used AND unused across different gates, only list it once in "used".
for (const e of usedMap.keys()) unusedMap.delete(e);
const unusedRows = [...unusedMap.values()].sort((a, b) => a.entry.localeCompare(b.entry));

const report = {
  label: LABEL,
  site_url: SITE_URL,
  mode: REUSE ? "reuse" : "spawn",
  generated_at: new Date().toISOString(),
  total_violations: totalViolations,
  total_filtered_by_allowlist: totalFiltered,
  failed_gate_count: failedGates.length,
  allowlist_usage: {
    used: usedRows.map((r) => ({ entry: r.entry, sources: [...r.sources], gates: [...r.gates], matches: r.matches })),
    unused: unusedRows.map((r) => ({ entry: r.entry, sources: [...r.sources], gates: [...r.gates] })),
  },
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

// Allowlist usage — two tables: matched-at-least-once vs. unused.
md.push("## Allowlist usage");
md.push("");
if (usedRows.length === 0 && unusedRows.length === 0) {
  md.push("_No allowlist entries configured._");
  md.push("");
} else {
  md.push("### Matched at least once");
  md.push("");
  if (usedRows.length === 0) {
    md.push("_No allowlist entries matched anything this run._");
  } else {
    md.push("| Entry | Matches | Gates | Source(s) |");
    md.push("|---|---:|---|---|");
    for (const r of usedRows) {
      md.push(`| \`${r.entry}\` | ${r.matches} | ${[...r.gates].sort().join(", ")} | ${[...r.sources].sort().join(", ")} |`);
    }
  }
  md.push("");
  md.push("### Unused — consider removing");
  md.push("");
  if (unusedRows.length === 0) {
    md.push("_Every configured allowlist entry was exercised this run. Nice._");
  } else {
    md.push("| Entry | Configured in | Source(s) |");
    md.push("|---|---|---|");
    for (const r of unusedRows) {
      md.push(`| \`${r.entry}\` | ${[...r.gates].sort().join(", ")} | ${[...r.sources].sort().join(", ")} |`);
    }
  }
  md.push("");
}

for (const g of loaded) {
  if (g.violation_count === 0) continue;
  md.push(`## \`${g.gate}\` — ${g.violation_count} violation(s)`);
  md.push("");
  md.push("| File | Line | Tag | URL | Reason | Snippet |");
  md.push("|---|---:|---|---|---|---|");
  for (const v of g.violations.slice(0, 100)) {
    const line = v.line ?? "";
    const snip = (v.snippet ?? "").slice(0, 200);
    md.push(`| \`${v.workspacePath ?? v.file}\` | ${line} | \`${v.tag}\` | \`${v.url}\` | ${v.reason} | ${snip ? `\`${snip}\`` : ""} |`);
  }
  if (g.violation_count > 100) md.push(`\n_…and ${g.violation_count - 100} more violation(s) truncated_`);
  md.push("");
}

writeFileSync(join(REPORT_DIR, `report-${LABEL}.md`), md.join("\n"));

console.log(`\n[aggregate-seo-host-report] wrote ${REPORT_DIR}/report-${LABEL}.{json,md}`);
console.log(`[aggregate-seo-host-report] totalViolations=${totalViolations} filtered=${totalFiltered} failedGates=${failedGates.length} aggregateExit=${aggregateExit}`);
console.log(`[aggregate-seo-host-report] allowlist usage: ${usedRows.length} matched, ${unusedRows.length} unused`);

process.exit(aggregateExit);
