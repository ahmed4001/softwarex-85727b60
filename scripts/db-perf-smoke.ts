/**
 * Automated database performance smoke test.
 *
 * Invokes the `db-perf-smoke` edge function and exits non-zero when:
 *   - any required hot-table index is missing, or
 *   - any top hot query exceeds the mean/max execution-time thresholds.
 *
 * Thresholds come from `perf-thresholds.json` (or the path in PERF_THRESHOLDS_FILE).
 * Pick an environment block with `PERF_ENV=<key>` (defaults to `default`).
 *
 * Usage:
 *   PERF_ENV=ci tsx scripts/db-perf-smoke.ts
 *
 * Env:
 *   VITE_SUPABASE_URL              (required)
 *   VITE_SUPABASE_PUBLISHABLE_KEY  (required — Authorization bearer)
 *   PERF_ENV                       (optional — config key, default "default")
 *   PERF_THRESHOLDS_FILE           (optional — path to JSON, default ./perf-thresholds.json)
 */

import fs from "node:fs";
import path from "node:path";

const url = process.env.VITE_SUPABASE_URL;
const anon =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY env vars");
  process.exit(2);
}

const envKey = process.env.PERF_ENV || "default";
const thresholdsPath = path.resolve(
  process.env.PERF_THRESHOLDS_FILE || "perf-thresholds.json",
);

let mean_ms = 200;
let max_ms = 800;
try {
  const cfg = JSON.parse(fs.readFileSync(thresholdsPath, "utf8"));
  const block = cfg[envKey] ?? cfg.default;
  if (!block) throw new Error(`No "${envKey}" or "default" block in ${thresholdsPath}`);
  if (typeof block.mean_ms === "number") mean_ms = block.mean_ms;
  if (typeof block.max_ms === "number") max_ms = block.max_ms;
  console.log(`▶ thresholds [${envKey}] mean≤${mean_ms}ms max≤${max_ms}ms (from ${thresholdsPath})`);
} catch (e) {
  console.warn(`⚠ Could not load thresholds (${e}); using defaults mean≤${mean_ms} max≤${max_ms}`);
}

const endpoint = `${url}/functions/v1/db-perf-smoke`;

(async () => {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anon}`,
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mean_ms, max_ms }),
  });



  const body = await res.json().catch(() => ({}));
  const pretty = JSON.stringify(body, null, 2);

  // Persist full report for CI artifact upload / PR-comment step.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const outDir = process.env.PERF_REPORT_DIR || ".";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "perf-smoke-report.json"), pretty);

  // Markdown summary used by the PR-comment step.
  const lines: string[] = [];
  const passed = res.status === 200 && body?.pass;
  lines.push(`### ${passed ? "✅" : "❌"} db-perf-smoke ${passed ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push(
    `Thresholds: mean ≤ **${body?.thresholds?.mean_ms ?? "?"} ms**, max ≤ **${body?.thresholds?.max_ms ?? "?"} ms**`,
  );
  if (Array.isArray(body?.missing_indexes) && body.missing_indexes.length) {
    lines.push("", "**Missing indexes**");
    for (const i of body.missing_indexes) lines.push(`- \`${i}\``);
  }
  if (Array.isArray(body?.threshold_failures) && body.threshold_failures.length) {
    lines.push("", "**Breaching hot queries**", "");
    lines.push("| mode | mean (ms) | max (ms) | calls | query |");
    lines.push("|---|---:|---:|---:|---|");
    for (const q of body.threshold_failures) {
      const preview = String(q.query_preview ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const mode = String(q.explain_mode ?? "ANALYZE").split(" ")[0];
      lines.push(`| ${mode} | ${q.mean_ms} | ${q.max_ms} | ${q.calls} | \`${preview}\` |`);
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
    console.error(
      `Queries over thresholds (mean>${body?.thresholds?.mean_ms}ms or max>${body?.thresholds?.max_ms}ms):`,
    );
    for (const q of body.threshold_failures) {
      console.error(
        `\n  • mean=${q.mean_ms}ms max=${q.max_ms}ms calls=${q.calls}\n    ${q.query_preview}`,
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
