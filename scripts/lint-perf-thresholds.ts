/**
 * Validates `perf-thresholds.json` against the shared zod schema and prints
 * the resolved profile for the active PERF_ENV. Exits non-zero on validation
 * failure so CI can block before the perf smoke test runs.
 *
 * Usage:
 *   PERF_ENV=ci tsx scripts/lint-perf-thresholds.ts
 *   PERF_ENV=ci tsx scripts/lint-perf-thresholds.ts --dry-run
 */
import {
  loadThresholds,
  renderActiveThresholds,
  ThresholdsValidationError,
} from "./lib/perf-thresholds";

const envKey = process.env.PERF_ENV || "default";
const filePath = process.env.PERF_THRESHOLDS_FILE || "perf-thresholds.json";
const dryRun =
  process.argv.includes("--dry-run") || process.env.PERF_DRY_RUN === "1";

try {
  const t = loadThresholds(filePath, envKey);
  console.log(`✅ perf-thresholds.json is valid (${t.thresholdsPath})`);
  if (dryRun) {
    console.log("ℹ dry-run: linted thresholds only, no EXPLAIN executed.");
  }
  console.log("");
  console.log(`▶ Resolved PERF_ENV profile: ${t.envKey}`);
  console.log(`  mean_ms ≤ ${t.mean_ms}`);
  console.log(`  max_ms  ≤ ${t.max_ms}`);
  if (t.queries.length) {
    console.log(`  per-query overrides (${t.queries.length}):`);
    for (const q of t.queries) {
      console.log(
        `    • ${q.label ?? "(unlabeled)"} — match="${q.match}" mean=${q.mean_ms ?? "—"} max=${q.max_ms ?? "—"}`,
      );
    }
  } else {
    console.log("  per-query overrides: (none)");
  }
  console.log("");
  console.log("--- markdown preview ---");
  console.log(renderActiveThresholds(t));
  process.exit(0);
} catch (e) {
  if (e instanceof ThresholdsValidationError) {
    console.error(`❌ ${e.message}`);
  } else {
    console.error(`❌ Unexpected error: ${(e as Error).message}`);
  }
  process.exit(1);
}
