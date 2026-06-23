/**
 * Runtime check: in the rendered PR comment markdown, no two `#### Heading`
 * lines may slugify to the same anchor. GitHub auto-suffixes collisions
 * (`#breaches`, `#breaches-1`), which silently breaks every TOC link.
 *
 * Complements the static-source dedupe test by exercising real
 * `buildPrComment` output across scenarios — so even dynamic headings
 * (counts, labels interpolated into titles) stay collision-free.
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

const SCENARIOS: Array<[string, BuildPrCommentInput]> = [
  ["PASS — Active thresholds only", base],
  [
    "FAIL — breaches only",
    { ...base, body: { pass: false, threshold_failures: [failure], hot_queries: [failure], missing_indexes: [] } },
  ],
  [
    "FAIL — coverage gaps only (strict)",
    { ...base, uncovered: [uncovered], coverageStrict: true },
  ],
  [
    "FAIL — missing indexes only",
    {
      ...base,
      body: { pass: false, threshold_failures: [], hot_queries: [], missing_indexes: ["public.reviews(product_id)"] },
    },
  ],
  [
    "FAIL — everything + suggested patch",
    {
      ...base,
      coverageStrict: true,
      body: {
        pass: false,
        threshold_failures: [failure],
        hot_queries: [failure, uncovered],
        missing_indexes: ["public.reviews(product_id)", "public.events(user_id)"],
      },
      uncovered: [uncovered],
      suggestionsPatch: "--- a\n+++ b\n@@\n-x\n+y\n",
      mergeStats: {
        added: [],
        replaced: [],
        clamped: [{ label: "products-list", field: "max_ms", previous: 600, requested: 1060, applied: 720 }],
      },
      maxChangePct: 20,
    },
  ],
];

/** Same rules as the source-anchor test — keep in sync. */
function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function extractHeadings(md: string): string[] {
  const out: string[] = [];
  for (const ln of md.split("\n")) {
    const m = ln.match(/^####\s+(.+?)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

describe("buildPrComment — heading anchors are unique in rendered output", () => {
  for (const [name, input] of SCENARIOS) {
    describe(name, () => {
      const md = buildPrComment(input);
      const headings = extractHeadings(md);
      const slugs = headings.map(slugify);

      it("renders at least one `#### Heading`", () => {
        expect(headings.length, `no #### headings in:\n${md}`).toBeGreaterThan(0);
      });

      it("no two `#### Heading` lines share the exact same text", () => {
        const counts = new Map<string, number>();
        for (const h of headings) counts.set(h, (counts.get(h) ?? 0) + 1);
        const dupes = Array.from(counts.entries()).filter(([, n]) => n > 1);
        expect(
          dupes,
          `Duplicate heading literals (GitHub would suffix -1/-2 and break TOC links):\n` +
            `  ${dupes.map(([h, n]) => `"${h}" ×${n}`).join("\n  ")}\n--- MD ---\n${md}`,
        ).toEqual([]);
      });

      it("no two headings collide after slug normalization", () => {
        const counts = new Map<string, string[]>();
        headings.forEach((h, i) => {
          const s = slugs[i];
          counts.set(s, [...(counts.get(s) ?? []), h]);
        });
        const collisions = Array.from(counts.entries()).filter(([, hs]) => hs.length > 1);
        expect(
          collisions,
          `Slug collisions:\n` +
            collisions.map(([s, hs]) => `  #${s} ← ${hs.map((h) => `"${h}"`).join(", ")}`).join("\n"),
        ).toEqual([]);
      });
    });
  }
});
