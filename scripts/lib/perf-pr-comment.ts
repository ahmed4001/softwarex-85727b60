/**
 * Pure builder for the db-perf-smoke PR comment markdown.
 *
 * Extracted from `scripts/db-perf-smoke.ts` so the comment structure
 * (TOC, `#### Heading` anchors, collapsible details, jump links) can be
 * snapshotted in isolation without running the edge function.
 */
import {
  renderActiveThresholds,
  loadBaseThresholds,
  diffThresholds,
  bumpThreshold,
  queryId,
  type ResolvedThresholds,
  type SuggestedRule,
} from "./perf-thresholds";

export interface BuildPrCommentInput {
  status: number;
  body: any;
  thresholds: ResolvedThresholds;
  uncovered: any[];
  coverageStrict: boolean;
  suggestionsPatch: string | null;
  mergeStats: {
    added: SuggestedRule[];
    replaced: SuggestedRule[];
    clamped: Array<{ label: string; field: string; previous: number; requested: number; applied: number }>;
  } | null;
  maxChangePct: number | undefined;
  htmlArtifactPath: string;
  runUrl: string | null;
  /** Optional override to keep snapshot tests independent of disk state. */
  baseThresholdsForDiff?: ResolvedThresholds | null;
}

export function buildPrComment(input: BuildPrCommentInput): string {
  const {
    status,
    body,
    thresholds,
    uncovered,
    coverageStrict,
    suggestionsPatch,
    mergeStats,
    maxChangePct,
    htmlArtifactPath,
    runUrl,
  } = input;

  const lines: string[] = [];
  const passed = status === 200 && body?.pass && !(coverageStrict && uncovered.length);
  const breachCount = Array.isArray(body?.threshold_failures) ? body.threshold_failures.length : 0;
  const overMaxCount = Array.isArray(body?.threshold_failures)
    ? body.threshold_failures.filter((q: any) => q.over_max).length
    : 0;
  const missingIdxCount = Array.isArray(body?.missing_indexes) ? body.missing_indexes.length : 0;
  const hotCount = Array.isArray(body?.hot_queries) ? body.hot_queries.length : 0;

  lines.push(`### ${passed ? "✅" : "❌"} db-perf-smoke ${passed ? "PASS" : "FAIL"}`);
  lines.push("");
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

  const toc: string[] = [];
  if (breachCount) toc.push("[🔥 Breaches](#breaches)");
  if (uncovered.length) toc.push("[🛡 Coverage gaps](#coverage-gaps)");
  if (missingIdxCount) toc.push("[🧱 Missing indexes](#missing-indexes)");
  toc.push("[⚙ Active thresholds](#active-thresholds)");

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

  const baseT =
    input.baseThresholdsForDiff !== undefined
      ? input.baseThresholdsForDiff
      : loadBaseThresholds(thresholds.envKey);
  const diff = baseT ? diffThresholds(baseT, thresholds) : null;
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

  let summary = lines.join("\n");
  if (suggestionsPatch && mergeStats) {
    summary = summary.replace(
      "**Jump to:** ",
      "**Jump to:** [🩹 Suggested patch](#suggested-patch) · ",
    );
  }
  return summary;
}
