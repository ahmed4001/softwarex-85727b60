/**
 * Read the latest `perf-smoke-report.json` and suggest mean_ms/max_ms
 * overrides for any breaching hot queries.
 *
 * Adds 20% headroom over observed values and rounds up to the nearest 10ms.
 * Prints a JSON snippet you can paste into the chosen env block's
 * `queries` array, plus a unified diff vs the current thresholds file.
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

// Build merged rules: keyed by label (fall back to match).
const keyOf = (q: { label?: string; match: string }) => q.label ?? q.match;
const merged = new Map<string, any>();
for (const q of current.queries) merged.set(keyOf(q), q);
for (const s of suggestions) merged.set(keyOf(s), s);
const mergedArray = Array.from(merged.values());

// Unified-diff-style preview of the env block's queries array.
const before = JSON.stringify({ queries: current.queries }, null, 2).split("\n");
const after = JSON.stringify({ queries: mergedArray }, null, 2).split("\n");
console.log("\n--- diff (env queries) ---");
for (const line of before) console.log(`- ${line}`);
for (const line of after) console.log(`+ ${line}`);

if (write) {
  const raw = JSON.parse(fs.readFileSync(thresholdsPath, "utf8"));
  if (!raw[current.envKey] || typeof raw[current.envKey] !== "object") {
    console.error(`❌ Cannot write: env block "${current.envKey}" missing.`);
    process.exit(1);
  }
  raw[current.envKey].queries = mergedArray;
  fs.writeFileSync(thresholdsPath, JSON.stringify(raw, null, 2) + "\n");
  console.log(`\n✅ Wrote ${mergedArray.length} rules into ${current.envKey}.queries`);
} else {
  console.log("\n(Pass --write to merge into perf-thresholds.json)");
}
