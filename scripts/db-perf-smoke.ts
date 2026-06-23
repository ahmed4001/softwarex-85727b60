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
  const lines: string[] = [];
  const passed = res.status === 200 && body?.pass && !(coverageStrict && uncovered.length);
  const breachCount = Array.isArray(body?.threshold_failures) ? body.threshold_failures.length : 0;
  const overMaxCount = Array.isArray(body?.threshold_failures)
    ? body.threshold_failures.filter((q: any) => q.over_max).length
    : 0;
  const missingIdxCount = Array.isArray(body?.missing_indexes) ? body.missing_indexes.length : 0;
  const hotCount = Array.isArray(body?.hot_queries) ? body.hot_queries.length : 0;
  const htmlArtifactPath = `${outDir.replace(/^\.\/?/, "")}/perf-smoke-report.html`;

  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null;

  lines.push(`### ${passed ? "✅" : "❌"} db-perf-smoke ${passed ? "PASS" : "FAIL"}`);
  lines.push("");
  // Concise TL;DR — one line per signal so reviewers can triage at a glance.
  lines.push("**Summary**");
  lines.push(
    `- ${breachCount === 0 ? "✅" : "❌"} **${breachCount}** breaching quer${breachCount === 1 ? "y" : "ies"}` +
      (breachCount
        ? ` (${overMaxCount} over max, ${breachCount - overMaxCount} over mean) — of ${hotCount} hot queries scanned`
        : ""),
  );
  lines.push(
    `- ${uncovered.length === 0 ? "✅" : coverageStrict ? "❌" : "⚠"} **${uncovered.length}** coverage gap${uncovered.length === 1 ? "" : "s"}` +
      (coverageStrict ? " (strict mode)" : ""),
  );
  lines.push(
    `- ${missingIdxCount === 0 ? "✅" : "❌"} **${missingIdxCount}** missing index${missingIdxCount === 1 ? "" : "es"}`,
  );
  lines.push(
    `- 📊 HTML report: \`${htmlArtifactPath}\`` +
      (runUrl ? ` — [download from the **perf-smoke-report** artifact ↗](${runUrl}#artifacts)` : ""),
  );

  // Top breaching queries (compact) — gives reviewers a one-line peek without
  // scrolling into the full table further down.
  if (breachCount) {
    const top3 = [...body.threshold_failures]
      .sort((a: any, b: any) => Number(b.mean_ms) - Number(a.mean_ms))
      .slice(0, 3);
    lines.push("", "**Top breaches**");
    for (const q of top3) {
      const label = q.matched_rule?.label ?? q.matched_rule?.match ?? "(env default)";
      lines.push(
        `- \`${q.query_id}\` · **${label}** · mean ${q.mean_ms}ms (≤${q.applied_mean_ms ?? thresholds.mean_ms}) · max ${q.max_ms}ms (≤${q.applied_max_ms ?? thresholds.max_ms})`,
      );
    }
    if (breachCount > 3) lines.push(`- … +${breachCount - 3} more (see [breaches table](#breaches))`);
  }

  // Jump-to TOC for the collapsible sections below. GitHub auto-generates
  // anchors from the `####` headings we emit ahead of each <details>.
  const toc: string[] = [];
  if (breachCount) toc.push("[🔥 Breaches](#breaches)");
  if (uncovered.length) toc.push("[🛡 Coverage gaps](#coverage-gaps)");
  if (missingIdxCount) toc.push("[🧱 Missing indexes](#missing-indexes)");
  toc.push("[⚙ Active thresholds](#active-thresholds)");
  // Suggested-patch link is appended later once we know it was applied.

  lines.push("", `**Jump to:** ${toc.join(" · ")}`);

  lines.push(
    "",
    "#### Active thresholds",
    "<details><summary>Resolved profile + per-query overrides</summary>",
    "",
    renderActiveThresholds(thresholds),
    "",
    "</details>",
  );

  const baseT = loadBaseThresholds(thresholds.envKey);
  const diff = diffThresholds(baseT, thresholds);
  if (diff) lines.push("", diff);

  if (missingIdxCount) {
    lines.push("", "#### Missing indexes", "");
    for (const i of body.missing_indexes) lines.push(`- \`${i}\``);
  }



  if (Array.isArray(body?.threshold_failures) && body.threshold_failures.length) {
    const failures = [...body.threshold_failures].sort((a: any, b: any) => {
      const am = a.over_max ? 1 : 0;
      const bm = b.over_max ? 1 : 0;
      if (am !== bm) return bm - am;
      return Number(b.mean_ms) - Number(a.mean_ms);
    });
    const top = failures.slice(0, 10);

    lines.push(
      "",
      "#### Breaches",
      `<details><summary>Top ${top.length} of ${failures.length} breaching hot queries (click to expand)</summary>`,
      "",
    );
    lines.push("| id | rule | mode | mean (ms) | max (ms) | mean: before → after | max: before → after | calls | query |");
    lines.push("|---|---|---|---:|---:|---|---|---:|---|");
    top.forEach((q: any) => {
      const preview = String(q.query_preview ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const mode = String(q.explain_mode ?? "ANALYZE").split(" ")[0];
      const ruleLabel = q.matched_rule && q.matched_rule !== null
        ? (q.matched_rule.label ?? q.matched_rule.match ?? "match")
        : "(env default)";
      const beforeMean = q.applied_mean_ms ?? thresholds.mean_ms;
      const beforeMax = q.applied_max_ms ?? thresholds.max_ms;
      const afterMean = bumpThreshold(Number(q.mean_ms));
      const afterMax = bumpThreshold(Number(q.max_ms));
      const idCell = runUrl
        ? `[\`${q.query_id}\`](${runUrl}#artifacts "Search perf-smoke-report.json for ${q.query_id}")`
        : `\`${q.query_id}\``;
      lines.push(
        `| ${idCell} | ${ruleLabel} | ${mode} | ${q.mean_ms} | ${q.max_ms} | ${beforeMean} → **${afterMean}** | ${beforeMax} → **${afterMax}** | ${q.calls} | \`${preview}\` |`,
      );
    });
    lines.push("");
    lines.push(
      "Suggested values add 20% headroom (rounded up to 10 ms). The `id` column is a stable anchor — search for it inside `perf-smoke-report.json` in the artifact.",
      "",
      "</details>",
    );
  }

  // Coverage gaps section
  if (uncovered.length) {
    const icon = coverageStrict ? "❌" : "⚠";
    lines.push(
      "",
      "#### Coverage gaps",
      `<details${coverageStrict ? " open" : ""}><summary>${icon} ${uncovered.length} hot quer${uncovered.length === 1 ? "y has" : "ies have"} no matching threshold rule</summary>`,
      "",
    );
    lines.push("| id | preview |");
    lines.push("|---|---|");
    for (const q of uncovered.slice(0, 15)) {
      const id = queryId(q as any);
      const preview = String((q as any).query_preview ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| \`${id}\` | \`${preview}\` |`);
    }
    if (uncovered.length > 15) lines.push(`| … | (+${uncovered.length - 15} more in the artifact) |`);
    lines.push(
      "",
      coverageStrict
        ? "Set `PERF_COVERAGE_STRICT=0` to make this a warning, or add rules to `perf-thresholds.json` for each id above."
        : "Add explicit rules in `perf-thresholds.json` to silence these warnings, or set `PERF_COVERAGE_STRICT=1` to fail the build.",
      "",
      "</details>",
    );
  }

  // Ready-to-commit patch (only when applied)
  if (suggestionsPatch && mergeStats) {
    const clampNote = mergeStats.clamped.length
      ? ` — ⚠ ${mergeStats.clamped.length} value${mergeStats.clamped.length === 1 ? "" : "s"} clamped to ±${maxChangePct}% / run`
      : "";
    lines.push(
      "",
      "#### Suggested patch",
      `<details><summary>${mergeStats.added.length} added, ${mergeStats.replaced.length} replaced${clampNote}</summary>`,
      "",
      "Applied to `perf-thresholds.json` in this run. Download `perf-thresholds.diff.patch` from the run artifacts and commit it, or copy the diff below.",
      "",
      "```diff",
      suggestionsPatch,
      "```",
    );
    if (mergeStats.clamped.length) {
      lines.push("", "| rule | field | previous | requested | applied |", "|---|---|---:|---:|---:|");
      for (const c of mergeStats.clamped) {
        lines.push(`| ${c.label} | ${c.field} | ${c.previous} | ${c.requested} | **${c.applied}** |`);
      }
    }
    lines.push("", "</details>");
  }


  lines.push(
    "",
    "Artifacts attached: `perf-smoke-report.json`, `perf-smoke-report.html` (visual diff), `perf-smoke-resolved-profile.json`.",
  );

  if (runUrl) {
    lines.push(
      "",
      `Full \`EXPLAIN (ANALYZE, BUFFERS)\` plans are in the **\`perf-smoke-report\`** artifact attached to this run.`,
      "",
      `[View full CI logs ↗](${runUrl})`,
    );
  }
  // Patch the TOC retroactively to include the Suggested-patch anchor when present.
  let summary = lines.join("\n");
  if (suggestionsPatch && mergeStats) {
    summary = summary.replace(
      "**Jump to:** ",
      "**Jump to:** [🩹 Suggested patch](#suggested-patch) · ",
    );
  }
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
