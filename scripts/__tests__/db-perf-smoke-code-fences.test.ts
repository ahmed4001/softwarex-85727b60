/**
 * Validates fenced code blocks in the PR comment:
 *   1. Triple-backtick fences are paired (even count of fence lines).
 *   2. Every *opening* fence declares a language (`` ```diff ``, ``` ```sql ```)
 *      so GitHub renders syntax highlighting instead of an undecorated grey block.
 *   3. No line contains an unmatched run of backticks that would prematurely
 *      close an inline code span (e.g. a stray ` `` ` inside a table cell).
 */
import { describe, it, expect } from "vitest";
import { buildPrComment, type BuildPrCommentInput } from "../lib/perf-pr-comment";
import type { ResolvedThresholds } from "../lib/perf-thresholds";

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
    { ...base, body: { pass: false, threshold_failures: [failure], hot_queries: [failure], missing_indexes: [] } },
  ],
  [
    "fail-with-suggested-patch",
    {
      ...base,
      body: { pass: false, threshold_failures: [failure], hot_queries: [failure], missing_indexes: [] },
      suggestionsPatch: "--- a\n+++ b\n@@\n-x\n+y\n",
      mergeStats: { added: [], replaced: [], clamped: [] },
      maxChangePct: 20,
    },
  ],
];

/** Collect all triple-backtick fence lines (with their declared info-string). */
function fenceLines(md: string): Array<{ line: number; raw: string; info: string }> {
  const out: Array<{ line: number; raw: string; info: string }> = [];
  md.split("\n").forEach((ln, i) => {
    const m = ln.match(/^(\s{0,3})```(.*)$/);
    if (m) out.push({ line: i + 1, raw: ln, info: m[2].trim() });
  });
  return out;
}

describe("buildPrComment — code-fence well-formedness", () => {
  for (const [name, input] of SCENARIOS) {
    it(`${name}: fences are paired (even number of fence lines)`, () => {
      const fences = fenceLines(buildPrComment(input));
      expect(
        fences.length % 2,
        `Unpaired triple-backtick fences:\n` + fences.map((f) => `  L${f.line}: ${f.raw}`).join("\n"),
      ).toBe(0);
    });

    it(`${name}: every opening fence declares a language`, () => {
      const fences = fenceLines(buildPrComment(input));
      const missing: string[] = [];
      for (let i = 0; i < fences.length; i += 2) {
        const opener = fences[i];
        if (!opener.info) missing.push(`L${opener.line}: \`${opener.raw}\``);
      }
      expect(
        missing,
        `Opening fences missing a language tag (expected e.g. \`\`\`diff, \`\`\`sql):\n${missing.join("\n")}`,
      ).toEqual([]);
    });

    it(`${name}: every line has a balanced number of inline-code backticks`, () => {
      const md = buildPrComment(input);
      const fences = new Set(fenceLines(md).map((f) => f.line));
      const offenders: string[] = [];
      md.split("\n").forEach((ln, i) => {
        const lineNo = i + 1;
        if (fences.has(lineNo)) return; // skip fence delimiters themselves
        // Strip escaped backticks then count remaining ones.
        const stripped = ln.replace(/\\`/g, "");
        const tick = (stripped.match(/`/g) ?? []).length;
        if (tick % 2 !== 0) offenders.push(`L${lineNo}: ${ln}`);
      });
      expect(
        offenders,
        `Lines with unmatched inline backticks (would corrupt code-span rendering):\n${offenders.join("\n")}`,
      ).toEqual([]);
    });

    it(`${name}: opening fences inside this comment use only \`diff\` (no rogue languages)`, () => {
      // Defensive: the comment only emits ```diff today. If a new fence is
      // added, update this allow-list intentionally so reviewers notice.
      const allowed = new Set(["diff"]);
      const fences = fenceLines(buildPrComment(input));
      const langs: string[] = [];
      for (let i = 0; i < fences.length; i += 2) langs.push(fences[i].info);
      for (const lang of langs) {
        expect(allowed.has(lang), `Unexpected fence language: \`${lang}\``).toBe(true);
      }
    });
  }
});
