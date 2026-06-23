/**
 * GitHub-flavoured Markdown sanitizes most raw HTML in PR comments. The
 * db-perf-smoke comment deliberately uses only `<details>` and `<summary>`
 * for collapsible sections — any other raw tag is either dropped by GH
 * (silently breaking the layout) or accidentally injected from a query
 * preview / patch / heading.
 *
 * This test scans every rendered scenario and fails if any tag other than
 * the allow-list appears as raw HTML.
 */
import { describe, it, expect } from "vitest";
import { buildPrComment, type BuildPrCommentInput } from "../lib/perf-pr-comment";
import type { ResolvedThresholds } from "../lib/perf-thresholds";

const ALLOWED = new Set(["details", "summary"]);

const thresholds: ResolvedThresholds = {
  envKey: "default",
  mean_ms: 100,
  max_ms: 500,
  queries: [{ match: "select \\* from products", label: "products-list", mean_ms: 150, max_ms: 600 }],
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
    "fail-everything",
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
      suggestionsPatch: "--- a\n+++ b\n@@\n-x\n+y\n",
      mergeStats: {
        added: [],
        replaced: [],
        clamped: [{ label: "products-list", field: "max_ms", previous: 600, requested: 1060, applied: 720 }],
      },
      maxChangePct: 20,
      runUrl: "https://github.com/acme/app/actions/runs/42",
    },
  ],
];

/**
 * Strip fenced code blocks and inline code spans before scanning — `<…>`
 * inside ``` … ``` or `…` is literal content, not raw HTML.
 */
function stripCode(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");
}

/** Match anything that *looks* like an HTML tag: `<foo>`, `</foo>`, `<foo …>`, `<foo/>`. */
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;

describe("buildPrComment — no raw HTML other than <details>/<summary>", () => {
  for (const [name, input] of SCENARIOS) {
    it(`${name}: only allow-listed tags appear outside code`, () => {
      const md = buildPrComment(input);
      const scanned = stripCode(md);
      const offenders = new Set<string>();
      for (const m of scanned.matchAll(TAG_RE)) {
        const tag = m[1].toLowerCase();
        if (!ALLOWED.has(tag)) offenders.add(`<${tag}> @ "${m[0]}"`);
      }
      expect(
        Array.from(offenders),
        `Disallowed raw HTML tags found in PR comment (allowed: ${Array.from(ALLOWED).join(", ")}):\n` +
          Array.from(offenders).join("\n"),
      ).toEqual([]);
    });

    it(`${name}: every <details> has a matching </details> and every <summary> has </summary>`, () => {
      const md = buildPrComment(input);
      const scanned = stripCode(md);
      const count = (re: RegExp) => (scanned.match(re) ?? []).length;
      expect(count(/<details\b[^>]*>/g)).toBe(count(/<\/details>/g));
      expect(count(/<summary\b[^>]*>/g)).toBe(count(/<\/summary>/g));
    });
  }
});
