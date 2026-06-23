/**
 * Structural well-formedness check for the rendered PR comment markdown.
 *
 * Verifies block-level pairing rules that, if broken, would silently
 * collapse half the comment in GitHub's renderer:
 *
 *   - `<details>` / `</details>` open and close in strict LIFO order with
 *     no leftover openers/closers, and (per our design) never nest.
 *   - Every `<details>` is immediately followed by a `<summary>…</summary>`
 *     on the same line (no orphan details blocks).
 *   - Triple-backtick code fences are strictly paired; a fence may not be
 *     opened or closed while a `<details>` from a *different* section is
 *     still active.
 *   - `<details>` blocks and code fences never cross each other (no
 *     `<details>` … ``` … `</details>` ``` interleaving).
 *   - Markdown tables (contiguous `|` lines) live entirely inside a single
 *     block — no table started outside a `<details>` and finished inside
 *     one (or vice versa).
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

const failure = (i: number, over_max = true) => ({
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
  query_preview: `select * from t${i} where a = $1`,
});

const uncovered = (i: number) => ({
  query_id: `u-${String(i).padStart(6, "0")}`,
  mean_ms: 10 + i,
  max_ms: 30 + i,
  query_preview: `select count(*) from x${i}`,
});

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
  ["PASS — Active thresholds details only", base],
  [
    "FAIL — breaches + coverage gaps (strict) + missing indexes",
    {
      ...base,
      coverageStrict: true,
      body: {
        pass: false,
        threshold_failures: Array.from({ length: 5 }, (_, i) => failure(i)),
        hot_queries: Array.from({ length: 5 }, (_, i) => failure(i)),
        missing_indexes: ["public.reviews(product_id)"],
      },
      uncovered: [uncovered(1), uncovered(2)],
    },
  ],
  [
    "FAIL — suggested patch with diff fence + clamped table inside <details>",
    {
      ...base,
      coverageStrict: false,
      body: {
        pass: false,
        threshold_failures: [failure(1), failure(2, false)],
        hot_queries: [failure(1), failure(2, false)],
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
        ],
      },
      maxChangePct: 20,
      runUrl: "https://github.com/acme/app/actions/runs/42",
    },
  ],
];

interface Block {
  kind: "details" | "fence";
  openLine: number;
}

/**
 * Walk the markdown line-by-line and return a list of opened/closed block
 * events plus any structural error encountered. Tracks `<details>` and
 * triple-backtick fences as separate stacks but enforces that they don't
 * cross (an inner block must close before any outer block).
 */
function parseBlocks(md: string): { events: string[]; errors: string[] } {
  const events: string[] = [];
  const errors: string[] = [];
  const stack: Block[] = [];
  const lines = md.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const lineNo = i + 1;

    // Code fences — match a line that starts with ``` (optionally with a language tag).
    if (/^```/.test(ln)) {
      const top = stack[stack.length - 1];
      if (top && top.kind === "fence") {
        stack.pop();
        events.push(`close fence @${lineNo} (opened @${top.openLine})`);
      } else {
        stack.push({ kind: "fence", openLine: lineNo });
        events.push(`open fence @${lineNo}`);
      }
      continue;
    }

    // Inside an active fence, ignore <details>-like text (it's code content).
    if (stack.some((b) => b.kind === "fence")) continue;

    // <details ...> opener
    const openCount = (ln.match(/<details(\s[^>]*)?>/g) ?? []).length;
    const closeCount = (ln.match(/<\/details>/g) ?? []).length;

    for (let k = 0; k < openCount; k++) {
      // Our renderer always emits `<details><summary>…</summary>` on one line.
      if (!/<details(\s[^>]*)?><summary>.*<\/summary>/.test(ln)) {
        errors.push(`<details> without inline <summary> at line ${lineNo}: ${ln}`);
      }
      // No nested <details> in our design.
      const openDetails = stack.find((b) => b.kind === "details");
      if (openDetails) {
        errors.push(
          `nested <details> at line ${lineNo} while outer <details> from line ${openDetails.openLine} still open`,
        );
      }
      stack.push({ kind: "details", openLine: lineNo });
      events.push(`open details @${lineNo}`);
    }

    for (let k = 0; k < closeCount; k++) {
      const top = stack[stack.length - 1];
      if (!top) {
        errors.push(`</details> at line ${lineNo} with no matching opener`);
      } else if (top.kind !== "details") {
        errors.push(
          `</details> at line ${lineNo} but topmost open block is ${top.kind} (opened @${top.openLine}) — blocks cross`,
        );
      } else {
        stack.pop();
        events.push(`close details @${lineNo} (opened @${top.openLine})`);
      }
    }
  }

  for (const leftover of stack) {
    errors.push(`unclosed ${leftover.kind} opened at line ${leftover.openLine}`);
  }

  return { events, errors };
}

/** Find each contiguous table block (lines starting with `|`). */
function findTableRanges(md: string): Array<{ start: number; end: number }> {
  const lines = md.split("\n");
  const out: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("|")) {
      const start = i;
      while (i < lines.length && lines[i].startsWith("|")) i++;
      out.push({ start, end: i - 1 });
    } else {
      i++;
    }
  }
  return out;
}

/**
 * Return, for each line, the depth/state of "inside a <details>" so we can
 * confirm a table doesn't straddle a block boundary.
 */
function detailsStateByLine(md: string): boolean[] {
  const lines = md.split("\n");
  const state: boolean[] = [];
  let inDetails = false;
  let inFence = false;
  for (const ln of lines) {
    if (/^```/.test(ln)) {
      inFence = !inFence;
      state.push(inDetails);
      continue;
    }
    if (!inFence) {
      // Apply opens first so that an opener line counts as "inside".
      if (/<details(\s[^>]*)?>/.test(ln)) inDetails = true;
      state.push(inDetails);
      if (/<\/details>/.test(ln)) inDetails = false;
    } else {
      state.push(inDetails);
    }
  }
  return state;
}

describe("buildPrComment — block nesting & pairing", () => {
  for (const [name, input] of SCENARIOS) {
    describe(name, () => {
      const md = buildPrComment(input);
      const { errors } = parseBlocks(md);

      it("has no structural block errors (LIFO, no crossing, no orphans)", () => {
        expect(
          errors,
          `Block structure errors:\n  ${errors.join("\n  ")}\n--- MD ---\n${md}`,
        ).toEqual([]);
      });

      it("every `<details>` has a matching `</details>` (counts agree)", () => {
        const opens = (md.match(/<details(\s[^>]*)?>/g) ?? []).length;
        const closes = (md.match(/<\/details>/g) ?? []).length;
        expect(opens, "open vs close <details> mismatch").toBe(closes);
      });

      it("every `<details>` opener is immediately paired with `<summary>…</summary>` on the same line", () => {
        const orphans = md
          .split("\n")
          .map((ln, i) => ({ ln, i }))
          .filter(({ ln }) => /<details(\s[^>]*)?>/.test(ln))
          .filter(({ ln }) => !/<details(\s[^>]*)?><summary>.*<\/summary>/.test(ln));
        expect(
          orphans.map((o) => `line ${o.i + 1}: ${o.ln}`),
          "found <details> lines without inline <summary>",
        ).toEqual([]);
      });

      it("triple-backtick code fences are strictly paired", () => {
        const fenceLines = md.split("\n").filter((l) => /^```/.test(l)).length;
        expect(fenceLines % 2, `odd number of code fence lines (${fenceLines})`).toBe(0);
      });

      it("no `<details>` block ever contains a tag from a different block (no crossing)", () => {
        // parseBlocks already enforces this — re-assert by re-walking and
        // confirming the stack never holds two block kinds simultaneously
        // when a close occurs. This catches a regression where, say, a code
        // fence opens inside <details> and closes outside it.
        const lines = md.split("\n");
        const stack: Array<"details" | "fence"> = [];
        for (let i = 0; i < lines.length; i++) {
          const ln = lines[i];
          if (/^```/.test(ln)) {
            if (stack[stack.length - 1] === "fence") stack.pop();
            else {
              // A fence may only open inside <details> if it will close before </details>.
              stack.push("fence");
            }
            continue;
          }
          if (stack[stack.length - 1] === "fence") continue;
          if (/<details(\s[^>]*)?>/.test(ln)) stack.push("details");
          if (/<\/details>/.test(ln)) {
            // The topmost must be `details` — if a fence is still open here,
            // they cross.
            expect(
              stack[stack.length - 1],
              `crossing blocks at line ${i + 1}: </details> while fence still open`,
            ).toBe("details");
            stack.pop();
          }
        }
        expect(stack, `unclosed blocks at end: ${stack.join(", ")}`).toEqual([]);
      });

      it("no markdown table straddles a `<details>` boundary", () => {
        const state = detailsStateByLine(md);
        for (const t of findTableRanges(md)) {
          const startInside = state[t.start];
          const endInside = state[t.end];
          expect(
            startInside,
            `table at lines ${t.start + 1}-${t.end + 1} straddles a <details> boundary ` +
              `(start inside=${startInside}, end inside=${endInside})`,
          ).toBe(endInside);
        }
      });
    });
  }
});
