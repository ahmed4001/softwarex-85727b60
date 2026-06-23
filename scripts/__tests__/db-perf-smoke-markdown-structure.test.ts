/**
 * Structural lint for the PR comment markdown emitted by `buildPrComment`.
 *
 * Catches the kinds of breakage that snapshots tolerate but reviewers hate:
 *   - tables missing their `|---|` separator row, or with mismatched column
 *     counts across header / separator / body rows,
 *   - bullet lists where a row silently drops its `- ` prefix,
 *   - unbalanced ``` code fences (orphan opener or closer),
 *   - unbalanced `<details>` / `</details>` tags.
 *
 * Runs against several representative payloads so edge cases (empty
 * sections, single vs. plural counts, clamped rows, long previews with
 * embedded pipes) all stay well-formed.
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

function makeFailure(i: number, over_max = true) {
  return {
    query_id: `q-${String(i).padStart(6, "0")}`,
    matched_rule:
      i % 2 === 0
        ? { label: `rule-${i}`, match: `pattern-${i}`, mean_ms: 150, max_ms: 600 }
        : null,
    applied_mean_ms: 150,
    applied_max_ms: 600,
    mean_ms: 200 + i,
    max_ms: 800 + i,
    calls: 100 + i,
    over_max,
    explain_mode: "ANALYZE",
    // Intentionally include a pipe + newline to exercise the table-cell escaping.
    query_preview: `select * from t${i} where a | b = $1\n  and c = $2`,
  };
}

function makeUncovered(i: number) {
  return {
    query_id: `u-${String(i).padStart(6, "0")}`,
    mean_ms: 10 + i,
    max_ms: 30 + i,
    query_preview: `select count(*) from x${i} -- with | pipe`,
  };
}

const baseInput: BuildPrCommentInput = {
  status: 200,
  body: { pass: false, threshold_failures: [], hot_queries: [], missing_indexes: [] },
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
  [
    "PASS — no breaches, no gaps, no indexes, no patch",
    { ...baseInput, body: { pass: true, threshold_failures: [], hot_queries: [], missing_indexes: [] } },
  ],
  [
    "FAIL — 1 breach, 1 gap, 1 missing index (singular wording)",
    {
      ...baseInput,
      coverageStrict: true,
      body: {
        pass: false,
        threshold_failures: [makeFailure(1)],
        hot_queries: [makeFailure(1), makeUncovered(1)],
        missing_indexes: ["public.reviews(product_id)"],
      },
      uncovered: [makeUncovered(1)],
    },
  ],
  [
    "FAIL — 12 breaches (over the top-10 cap) + 20 gaps (over the top-15 cap)",
    {
      ...baseInput,
      coverageStrict: false,
      body: {
        pass: false,
        threshold_failures: Array.from({ length: 12 }, (_, i) => makeFailure(i, i % 3 !== 0)),
        hot_queries: Array.from({ length: 32 }, (_, i) => makeFailure(i)),
        missing_indexes: ["public.a(b)", "public.c(d)"],
      },
      uncovered: Array.from({ length: 20 }, (_, i) => makeUncovered(i)),
    },
  ],
  [
    "FAIL — suggested patch with clamped values (renders the clamped table + diff fence)",
    {
      ...baseInput,
      coverageStrict: true,
      body: {
        pass: false,
        threshold_failures: [makeFailure(1), makeFailure(2, false)],
        hot_queries: [makeFailure(1), makeFailure(2, false)],
        missing_indexes: [],
      },
      uncovered: [],
      suggestionsPatch:
        "--- a/perf-thresholds.json\n+++ b/perf-thresholds.json\n@@\n-  \"mean_ms\": 150\n+  \"mean_ms\": 270\n",
      mergeStats: {
        added: [],
        replaced: [],
        clamped: [
          { label: "products-list", field: "max_ms", previous: 600, requested: 1060, applied: 720 },
          { label: "rule-2", field: "mean_ms", previous: 150, requested: 400, applied: 180 },
        ],
      },
      maxChangePct: 20,
      runUrl: "https://github.com/acme/app/actions/runs/42",
    },
  ],
];

/** Split into lines but preserve empty separators between blocks. */
function lines(md: string): string[] {
  return md.split("\n");
}

/**
 * Find each markdown table (contiguous block where every line starts with `|`)
 * and check header / separator / body alignment.
 */
function findTables(md: string): Array<{ start: number; rows: string[] }> {
  const all = lines(md);
  const out: Array<{ start: number; rows: string[] }> = [];
  let i = 0;
  while (i < all.length) {
    if (all[i].startsWith("|")) {
      const start = i;
      const rows: string[] = [];
      while (i < all.length && all[i].startsWith("|")) {
        rows.push(all[i]);
        i++;
      }
      if (rows.length) out.push({ start, rows });
    } else {
      i++;
    }
  }
  return out;
}

function columnCount(row: string): number {
  // Strip leading/trailing pipe, then count UN-escaped `|` separators + 1.
  const trimmed = row.replace(/^\|/, "").replace(/\|\s*$/, "");
  let count = 1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "|" && trimmed[i - 1] !== "\\") count++;
  }
  return count;
}

const SEP_CELL = /^\s*:?-{3,}:?\s*$/;
function isSeparatorRow(row: string): boolean {
  const cells = row
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split(/(?<!\\)\|/);
  return cells.length > 0 && cells.every((c) => SEP_CELL.test(c));
}

function countOccurrences(src: string, needle: string): number {
  let n = 0;
  let i = 0;
  while ((i = src.indexOf(needle, i)) !== -1) {
    n++;
    i += needle.length;
  }
  return n;
}

describe("buildPrComment — markdown structure lint", () => {
  for (const [name, input] of SCENARIOS) {
    describe(name, () => {
      const md = buildPrComment(input);

      it("every markdown table has a header, a `|---|` separator, and consistent column counts", () => {
        const tables = findTables(md);
        // Sanity: the FAIL/patch scenarios should produce at least one table.
        if (input.body.threshold_failures.length || input.uncovered.length || input.mergeStats?.clamped.length) {
          expect(tables.length).toBeGreaterThan(0);
        }
        for (const t of tables) {
          expect(t.rows.length, `table at line ${t.start} has <2 rows`).toBeGreaterThanOrEqual(2);
          const headerCols = columnCount(t.rows[0]);
          expect(
            isSeparatorRow(t.rows[1]),
            `table at line ${t.start} is missing its \`|---|\` separator (got: ${t.rows[1]})`,
          ).toBe(true);
          const sepCols = columnCount(t.rows[1]);
          expect(sepCols, `separator col count != header for table at line ${t.start}`).toBe(headerCols);
          for (let r = 2; r < t.rows.length; r++) {
            const c = columnCount(t.rows[r]);
            expect(
              c,
              `table at line ${t.start}, row ${r} has ${c} cols, expected ${headerCols}\nrow: ${t.rows[r]}`,
            ).toBe(headerCols);
          }
        }
      });

      it("bullet-list blocks never lose their `- ` prefix mid-block", () => {
        const all = lines(md);
        for (let i = 0; i < all.length; i++) {
          if (!all[i].startsWith("- ")) continue;
          // Walk the contiguous list and assert each non-empty line is still a bullet.
          let j = i;
          while (j < all.length && all[j] !== "") {
            const ln = all[j];
            // Allow `- ` bullets and indented continuations starting with 2+ spaces.
            const ok = ln.startsWith("- ") || ln.startsWith("  ");
            expect(ok, `list starting at line ${i} broke at line ${j}: ${JSON.stringify(ln)}`).toBe(true);
            j++;
          }
          i = j;
        }
      });

      it("code fences (```), <details>, and </details> tags are balanced", () => {
        // Count standalone ``` fence markers (line starts with ``` optionally followed by a lang).
        const fences = lines(md).filter((l) => /^```/.test(l)).length;
        expect(fences % 2, `unbalanced \`\`\` fences (got ${fences})`).toBe(0);

        const opens = countOccurrences(md, "<details");
        const closes = countOccurrences(md, "</details>");
        expect(opens, `<details> openers (${opens}) != </details> closers (${closes})`).toBe(closes);
      });

      it("never emits an empty table cell row or a stray bare pipe line", () => {
        for (const ln of lines(md)) {
          if (ln === "|" || ln === "||") {
            throw new Error(`stray bare pipe line: ${JSON.stringify(ln)}`);
          }
        }
      });
    });
  }
});
