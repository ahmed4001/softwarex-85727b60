## Goals

1. **Threshold-suggestion script** — read `perf-smoke-report.json` (richer than the markdown), output suggested `mean_ms`/`max_ms` overrides for breaching queries.
2. **Enhanced PR comment** — top breaching queries with before/after threshold numbers and links to the JSON report artifact (anchored by index).
3. **CI dry-run option** — flag in linter to also act as the "perf dry run" (resolve + lint + print profile, no EXPLAIN).
4. **Unit tests** for the loader + linter covering missing keys, wrong types, override precedence.
5. **README section** documenting the file format and per-query matching rules.

## Changes

### 1. `scripts/suggest-perf-thresholds.ts` (new)
- Reads `perf-smoke-report.json` (path via `PERF_REPORT_FILE`, default `perf-smoke-report/perf-smoke-report.json`).
- For each entry in `threshold_failures`, compute suggested values:
  - `mean_ms` = `ceil(observed_mean * 1.2 / 10) * 10` (20% headroom, rounded up to 10ms)
  - `max_ms` = `ceil(observed_max * 1.2 / 10) * 10`
  - Use the existing `matched_rule.label`/`matched_rule.match` when present; otherwise derive a slug from `query_preview` (first 6 tokens) and use the preview as `match`.
- Print a JSON snippet ready to paste into the chosen env block's `queries` array, plus a unified-diff-style preview against the current `perf-thresholds.json` (`PERF_ENV`).
- Optional `--write` flag to merge in place (rules keyed by `label`; existing same-labeled rules are replaced).
- Add script entry: `"suggest:perf-thresholds": "tsx scripts/suggest-perf-thresholds.ts"`.

### 2. PR comment enhancements in `scripts/db-perf-smoke.ts`
- Already has a breaching-queries table; extend it:
  - Sort by `(over_max desc, mean_ms desc)` and slice top 10.
  - Add **before → after** columns: `applied_mean_ms → suggested mean`, `applied_max_ms → suggested max` (using same 20% headroom formula).
  - Each row's first column is `[#N](artifact-url#L<lineNo>)` linking to the line number of that entry in `perf-smoke-report.json` (we compute line offsets when writing the JSON: re-serialize and scan for `"query_preview"` occurrences in order).
  - Artifact URL: GitHub doesn't deep-link inside artifacts, so the link points to the workflow run artifacts page (`…/actions/runs/<id>#artifacts`) with the JSON line number appended as a fragment hint, plus a one-liner explaining how to open the file.
- Add a "Top breaching queries" heading separate from the detail table when there are >10.

### 3. CI dry-run in linter — `scripts/lint-perf-thresholds.ts`
- Accept `--dry-run` flag (also via `PERF_DRY_RUN=1`). Behavior is identical (lint + print profile) but the success message explicitly states "dry-run: no EXPLAIN executed". Exit code unchanged.
- Workflow `.github/workflows/db-perf-smoke.yml`: add a `workflow_dispatch` input `dry_run` (boolean). When true, run only the linter step and skip the smoke + comment + fail steps via `if: ${{ !inputs.dry_run }}`.

### 4. Unit tests — `scripts/lib/__tests__/perf-thresholds.test.ts` and `scripts/__tests__/lint-perf-thresholds.test.ts`
Use Vitest (already in the project — confirm).
- **Loader tests**:
  - valid file → resolves env block, falls back to `default` when env key missing.
  - missing `mean_ms` / wrong type → `ThresholdsValidationError` with path in details.
  - invalid JSON → throws with path in message.
  - per-query rule without `mean_ms` AND `max_ms` → fails.
  - precedence: env-level `queries` returned; rule with both `mean_ms` and `max_ms` preserved.
  - `diffThresholds`: added/removed/changed rules, env-level scalar changes.
  - `renderActiveThresholds`: includes env name, formats query table.
- **Linter tests** (spawn `tsx scripts/lint-perf-thresholds.ts` via `node:child_process`, point `PERF_THRESHOLDS_FILE` at temp fixtures):
  - exits 0 on valid file with expected stdout markers.
  - exits 1 on missing keys (stderr contains the field path).
  - exits 1 on wrong types.
  - `--dry-run` exits 0 and stdout mentions dry-run.

### 5. README section — append to top-level `README.md`
New `## Database performance smoke test` section documenting:
- File location and JSON shape (with annotated example).
- Required keys per env block (`mean_ms`, `max_ms`); optional `queries[]`.
- Per-query rule shape (`match`, `mean_ms?`, `max_ms?`, `label?`) and matching semantics: case-insensitive substring against the normalized `pg_stat_statements` query text, first match wins, env defaults apply when nothing matches.
- How to select an env via `PERF_ENV`, where the runner posts (the edge function), how to override the path via `PERF_THRESHOLDS_FILE`.
- Scripts table: `test:perf`, `lint:perf-thresholds` (with `--dry-run`), `suggest:perf-thresholds`.

## Out of scope
- Changing existing threshold values for any env.
- Reworking EXPLAIN capture or the RPC.
- Auto-committing suggested values from CI (the suggest script's `--write` is local-only).
