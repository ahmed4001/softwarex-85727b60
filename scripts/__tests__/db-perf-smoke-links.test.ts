/**
 * Validates that every Markdown link `[label](target …)` rendered by
 * `buildPrComment` has:
 *   - a non-empty label and a non-empty target,
 *   - a target that is either an in-page anchor (`#slug`) or an absolute
 *     `http(s)://` URL (no `javascript:`, no bare `()`, no whitespace),
 *   - a parseable URL for absolute targets (`new URL(...)` succeeds),
 *   - no obvious malformed escapes (unbalanced parens / brackets inside
 *     the target itself).
 *
 * Catches regressions like `(${runUrl}#artifacts)` rendering as `(#artifacts)`
 * when `runUrl` is unset, or a stray `]()` inside a query preview.
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
  ["pass-minimal-no-runUrl", base],
  [
    "fail-everything-with-runUrl",
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
      runUrl: "https://github.com/acme/app/actions/runs/42",
    },
  ],
];

interface Link {
  label: string;
  target: string;
  title?: string;
  line: number;
  raw: string;
}

/**
 * Pull every `[label](target)` or `[label](target "title")` link from the
 * comment, ignoring fenced code blocks (a `diff` patch may legitimately
 * contain `[..]()` literals that are not Markdown links).
 */
function extractLinks(md: string): Link[] {
  // Strip fenced blocks so their contents don't pollute the link scan.
  const noFences = md.replace(/```[\s\S]*?```/g, "");
  const links: Link[] = [];
  // Allow nested parens in URL via `[^)]*` plus optional `"title"` suffix.
  const re = /\[([^\]\n]+)\]\(([^()\s]+)(?:\s+"([^"]*)")?\)/g;
  noFences.split("\n").forEach((ln, i) => {
    for (const m of ln.matchAll(re)) {
      links.push({ label: m[1], target: m[2], title: m[3], line: i + 1, raw: m[0] });
    }
  });
  return links;
}

describe("buildPrComment — Markdown links are well-formed", () => {
  for (const [name, input] of SCENARIOS) {
    const md = buildPrComment(input);
    const links = extractLinks(md);

    it(`${name}: comment contains at least one link`, () => {
      expect(links.length, `No Markdown links found in:\n${md}`).toBeGreaterThan(0);
    });

    it(`${name}: every link has a non-empty label and target`, () => {
      const bad = links.filter((l) => !l.label.trim() || !l.target.trim());
      expect(bad, `Links with empty label/target:\n${bad.map((l) => `L${l.line}: ${l.raw}`).join("\n")}`).toEqual([]);
    });

    it(`${name}: every target is either an in-page anchor or an absolute http(s) URL`, () => {
      const offenders: string[] = [];
      for (const l of links) {
        const t = l.target;
        const ok =
          /^#[A-Za-z0-9][A-Za-z0-9-]*$/.test(t) ||
          /^https?:\/\/[^\s]+$/.test(t);
        if (!ok) offenders.push(`L${l.line}: target=\`${t}\` raw=${l.raw}`);
      }
      expect(
        offenders,
        `Targets are not a clean #anchor or http(s)://… URL:\n${offenders.join("\n")}`,
      ).toEqual([]);
    });

    it(`${name}: every absolute URL parses via the WHATWG URL constructor`, () => {
      const bad: string[] = [];
      for (const l of links) {
        if (!/^https?:\/\//.test(l.target)) continue;
        try {
          new URL(l.target);
        } catch {
          bad.push(`L${l.line}: ${l.target}`);
        }
      }
      expect(bad, `Unparseable URLs:\n${bad.join("\n")}`).toEqual([]);
    });

    it(`${name}: targets never contain whitespace, \`javascript:\`, or empty parens`, () => {
      const offenders: string[] = [];
      for (const l of links) {
        if (/\s/.test(l.target)) offenders.push(`whitespace in ${l.raw}`);
        if (/^javascript:/i.test(l.target)) offenders.push(`javascript: scheme in ${l.raw}`);
      }
      // The link regex also rejects literally-empty `()` because target is `[^()\s]+`.
      expect(/\]\(\s*\)/.test(md), "Found a literal `]()` empty-target link").toBe(false);
      expect(offenders, offenders.join("\n")).toEqual([]);
    });

    it(`${name}: every in-page #anchor target points at a slug that is actually rendered`, () => {
      const renderedSlugs = new Set<string>();
      for (const ln of md.split("\n")) {
        const m = ln.match(/^####\s+(.+?)\s*$/);
        if (m) {
          const slug = m[1].toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
          renderedSlugs.add(slug);
        }
      }
      const dangling: string[] = [];
      for (const l of links) {
        if (!l.target.startsWith("#")) continue;
        const slug = l.target.slice(1);
        if (!renderedSlugs.has(slug)) dangling.push(`L${l.line}: #${slug} (raw=${l.raw})`);
      }
      expect(
        dangling,
        `Anchor links point at headings that were not rendered:\n` +
          `  rendered: ${Array.from(renderedSlugs).join(", ")}\n` +
          dangling.join("\n"),
      ).toEqual([]);
    });
  }
});
