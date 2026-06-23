## Diagnosis

`.github/workflows/db-perf-smoke.yml` passes `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from **GitHub Actions repository secrets** to `scripts/db-perf-smoke.ts`. When those secrets aren't configured on the GitHub repo, the script exits with code 2 after ~3 seconds, printing `Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY env vars`. This matches the "Failed in 3 seconds" symptom.

These secrets are completely separate from Lovable Cloud secrets — Lovable can't set them for you; they have to be added in the GitHub repo settings.

## Fix — what you do (one-time, ~1 minute)

1. Open your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add two secrets with these exact names and values (copy from your project's `.env` — same values the Lovable app uses):
   - `VITE_SUPABASE_URL` → your Lovable Cloud project URL (looks like `https://<ref>.supabase.co`)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` → your publishable (anon) key
3. Re-run the failed `db-perf-smoke` workflow.

Both values are publishable / non-sensitive (the anon key is already shipped in your frontend bundle), so adding them as repo secrets is safe.

## Fix — what I do in this project

To make this failure mode much more obvious next time, I'll harden two things:

1. **`.github/workflows/db-perf-smoke.yml`** — add a pre-flight step that checks the secrets are present and fails with an actionable error pointing at the repo's Settings page (instead of relying on the script's generic exit 2).
2. **`scripts/db-perf-smoke.ts`** — upgrade the existing `Missing VITE_SUPABASE_URL…` error message to:
   - name each missing variable individually,
   - explain that they come from GitHub Actions repo secrets,
   - emit a GitHub workflow `::error::` annotation so the failure is clickable on the PR.

No app code, no database schema, no edge function changes — purely CI ergonomics.

## Out of scope (ask if you want them)

- Rotating the publishable key.
- Setting these as **organization-level** GitHub Actions secrets (useful if you have many repos).
- Adding the same guard to the SEO workflows.
