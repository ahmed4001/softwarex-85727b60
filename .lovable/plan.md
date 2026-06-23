## Goals

1. **Coverage check** — fail CI when a query in `perf-smoke-report.json` has neither a matching per-query rule nor falls under an explicit env override.
2. **Apply-suggestions option** — let the suggestion script (and a CI step on `workflow_dispatch`) write suggestions back into `perf-thresholds.json` and surface a ready-to-commit diff in the PR comment.
3. **Stable anchors** — emit deterministic `query_id` for each entry in `perf-smoke-report.json`; PR comment links use anchors instead of line numbers.
4. **Resolved-profile artifact** — write the fully resolved `PERF_ENV` profile (env defaults + merged per-query overrides) and upload as a CI artifact.

## Changes

### 1. Stable query IDs — `scripts/lib/perf-thresholds.ts`
Add `queryId(input)` → short stable hash:
- If `matched_rule.label` exists, use `rule-<slug(label)>`.
- Else if `matched_rule.match` exists, use `match-<sha1(match).slice(0,10)>`.
- Else `q-<sha1(normalize(query_preview)).slice(0,10)>` where `normalize` lowercases and collapses whitespace.

### 2. Runner — `scripts/db-perf-smoke.ts`
- After receiving the response, enrich each `threshold_failures[i]` and each `hot_queries[i]` with a `query_id` before writing `perf-smoke-report.json` (so the artifact carries the stable ID).
- Use those IDs in the PR comment table's first column. Links point to the run page `#artifacts` plus a `?q=<id>` query hint (and a tooltip explaining the ID is searchable inside `perf-smoke-report.json`).
- Always also write `perf-smoke-resolved-profile.json` containing: `{ envKey, mean_ms, max_ms, queries }` (merged from file + any rule that actually matched a row, so reviewers see what was applied).
- Coverage check: compute uncovered = hot queries with no matching rule. Default behavior is **warn only**; when `PERF_COVERAGE_STRICT=1`, exit non-zero and list them in the PR comment under a **Coverage gaps** section.
- Apply-suggestions: when `PERF_APPLY_SUGGESTIONS=1`, after computing suggestions, call shared `mergeSuggestions(thresholdsPath, envKey, suggestions)` from the suggest lib, write the file, generate `perf-thresholds.diff.patch` next to the report (via `git diff --no-index`), and embed a fenced diff block in the PR comment as **Suggested patch (ready to commit)**.

### 3. Suggestion script — `scripts/suggest-perf-thresholds.ts`
- Extract the merge logic into `scripts/lib/perf-thresholds.ts` as `mergeSuggestions(filePath, envKey, suggestions): { before: string, after: string }` so the runner can reuse it.
- Keep the existing `--write` CLI flag delegating to the new helper. Print the unified diff using the helper output.

### 4. Workflow — `.github/workflows/db-perf-smoke.yml`
- Add `workflow_dispatch` inputs:
  - `apply_suggestions` (boolean, default false) — sets `PERF_APPLY_SUGGESTIONS=1` for the run.
  - `coverage_strict` (boolean, default false) — sets `PERF_COVERAGE_STRICT=1`.
- Both env vars default to `0` on push/pull_request/schedule unless set.
- Upload `perf-smoke-resolved-profile.json` and `perf-thresholds.diff.patch` (if present) alongside the existing report artifact.

### 5. Unit tests — `scripts/lib/__tests__/perf-thresholds.test.ts`
Add cases for:
- `queryId` determinism + label/match/preview precedence.
- `mergeSuggestions` adds new rules, replaces by label, leaves other env blocks untouched, fails when env block missing.
- `findUncovered(hotQueries, rules, envKey)` returns the right set when no rule matches.

## Out of scope
- Auto-committing the patch from CI (we only produce + attach it).
- Changing threshold values.
- Backend RPC changes — `query_id` is computed client-side in the runner.
