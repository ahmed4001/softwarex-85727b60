## Goals

1. **Per-query thresholds** — override mean/max for specific hot queries by SQL fingerprint/substring.
2. **Zod schema validation** of `perf-thresholds.json` with fail-fast clear errors.
3. **Thresholds linter CI step** that validates the file and prints the resolved `PERF_ENV` profile before the smoke test runs.
4. **PR comment enrichment** — show active thresholds and a before/after diff of what changed vs. the base branch.

## Changes

### 1. `perf-thresholds.json` — extend shape
Add an optional `queries` array per env block (and at top-level as `shared_queries` merged into each env):

```json
{
  "default": {
    "mean_ms": 200,
    "max_ms": 800,
    "queries": [
      { "match": "from products where slug =", "mean_ms": 50, "max_ms": 150, "label": "product-by-slug" },
      { "match": "select * from reviews where product_id", "mean_ms": 120, "max_ms": 400 }
    ]
  },
  "ci": { "mean_ms": 250, "max_ms": 1000, "queries": [] }
}
```

Matching is case-insensitive substring against the normalized query text. First match wins. If no match, env defaults apply.

### 2. `scripts/lib/perf-thresholds.ts` (new) — zod schema + loader
- Export `ThresholdsFileSchema` (zod) covering env blocks, optional `queries[]` with `match`/`mean_ms`/`max_ms`/optional `label`.
- Export `loadThresholds(path, envKey)` → `{ mean_ms, max_ms, queries, envKey, raw }`. On invalid JSON or schema mismatch, throw with a formatted error listing each issue path. Add `zod` to deps if not present.

### 3. `scripts/db-perf-smoke.ts` — use loader, pass per-query overrides
- Replace inline parsing with `loadThresholds(...)`. Fail fast (exit 2) on validation errors with a clear banner.
- POST `{ mean_ms, max_ms, queries }` to the edge function.
- After receiving results, if running in CI with a base ref, fetch `perf-thresholds.json` from the base branch (via `git show origin/${GITHUB_BASE_REF}:perf-thresholds.json`) and compute a diff (env defaults + per-query rules added/removed/changed). Include in `perf-smoke-summary.md`:
  - **Active thresholds** block (env + table of per-query overrides).
  - **Threshold changes vs base** block (only when diff is non-empty).

### 4. `scripts/lint-perf-thresholds.ts` (new)
Standalone entrypoint that:
- Loads + validates `perf-thresholds.json` via the shared loader.
- Prints resolved `PERF_ENV` profile (env defaults + per-query overrides).
- Exits 0 on success, 1 on validation failure with a clear error.

Add `package.json` script: `"lint:perf-thresholds": "tsx scripts/lint-perf-thresholds.ts"`.

### 5. `supabase/functions/db-perf-smoke/index.ts` — accept `queries`
- Zod-validate POST body: `{ mean_ms?: number, max_ms?: number, queries?: Array<{ match: string, mean_ms?: number, max_ms?: number, label?: string }> }`.
- Pass `_queries` (jsonb) to `db_perf_smoke` RPC.

### 6. Migration — extend `db_perf_smoke` RPC
Add a third parameter `_queries jsonb default '[]'`. In the breaching-query CTE, for each row, find the first `_queries` entry whose `match` (lowercased) is contained in `lower(query)`. Use that rule's `mean_ms`/`max_ms` when present, else fall back to `_mean_ms`/`_max_ms`. Include `matched_rule` (label or match string) in `threshold_failures` and `thresholds_applied` summary in the response.

### 7. `.github/workflows/db-perf-smoke.yml` — linter step + diff fetch
- Add step before "Run db-perf-smoke":
  ```yaml
  - name: Lint perf thresholds
    env: { PERF_ENV: ci }
    run: bun run lint:perf-thresholds
  ```
- Add `fetch-depth: 0` (or fetch base ref) to checkout so the diff step can read `origin/${{ github.base_ref }}:perf-thresholds.json` on pull requests.

## Out of scope
- Changing existing default values in `perf-thresholds.json`.
- Reworking the EXPLAIN capture logic.
