/**
 * Automated database performance smoke test.
 *
 * Invokes the `db-perf-smoke` edge function and exits non-zero when:
 *   - any required hot-table index is missing,
 *   - any top hot query exceeds the mean/max execution-time thresholds, or
 *   - PERF_COVERAGE_STRICT=1 and a hot query has no matching threshold rule.
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
 *   PERF_COVERAGE_STRICT           (optional — "1" to fail on uncovered queries)
 *   PERF_APPLY_SUGGESTIONS         (optional — "1" to write suggestions back)
 */

import fs from "node:fs";
import path from "node:path";
import {
  loadLayeredThresholds,
  resolveThresholdsLayers,
  loadBaseThresholds,
  renderActiveThresholds,
  diffThresholds,
  bumpThreshold,
  queryId,
  findUncovered,
  mergeSuggestions,
  suggestRule,
  unifiedDiff,
  renderHtmlReport,
  buildAnnotations,
  formatAnnotation,
  ThresholdsValidationError,
  type SuggestedRule,
} from "./lib/perf-thresholds";
import { buildPrComment } from "./lib/perf-pr-comment";

function loadLocalEnvFallback(keys: string[], file = ".env") {
  if (!fs.existsSync(file)) return;

  const wanted = new Set(keys);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!wanted.has(key) || process.env[key]) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnvFallback([
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
]);

const url = process.env.VITE_SUPABASE_URL;
const anon =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  const missing: string[] = [];
  if (!url) missing.push("VITE_SUPABASE_URL");
  if (!anon) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");

  console.error(
    [
      `Missing required env var(s): ${missing.join(", ")}.`,
      "",
      "These normally come from GitHub Actions repository secrets of the same name,",
      "or from the generated .env file when it is available in CI.",
      "Fix: open the repo on GitHub → Settings → Secrets and variables → Actions →",
      "  New repository secret, and add the missing value(s):",
      "    • VITE_SUPABASE_URL              (your Lovable Cloud project URL)",
      "    • VITE_SUPABASE_PUBLISHABLE_KEY  (your publishable / anon key)",
      "Both values are publishable (the anon key already ships in the frontend bundle).",
      "Then re-run the failed workflow.",
    ].join("\n"),
  );

  // GitHub Actions annotation — shows up as a clickable error on the PR.
  if (process.env.GITHUB_ACTIONS === "true") {
    const title = "db-perf-smoke: missing GitHub Actions secret";
    const msg =
      `${missing.join(", ")} not set. Add as GitHub repo secrets ` +
      `(Settings → Secrets and variables → Actions), then re-run.`;
    console.error(
      `::error file=.github/workflows/db-perf-smoke.yml,title=${title}::${msg}`,
    );
  }

  process.exit(2);
}

const envKey = process.env.PERF_ENV || "default";
const thresholdsFile = process.env.PERF_THRESHOLDS_FILE || "perf-thresholds.json";
const extraLayers = (process.env.PERF_THRESHOLDS_FILES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const layers = resolveThresholdsLayers(thresholdsFile, envKey, extraLayers);
const coverageStrict = process.env.PERF_COVERAGE_STRICT === "1";
const applySuggestions = process.env.PERF_APPLY_SUGGESTIONS === "1";
const maxChangePct = process.env.PERF_MAX_CHANGE_PCT
  ? Number(process.env.PERF_MAX_CHANGE_PCT)
  : undefined;
const emitAnnotations = process.env.PERF_ANNOTATIONS !== "0"; // on by default

let thresholds;
try {
  thresholds = loadLayeredThresholds(layers, envKey);
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

const presentLayers = layers.filter((p) => fs.existsSync(p));
console.log(
  `▶ thresholds [${thresholds.envKey}] mean≤${thresholds.mean_ms}ms max≤${thresholds.max_ms}ms` +
    (thresholds.queries.length ? ` (+${thresholds.queries.length} per-query rules)` : "") +
    ` (layers: ${presentLayers.join(" → ")})` +
    (maxChangePct ? ` [max ±${maxChangePct}%/run]` : ""),
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

  // Enrich entries with stable query_id BEFORE serializing so the artifact
  // carries the anchors the PR comment links to.
  if (Array.isArray(body?.hot_queries)) {
    body.hot_queries = body.hot_queries.map((q: any) => ({ query_id: queryId(q), ...q }));
  }
  if (Array.isArray(body?.threshold_failures)) {
    body.threshold_failures = body.threshold_failures.map((q: any) => ({
      query_id: queryId(q),
      ...q,
    }));
  }

  const pretty = JSON.stringify(body, null, 2);
  const outDir = process.env.PERF_REPORT_DIR || ".";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "perf-smoke-report.json"), pretty);

  // Always write the resolved profile artifact: env defaults + rules that
  // actually fired (so reviewers see exactly what was applied).
  const firedRules = new Map<string, any>();
  for (const r of thresholds.queries) firedRules.set(r.label ?? r.match, r);
  for (const f of body?.threshold_failures ?? []) {
    if (f.matched_rule) {
      const k = f.matched_rule.label ?? f.matched_rule.match;
      if (k) firedRules.set(k, f.matched_rule);
    }
  }
  const resolvedProfile = {
    envKey: thresholds.envKey,
    mean_ms: thresholds.mean_ms,
    max_ms: thresholds.max_ms,
    queries: Array.from(firedRules.values()),
    resolved_at: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(outDir, "perf-smoke-resolved-profile.json"),
    JSON.stringify(resolvedProfile, null, 2),
  );

  // Coverage check
  const uncovered = findUncovered(body?.hot_queries ?? [], thresholds.queries);

  // Optionally compute + apply suggestions, producing a patch file.
  let suggestionsPatch: string | null = null;
  let mergeStats: { added: SuggestedRule[]; replaced: SuggestedRule[]; clamped: any[] } | null = null;
  let computedSuggestions: SuggestedRule[] = [];
  if (Array.isArray(body?.threshold_failures) && body.threshold_failures.length) {
    computedSuggestions = body.threshold_failures.map((f: any) =>
      suggestRule({
        matched_rule: f.matched_rule && f.matched_rule !== null ? f.matched_rule : undefined,
        query_preview: String(f.query_preview ?? ""),
        mean_ms: Number(f.mean_ms),
        max_ms: Number(f.max_ms),
      }),
    );
  }
  if (applySuggestions && computedSuggestions.length) {
    try {
      const merge = mergeSuggestions(thresholdsFile, thresholds.envKey, computedSuggestions, {
        write: true,
        maxChangePct,
      });
      mergeStats = { added: merge.added, replaced: merge.replaced, clamped: merge.clamped };
      suggestionsPatch = unifiedDiff(merge.before, merge.after, "perf-thresholds.json");
      fs.writeFileSync(path.join(outDir, "perf-thresholds.diff.patch"), suggestionsPatch + "\n");
      console.log(
        `▶ Applied ${merge.added.length} new + ${merge.replaced.length} replaced rules into ${thresholds.envKey}` +
          (merge.clamped.length ? ` (${merge.clamped.length} value${merge.clamped.length === 1 ? "" : "s"} clamped by ±${maxChangePct}%)` : ""),
      );
    } catch (e) {
      console.warn(`⚠ Could not apply suggestions: ${(e as Error).message}`);
    }
  }

  // HTML visualisation artifact.
  try {
    const html = renderHtmlReport({
      resolved: thresholds,
      layers: presentLayers,
      hotQueries: body?.hot_queries ?? [],
      failures: body?.threshold_failures ?? [],
      suggestions: computedSuggestions,
      uncovered,
    });
    fs.writeFileSync(path.join(outDir, "perf-smoke-report.html"), html);
  } catch (e) {
    console.warn(`⚠ Could not render HTML report: ${(e as Error).message}`);
  }

  // Emit GitHub check annotations pointing at the failing rule in
  // perf-thresholds.json and the entry in perf-smoke-report.json.
  if (emitAnnotations && process.env.GITHUB_ACTIONS === "true" && Array.isArray(body?.threshold_failures) && body.threshold_failures.length) {
    const annotations = buildAnnotations({
      thresholdsPath: path.resolve(thresholdsFile),
      reportPath: path.resolve(path.join(outDir, "perf-smoke-report.json")),
      failures: body.threshold_failures,
    });
    for (const a of annotations) console.log(formatAnnotation(a, "error"));
    if (coverageStrict && uncovered.length) {
      // Annotate uncovered hot queries against the report file too.
      const uncoveredAnn = buildAnnotations({
        thresholdsPath: path.resolve(thresholdsFile),
        reportPath: path.resolve(path.join(outDir, "perf-smoke-report.json")),
        failures: uncovered.map((q: any) => ({
          query_id: queryId(q),
          mean_ms: q.mean_ms,
          max_ms: q.max_ms,
          query_preview: q.query_preview,
        })),
      });
      for (const a of uncoveredAnn) console.log(formatAnnotation({ ...a, message: `Hot query has no matching threshold rule — ${a.message}` }, "warning"));
    }
  }


  // Markdown summary used by the PR-comment step.
  const htmlArtifactPath = `${outDir.replace(/^\.\/?/, "")}/perf-smoke-report.html`;
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null;
  const passed = res.status === 200 && body?.pass && !(coverageStrict && uncovered.length);

  const summary = buildPrComment({
    status: res.status,
    body,
    thresholds,
    uncovered,
    coverageStrict,
    suggestionsPatch,
    mergeStats,
    maxChangePct,
    htmlArtifactPath,
    runUrl,
  });
  fs.writeFileSync(path.join(outDir, "perf-smoke-summary.md"), summary);

  if (passed) {
    console.log("✅ db-perf-smoke PASS");
    console.log(pretty);
    process.exit(0);
  }

  console.error(`❌ db-perf-smoke FAIL (HTTP ${res.status})`);
  if (Array.isArray(body?.missing_indexes) && body.missing_indexes.length) {
    console.error("Missing indexes:", body.missing_indexes);
  }
  if (coverageStrict && uncovered.length) {
    console.error(`Coverage gaps (${uncovered.length}):`);
    for (const q of uncovered) console.error(`  • ${queryId(q as any)}  ${(q as any).query_preview}`);
  }
  if (Array.isArray(body?.threshold_failures) && body.threshold_failures.length) {
    console.error("Breaching queries:");
    for (const q of body.threshold_failures) {
      const ruleLabel = q.matched_rule && q.matched_rule !== null
        ? (q.matched_rule.label ?? q.matched_rule.match)
        : "(env default)";
      console.error(
        `\n  • [${q.query_id}] [${ruleLabel}] mean=${q.mean_ms}ms (≤${q.applied_mean_ms}) max=${q.max_ms}ms (≤${q.applied_max_ms}) calls=${q.calls}\n    ${q.query_preview}`,
      );
      if (q.explain) {
        const indented = String(q.explain).split("\n").map((l: string) => "      " + l).join("\n");
        console.error(`    EXPLAIN (${q.explain_mode ?? "ANALYZE"}, BUFFERS):`);
        console.error(indented);
      }
    }
  }
  console.error(pretty);
  process.exit(1);
})();
