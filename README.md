# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Database performance smoke test

The repo ships a hourly + PR-triggered CI job (`.github/workflows/db-perf-smoke.yml`) that calls the `db-perf-smoke` edge function and fails the build when a required index is missing or a top hot query exceeds the configured latency thresholds.

### Thresholds file: `perf-thresholds.json`

Edit this file to tune limits — no code changes needed. The runner validates the file against a zod schema and fails fast with a clear error if anything is missing or has the wrong type.

```jsonc
{
  "default": {           // REQUIRED — fallback when PERF_ENV doesn't match
    "mean_ms": 200,      // REQUIRED — positive number, mean exec time ceiling
    "max_ms": 800,       // REQUIRED — positive number, max exec time ceiling
    "queries": []        // OPTIONAL — per-query overrides (see below)
  },
  "ci":         { "mean_ms": 250, "max_ms": 1000 },
  "staging":    { "mean_ms": 200, "max_ms": 800 },
  "production": {
    "mean_ms": 150,
    "max_ms": 600,
    "queries": [
      {
        "label": "product-by-slug",                  // OPTIONAL — stable id used in PR comment & merge key
        "match": "from products where slug =",       // REQUIRED — case-insensitive substring
        "mean_ms": 50,                               // OPTIONAL — overrides env mean_ms
        "max_ms": 150                                // OPTIONAL — overrides env max_ms
      }
    ]
  },
  "local":      { "mean_ms": 500, "max_ms": 2000 }
}
```

**Required keys per env block:** `mean_ms`, `max_ms` (both positive numbers).
**Optional:** `queries` — array of per-query rules. Each rule must set at least one of `mean_ms` / `max_ms`.

#### Per-query override matching

For each row returned by `pg_stat_statements`, the RPC walks `queries` in order and uses the **first rule whose `match` is a case-insensitive substring of the normalized SQL text**. If a rule matches, its `mean_ms` / `max_ms` replace the env defaults for that row; missing fields fall back to the env value. If no rule matches, the env defaults apply.

`label` is just a stable identifier — it shows up in CI output and is used as the merge key by `suggest:perf-thresholds`. When omitted, the runner falls back to `match`.

### Scripts

| Script | Purpose |
|---|---|
| `bun run test:perf` | Calls the edge function with the resolved thresholds; writes `perf-smoke-report.json` + `perf-smoke-summary.md`. Exits non-zero on breach. |
| `bun run lint:perf-thresholds` | Validates `perf-thresholds.json` against the zod schema and prints the resolved profile. Accepts `--dry-run` (also `PERF_DRY_RUN=1`) for CI dry runs that skip EXPLAIN ANALYZE. |
| `bun run suggest:perf-thresholds` | Reads the latest `perf-smoke-report.json` and prints suggested `mean_ms` / `max_ms` overrides for every breaching query (20% headroom, rounded up to 10 ms). Pass `--write` to merge them into the active env block. |

### Environment variables

| Var | Default | Description |
|---|---|---|
| `PERF_ENV` | `default` | Which env block to load from `perf-thresholds.json`. |
| `PERF_THRESHOLDS_FILE` | `./perf-thresholds.json` | Override the thresholds file path. |
| `PERF_REPORT_DIR` | `.` | Where the runner writes `perf-smoke-report.json` + `perf-smoke-summary.md`. |
| `PERF_REPORT_FILE` | `./perf-smoke-report/perf-smoke-report.json` | Where `suggest:perf-thresholds` reads from. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | — | Required by `test:perf` to reach the edge function. |

### CI dry run

Trigger the workflow manually via **Actions → db-perf-smoke → Run workflow → ✅ Dry run** to validate `perf-thresholds.json` and print the resolved profile **without** executing the smoke test.

