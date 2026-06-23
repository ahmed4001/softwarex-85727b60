/**
 * Read the latest `perf-smoke-report.json` and suggest mean_ms/max_ms
 * overrides for any breaching hot queries.
 *
 * Adds 20% headroom over observed values, rounded up to the nearest 10ms.
 * Prints a JSON snippet plus a unified diff vs the current thresholds file.
 *
 * Usage:
 *   PERF_ENV=production tsx scripts/suggest-perf-thresholds.ts
 *   PERF_ENV=production tsx scripts/suggest-perf-thresholds.ts --write
 *
 * Env:
 *   PERF_REPORT_FILE       (default ./perf-smoke-report/perf-smoke-report.json)
 *   PERF_THRESHOLDS_FILE   (default ./perf-thresholds.json)
 *   PERF_ENV               (default "default")
 */
import fs from "node:fs";
import path from "node:path";
import {
  loadThresholds,
  suggestRule,
  mergeSuggestions,
  unifiedDiff,
  type SuggestedRule,
} from "./lib/perf-thresholds";

const reportPath = path.resolve(
  process.env.PERF_REPORT_FILE || "perf-smoke-report/perf-smoke-report.json",
);
const thresholdsPath = path.resolve(
  process.env.PERF_THRESHOLDS_FILE || "perf-thresholds.json",
);
const envKey = process.env.PERF_ENV || "default";
const write = process.argv.includes("--write");
const pctArg = process.argv.find((a) => a.startsWith("--max-change-pct="));
const maxChangePct = pctArg
  ? Number(pctArg.split("=")[1])
  : process.env.PERF_MAX_CHANGE_PCT
    ? Number(process.env.PERF_MAX_CHANGE_PCT)
    : undefined;

if (!fs.existsSync(reportPath)) {
  console.error(`❌ Report not found: ${reportPath}`);
  console.error("   Run `bun run test:perf` first or set PERF_REPORT_FILE.");
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const failures: any[] = Array.isArray(report?.threshold_failures)
  ? report.threshold_failures
  : [];

if (!failures.length) {
  console.log("✅ No breaching queries in report — nothing to suggest.");
  process.exit(0);
}

const current = loadThresholds(thresholdsPath, envKey);

const suggestions: SuggestedRule[] = failures.map((f) =>
  suggestRule({
    matched_rule: f.matched_rule && f.matched_rule !== null ? f.matched_rule : undefined,
    query_preview: String(f.query_preview ?? ""),
    mean_ms: Number(f.mean_ms),
    max_ms: Number(f.max_ms),
  }),
);

console.log(`▶ Suggestions for PERF_ENV=${current.envKey} (${suggestions.length} queries):\n`);
console.log(JSON.stringify({ queries: suggestions }, null, 2));

const merge = mergeSuggestions(thresholdsPath, current.envKey, suggestions, { write, maxChangePct });
console.log("\n--- unified diff ---");
console.log(unifiedDiff(merge.before, merge.after, "perf-thresholds.json"));

if (merge.clamped.length) {
  console.log(`\n⚠ Clamped ${merge.clamped.length} value(s) to ±${maxChangePct}% per run:`);
  for (const c of merge.clamped) {
    console.log(`   • ${c.label}.${c.field}: ${c.previous} → requested ${c.requested}, applied ${c.applied}`);
  }
}

if (write) {
  console.log(
    `\n✅ Wrote ${merge.mergedCount} rules into ${current.envKey}.queries ` +
      `(${merge.added.length} added, ${merge.replaced.length} replaced)`,
  );
} else {
  console.log(`\n(Pass --write to merge into perf-thresholds.json${maxChangePct ? `; current cap ±${maxChangePct}%` : ""})`);
}
