/**
 * Full-comment snapshot tests across every scenario `buildPrComment` is
 * expected to handle. Catches any structural or formatting regression
 * (heading order, TOC injection, table columns, details wrappers, fences).
 *
 * Update snapshots deliberately (`vitest -u`) — and re-check the anchor /
 * TOC / block-structure / link tests at the same time.
 */
import { describe, it, expect } from "vitest";
import { buildPrComment, type BuildPrCommentInput } from "../lib/perf-pr-comment";
import type { ResolvedThresholds } from "../lib/perf-thresholds";

const thresholds: ResolvedThresholds = {
  envKey: "default",
  mean_ms: 100,
  max_ms: 500,
  queries: [
    { match: "select \\* from products", label: "products-list", mean_ms: 150, max_ms: 600 },
  ],
};

const failure = {
  query_id: "q-aaaaaa",
  matched_rule: { label: "products-list", match: "select \\* from products", mean_ms: 150, max_ms: 600 },
  applied_mean_ms: 150,
  applied_max_ms: 600,
  mean_ms: 220,
  max_ms: 880,
  calls: 1234,
  over_max: true,
  explain_mode: "ANALYZE",
  query_preview: "select * from products where active = $1",
};

const uncovered = {
  query_id: "u-bbbbbb",
  mean_ms: 30,
  max_ms: 110,
  query_preview: "select count(*) from sessions",
};

const base: BuildPrCommentInput = {
  status: 200,
  body: { pass: true, threshold_failures: [], hot_queries: [], missing_indexes: [] },
  thresholds,
  uncovered: [],
  coverageStrict: false,
  suggestionsPatch: null,
  mergeStats: null,
  maxChangePct: undefined,
  htmlArtifactPath: "artifacts/perf-smoke-report.html",
  runUrl: null,
  baseThresholdsForDiff: null,
};

const SCENARIOS: Array<[string, BuildPrCommentInput]> = [
  ["pass-minimal", base],
  [
    "fail-breaches-only",
    {
      ...base,
      body: { pass: false, threshold_failures: [failure], hot_queries: [failure], missing_indexes: [] },
    },
  ],
  [
    "fail-coverage-gaps-only",
    { ...base, uncovered: [uncovered], coverageStrict: true },
  ],
  [
    "fail-missing-indexes-only",
    {
      ...base,
      body: { pass: false, threshold_failures: [], hot_queries: [], missing_indexes: ["public.reviews(product_id)"] },
    },
  ],
  [
    "fail-everything-with-patch-and-clamp",
    {
      ...base,
      coverageStrict: true,
      body: {
        pass: false,
        threshold_failures: [failure],
        hot_queries: [failure, uncovered],
        missing_indexes: ["public.reviews(product_id)"],
      },
      uncovered: [uncovered],
      suggestionsPatch:
        "--- a/perf-thresholds.json\n+++ b/perf-thresholds.json\n@@\n-  \"mean_ms\": 150\n+  \"mean_ms\": 270\n",
      mergeStats: {
        added: [{ match: "select id from reviews", label: "reviews-lookup", mean_ms: 170, max_ms: 510 } as any],
        replaced: [{ match: "select \\* from products", label: "products-list", mean_ms: 270, max_ms: 1060 } as any],
        clamped: [
          { label: "products-list", field: "max_ms", previous: 600, requested: 1060, applied: 720 },
        ],
      },
      maxChangePct: 20,
      runUrl: "https://github.com/acme/app/actions/runs/42",
    },
  ],
];

describe("buildPrComment — full-comment snapshots", () => {
  for (const [name, input] of SCENARIOS) {
    it(`matches snapshot: ${name}`, () => {
      expect(buildPrComment(input)).toMatchSnapshot();
    });
  }
});
