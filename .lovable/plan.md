## Goal

Persist the db-perf-smoke / `perf-thresholds.json` system to project memory so future sessions know it exists and follow the established conventions instead of reinventing them.

## Changes

1. **Create `mem://features/perf-thresholds-ci`** — a single feature-type memory describing:
   - Purpose: CI guard that runs `EXPLAIN ANALYZE` on hot queries via the `db-perf-smoke` edge function and fails on threshold breaches / missing indexes / coverage gaps.
   - Layered config: base `perf-thresholds.json` → `perf-thresholds.<PERF_ENV>.json` → `perf-thresholds.local.json` → `PERF_THRESHOLDS_FILES`. Later wins; queries merge by `label` (fallback `match`).
   - Scripts: `test:perf`, `lint:perf-thresholds` (`--dry-run`), `suggest:perf-thresholds` (`--write`, `--max-change-pct=N`).
   - Library entry points in `scripts/lib/perf-thresholds.ts`: `loadLayeredThresholds`, `resolveThresholdsLayers`, `mergeSuggestions` (with `maxChangePct` clamp), `findUncovered`, `queryId`, `renderHtmlReport`, `buildAnnotations`.
   - Env vars: `PERF_ENV`, `PERF_APPLY_SUGGESTIONS`, `PERF_COVERAGE_STRICT`, `PERF_MAX_CHANGE_PCT`, `PERF_ANNOTATIONS`.
   - Artifacts: `perf-smoke-report.json`, `perf-smoke-report.html`, `perf-smoke-resolved-profile.json`, `perf-smoke-summary.md`, `perf-thresholds.diff.patch`.
   - Workflow: `.github/workflows/db-perf-smoke.yml` (push, PR, hourly cron, manual dispatch with toggles).
   - Conventions: never edit generated artifacts; stable `query_id` anchors are the link key in PR comments; annotations are emitted as `::error file=…` workflow commands.

2. **Update `mem://index.md`** — add a Core one-liner ("Perf CI uses layered `perf-thresholds.*.json` files; per-query rules keyed by label/match.") and a Memories reference line linking to the new file.

## Out of scope

No code changes — memory only.