/**
 * Snapshot test for the full PR comment markdown emitted by `buildPrComment`.
 *
 * Locks in the exact structure reviewers see: TL;DR summary, top-breach
 * preview, **Jump to:** TOC anchors, `#### Heading` sections, collapsible
 * `<details>` blocks, breach + coverage tables, and the suggested-patch
 * block (including the retroactive TOC injection).
 *
 * Update the snapshot deliberately (`vitest -u`) whenever the structure
 * legitimately changes — that's a signal to re-check downstream consumers
 * (anchor tests, jump links, GitHub comment rendering).
 */
import { describe, it, expect } from "vitest";
import { buildPrComment } from "../lib/perf-pr-comment";
import type { ResolvedThresholds } from "../lib/perf-thresholds";

const thresholds: ResolvedThresholds = {
  envKey: "default",
  mean_ms: 100,
  max_ms: 500,
  queries: [
    { match: "select \\* from products", label: "products-list", mean_ms: 150, max_ms: 600 },
  ],
};

const failures = [
  {
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
  },
  {
    query_id: "q-bbbbbb",
    matched_rule: null,
    applied_mean_ms: 100,
    applied_max_ms: 500,
    mean_ms: 140,
    max_ms: 420,
    calls: 88,
    over_max: false,
    explain_mode: "ANALYZE, BUFFERS",
    query_preview: "select id from reviews where product_id = $1",
  },
];

const hotQueries = [
  ...failures,
  {
    query_id: "q-cccccc",
    mean_ms: 30,
    max_ms: 110,
    calls: 9000,
    query_preview: "select count(*) from sessions",
  },
];

const uncovered = [
  {
    query_id: "q-cccccc",
    mean_ms: 30,
    max_ms: 110,
    query_preview: "select count(*) from sessions",
  },
];

const body = {
  pass: false,
  threshold_failures: failures,
  hot_queries: hotQueries,
  missing_indexes: ["public.reviews(product_id)"],
};

describe("buildPrComment — PR markdown snapshot", () => {
  it("renders the full FAIL comment with breaches, coverage gaps, missing indexes, and suggested patch", () => {
    const md = buildPrComment({
      status: 200,
      body,
      thresholds,
      uncovered,
      coverageStrict: true,
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
      htmlArtifactPath: "artifacts/perf-smoke-report.html",
      runUrl: "https://github.com/acme/app/actions/runs/42",
      // Pin to null so the snapshot doesn't depend on the repo's perf-thresholds.json.
      baseThresholdsForDiff: null,
    });

    expect(md).toMatchSnapshot();
  });

  it("renders the minimal PASS comment (no breaches, no gaps, no patch)", () => {
    const md = buildPrComment({
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
    });

    expect(md).toMatchSnapshot();
  });

  it("PR comment contains every expected jump-to anchor and heading", () => {
    const md = buildPrComment({
      status: 200,
      body,
      thresholds,
      uncovered,
      coverageStrict: true,
      suggestionsPatch: "--- a\n+++ b\n",
      mergeStats: { added: [], replaced: [], clamped: [] },
      maxChangePct: 20,
      htmlArtifactPath: "artifacts/perf-smoke-report.html",
      runUrl: null,
      baseThresholdsForDiff: null,
    });

    // TOC line
    expect(md).toMatch(/\*\*Jump to:\*\* .*\[🩹 Suggested patch\]\(#suggested-patch\)/);
    expect(md).toContain("[🔥 Breaches](#breaches)");
    expect(md).toContain("[🛡 Coverage gaps](#coverage-gaps)");
    expect(md).toContain("[🧱 Missing indexes](#missing-indexes)");
    expect(md).toContain("[⚙ Active thresholds](#active-thresholds)");

    // Heading anchors
    expect(md).toContain("#### Active thresholds");
    expect(md).toContain("#### Missing indexes");
    expect(md).toContain("#### Breaches");
    expect(md).toContain("#### Coverage gaps");
    expect(md).toContain("#### Suggested patch");
  });
});
