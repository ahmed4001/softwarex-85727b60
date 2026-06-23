/**
 * Automated database performance smoke test.
 *
 * Invokes the `db-perf-smoke` edge function and exits non-zero when:
 *   - any required hot-table index is missing, or
 *   - any top hot query exceeds the mean/max execution-time thresholds
 *     (using per-query overrides when configured).
 *
 * Thresholds come from `perf-thresholds.json` (or PERF_THRESHOLDS_FILE),
 * validated via zod. Pick an env with `PERF_ENV=<key>`.
 *
 * Env:
 *   VITE_SUPABASE_URL              (required)
 *   VITE_SUPABASE_PUBLISHABLE_KEY  (required — Authorization bearer)
 *   PERF_ENV                       (optional — config key, default "default")
 *   PERF_THRESHOLDS_FILE           (optional — default ./perf-thresholds.json)
 *   PERF_REPORT_DIR                (optional — artifact dir, default ".")
 */

import fs from "node:fs";
import path from "node:path";
import {
  loadThresholds,
  loadBaseThresholds,
  renderActiveThresholds,
  diffThresholds,
  ThresholdsValidationError,
} from "./lib/perf-thresholds";

const url = process.env.VITE_SUPABASE_URL;
const anon =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY env vars");
  process.exit(2);
}

const envKey = process.env.PERF_ENV || "default";
const thresholdsFile = process.env.PERF_THRESHOLDS_FILE || "perf-thresholds.json";

let thresholds;
try {
  thresholds = loadThresholds(thresholdsFile, envKey);
} catch (e) {
  if (e instanceof ThresholdsValidationError) {
    console.error("━━━ perf-thresholds.json validation failed ━━━");
    console.error(e.message);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } else {
    console.error("Unexpected error loading thresholds:", e);
  }
  process.exit(2);
}

console.log(
  `▶ thresholds [${thresholds.envKey}] mean≤${thresholds.mean_ms}ms max≤${thresholds.max_ms}ms` +
    (thresholds.queries.length ? ` (+${thresholds.queries.length} per-query rules)` : "") +
    ` (from ${thresholds.thresholdsPath})`,
);

const endpoint = `${url}/functions/v1/db-perf-smoke`;

(async () => {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anon}`,
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mean_ms: thresholds.mean_ms,
      max_ms: thresholds.max_ms,
      queries: thresholds.queries,
    }),
  });

  const body = await res.json().catch(() => ({}));
  const pretty = JSON.stringify(body, null, 2);

  const outDir = process.env.PERF_REPORT_DIR || ".";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "perf-smoke-report.json"), pretty);

  // Markdown summary used by the PR-comment step.
  const lines: string[] = [];
  const passed = res.status === 200 && body?.pass;
  lines.push(`### ${passed ? "✅" : "❌"} db-perf-smoke ${passed ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push(renderActiveThresholds(thresholds));

  const baseT = loadBaseThresholds(thresholds.envKey);
  const diff = diffThresholds(baseT, thresholds);
  if (diff) {
    lines.push("", diff);
  }

  if (Array.isArray(body?.missing_indexes) && body.missing_indexes.length) {
    lines.push("", "**Missing indexes**");
    for (const i of body.missing_indexes) lines.push(`- \`${i}\``);
  }
  if (Array.isArray(body?.threshold_failures) && body.threshold_failures.length) {
    lines.push("", "**Breaching hot queries**", "");
    lines.push("| rule | mode | mean (ms) | max (ms) | applied mean | applied max | calls | query |");
    lines.push("|---|---|---:|---:|---:|---:|---:|---|");
    for (const q of body.threshold_failures) {
      const preview = String(q.query_preview ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const mode = String(q.explain_mode ?? "ANALYZE").split(" ")[0];
      const ruleLabel = q.matched_rule && q.matched_rule !== null
        ? (q.matched_rule.label ?? q.matched_rule.match ?? "match")
        : "(env default)";
      lines.push(
        `| ${ruleLabel} | ${mode} | ${q.mean_ms} | ${q.max_ms} | ${q.applied_mean_ms ?? thresholds.mean_ms} | ${q.applied_max_ms ?? thresholds.max_ms} | ${q.calls} | \`${preview}\` |`,
      );
    }
    lines.push("");
    lines.push(
      "Full `EXPLAIN (ANALYZE, BUFFERS)` plans (with GENERIC_PLAN fallback for parameterized queries) are in the **`perf-smoke-report`** artifact attached to this run.",
    );
  }
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
    const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    lines.push("", `[View full CI logs ↗](${runUrl})`);
  }
  fs.writeFileSync(path.join(outDir, "perf-smoke-summary.md"), lines.join("\n"));

  if (passed) {
    console.log("✅ db-perf-smoke PASS");
    console.log(pretty);
    process.exit(0);
  }

  console.error(`❌ db-perf-smoke FAIL (HTTP ${res.status})`);
  if (Array.isArray(body?.missing_indexes) && body.missing_indexes.length) {
    console.error("Missing indexes:", body.missing_indexes);
  }
  if (Array.isArray(body?.threshold_failures) && body.threshold_failures.length) {
    console.error("Breaching queries:");
    for (const q of body.threshold_failures) {
      const ruleLabel = q.matched_rule && q.matched_rule !== null
        ? (q.matched_rule.label ?? q.matched_rule.match)
        : "(env default)";
      console.error(
        `\n  • [${ruleLabel}] mean=${q.mean_ms}ms (≤${q.applied_mean_ms}) max=${q.max_ms}ms (≤${q.applied_max_ms}) calls=${q.calls}\n    ${q.query_preview}`,
      );
      if (q.explain) {
        const indented = String(q.explain)
          .split("\n")
          .map((l: string) => "      " + l)
          .join("\n");
        console.error(`    EXPLAIN (${q.explain_mode ?? "ANALYZE"}, BUFFERS):`);
        console.error(indented);
      }
    }
  }
  console.error(pretty);
  process.exit(1);
})();
