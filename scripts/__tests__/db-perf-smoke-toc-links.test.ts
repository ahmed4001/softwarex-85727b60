/**
 * Runtime check: every `[label](#anchor)` in the **Jump to:** TOC of the
 * rendered PR comment must point at an actual `#### Heading` *in that same
 * rendered output*.
 *
 * Complements `db-perf-smoke-anchors.test.ts` (which scans the source
 * literals): this exercises real `buildPrComment` output across multiple
 * scenarios so conditional sections (breaches, gaps, indexes, patch) are
 * each verified to either render their heading or get omitted from the TOC.
 */
import { describe, it, expect } from "vitest";
import { buildPrComment, type BuildPrCommentInput } from "../lib/perf-pr-comment";
import type { ResolvedThresholds } from "../lib/perf-thresholds";

const thresholds: ResolvedThresholds = {
  envKey: "default",
  mean_ms: 100,
  max_ms: 500,
  queries: [],
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

const SCENARIOS: Array<[string, BuildPrCommentInput, string[]]> = [
  // [name, input, expected TOC anchors]
  ["PASS — only Active thresholds in TOC", base, ["active-thresholds"]],
  [
    "FAIL — breaches only",
    {
      ...base,
      body: { pass: false, threshold_failures: [failure], hot_queries: [failure], missing_indexes: [] },
    },
    ["breaches", "active-thresholds"],
  ],
  [
    "FAIL — coverage gaps only",
    { ...base, uncovered: [uncovered], coverageStrict: true },
    ["coverage-gaps", "active-thresholds"],
  ],
  [
    "FAIL — missing indexes only",
    {
      ...base,
      body: { pass: false, threshold_failures: [], hot_queries: [], missing_indexes: ["public.reviews(product_id)"] },
    },
    ["missing-indexes", "active-thresholds"],
  ],
  [
    "FAIL — everything including suggested patch (retroactive TOC injection)",
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
      mergeStats: { added: [], replaced: [], clamped: [] },
      maxChangePct: 20,
    },
    ["suggested-patch", "breaches", "coverage-gaps", "missing-indexes", "active-thresholds"],
  ],
];

/** Mirror GitHub's heading-slug rules — keep in sync with `slugifyHeading` in anchors test. */
function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Extract every `#### …` heading that the rendered output actually contains. */
function renderedHeadingSlugs(md: string): Set<string> {
  const out = new Set<string>();
  for (const ln of md.split("\n")) {
    const m = ln.match(/^####\s+(.+?)\s*$/);
    if (m) out.add(slugify(m[1]));
  }
  return out;
}

/** Pull `[label](#anchor)` entries off the `**Jump to:**` line itself. */
function tocAnchors(md: string): string[] {
  const tocLine = md.split("\n").find((l) => l.startsWith("**Jump to:**"));
  if (!tocLine) return [];
  return Array.from(tocLine.matchAll(/\[[^\]]+\]\(#([a-z0-9-]+)\)/g)).map((m) => m[1]);
}

describe("buildPrComment — TOC anchors resolve in rendered output", () => {
  for (const [name, input, expectedAnchors] of SCENARIOS) {
    describe(name, () => {
      const md = buildPrComment(input);
      const anchors = tocAnchors(md);
      const headings = renderedHeadingSlugs(md);

      it("renders a `**Jump to:**` line", () => {
        expect(anchors.length, `no TOC found in:\n${md}`).toBeGreaterThan(0);
      });

      it("every TOC anchor resolves to a `#### Heading` that was actually emitted", () => {
        const dangling = anchors.filter((a) => !headings.has(a));
        expect(
          dangling,
          `Dangling TOC anchors not present as headings in rendered output:\n` +
            `  dangling: ${dangling.join(", ")}\n` +
            `  rendered headings: ${Array.from(headings).join(", ")}\n` +
            `--- MD ---\n${md}`,
        ).toEqual([]);
      });

      it("emits exactly the expected anchor set in order", () => {
        expect(anchors).toEqual(expectedAnchors);
      });

      it("does not link to a heading that the renderer omitted (e.g. #breaches when no breaches)", () => {
        const conditionals = ["breaches", "coverage-gaps", "missing-indexes", "suggested-patch"];
        for (const slug of conditionals) {
          const inToc = anchors.includes(slug);
          const inDoc = headings.has(slug);
          expect(
            inToc,
            `TOC links to #${slug} but heading was not rendered (or vice-versa)`,
          ).toBe(inDoc);
        }
      });
    });
  }
});
