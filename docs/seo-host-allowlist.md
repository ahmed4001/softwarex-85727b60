# SEO host allowlist

All SEO CI gates (canonical, JSON-LD `@id`/`url`, og/twitter URLs and images,
hreflang, sitemap, sitemap index, PWA manifest) compare the host of every
emitted URL against `SITE_URL`. Anything that doesn't match fails the build
unless the host is explicitly allowed.

`seo-host-allowlist.json` (repo root) is the source of truth. Env vars
`SEO_ALLOWED_HOSTS` and `SEO_ALLOWED_HOSTS_<GATE>` extend it at runtime.

The file ships with a companion **JSON Schema** at
[`seo-host-allowlist.schema.json`](../seo-host-allowlist.schema.json) — the
top-level `"$schema": "./seo-host-allowlist.schema.json"` line wires up
autocompletion and inline error highlighting in any JSON-Schema-aware
editor (VS Code, JetBrains, neovim/`coc-json`, …) so typos surface as
you type, not in CI.

A dedicated CI job — **`seo-host-allowlist-validate`** — runs the
project's strict validator (and the JSON Schema, via Ajv) **before** any
SEO host gate executes. Failures appear as `::error` annotations
pinned to the offending line of `seo-host-allowlist.json` on the PR.

Run it locally with:

```bash
bun run validate:seo-host-allowlist
```

---

## File format

```json
{
  "_comment": "free-form metadata, ignored by the loader",
  "_default":           ["cdn.example.com"],
  "sitemap-hosts":      [],
  "sitemap-index-hosts":[],
  "manifest-hosts":     [],
  "prerender-canonicals":[],
  "jsonld-hosts":       ["*.cdn.example.com"],
  "social-url-hosts":   [],
  "social-image-hosts": ["images.example.com"],
  "hreflang-hosts":     []
}
```

### Keys

| Key                                              | Meaning                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `_default`                                       | Hosts allowed for **every** gate. Merged with every gate's own list.                           |
| `_<anything>` (e.g. `_comment`, `_notes`)        | Free-form metadata, ignored by the loader.                                                     |
| One of the canonical gate names (see list below) | Hosts allowed for that specific gate only.                                                     |
| Anything else                                    | **Rejected** at load time with a clear error listing the known gates — typos fail the CI fast. |

Canonical gate names (see `KNOWN_GATES` in `scripts/lib/seo-hosts.ts`):
`sitemap-hosts`, `sitemap-index-hosts`, `manifest-hosts`,
`prerender-canonicals`, `jsonld-hosts`, `social-url-hosts`,
`social-image-hosts`, `hreflang-hosts`.

### Values

Each value must be a JSON array of **host strings**. Each entry is one of:

- A bare hostname: `cdn.example.com`, `img-cdn.sub.example.co.uk`
- A wildcard subdomain: `*.example.com` — matches one or more additional
  labels (`cdn.example.com`, `a.b.example.com`), but **not** the bare
  apex (`example.com`).

### Wildcard rules

- Only a **single leading `*.`** is allowed. `cdn.*.example.com` is rejected.
- A bare `*` is rejected. Wildcards must have at least one literal label.
- `**` is rejected. Use exactly one star.
- The matched portion of the host must be a normal DNS label (letters,
  digits, hyphens; no leading/trailing hyphen).

### What is rejected

The loader throws `AllowlistConfigError` with a clear message if the file:

- isn't valid JSON or isn't a JSON object,
- has an unknown gate key (typos like `social-urls` instead of `social-url-hosts`),
- has a non-array value for a gate key,
- contains entries with schemes (`https://…`), paths (`/foo`), or ports (`:443`),
- contains malformed wildcards or empty / non-string entries.

`scripts/lib/seo-hosts.test.ts` pins this behavior — invalid configs cannot
be merged without first updating the tests.

---

## Runtime overrides

Both env vars take a **comma-separated list of hosts**. They extend (never
replace) the file's allowlist. The same wildcard rules apply, but env-var
entries are **not** validated against the schema, so prefer the file for
permanent additions.

| Variable                                                                            | Scope                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| `SEO_ALLOWED_HOSTS`                                                                 | Applies to **every** gate (like `_default`).   |
| `SEO_ALLOWED_HOSTS_<GATE_UPPER_SNAKE>` (e.g. `SEO_ALLOWED_HOSTS_SOCIAL_IMAGE_HOSTS`) | Applies to that **one** gate only.             |

Gate name → env var:

| Gate                  | Env var                                  |
| --------------------- | ---------------------------------------- |
| `sitemap-hosts`       | `SEO_ALLOWED_HOSTS_SITEMAP_HOSTS`        |
| `sitemap-index-hosts` | `SEO_ALLOWED_HOSTS_SITEMAP_INDEX_HOSTS`  |
| `manifest-hosts`      | `SEO_ALLOWED_HOSTS_MANIFEST_HOSTS`       |
| `prerender-canonicals`| `SEO_ALLOWED_HOSTS_PRERENDER_CANONICALS` |
| `jsonld-hosts`        | `SEO_ALLOWED_HOSTS_JSONLD_HOSTS`         |
| `social-url-hosts`    | `SEO_ALLOWED_HOSTS_SOCIAL_URL_HOSTS`     |
| `social-image-hosts`  | `SEO_ALLOWED_HOSTS_SOCIAL_IMAGE_HOSTS`   |
| `hreflang-hosts`      | `SEO_ALLOWED_HOSTS_HREFLANG_HOSTS`       |

Examples:

```bash
# Locally tolerate a staging CDN for one run, on every gate
SEO_ALLOWED_HOSTS="staging-cdn.example.com" bun run check:jsonld-hosts

# Allow a CDN for images only
SEO_ALLOWED_HOSTS_SOCIAL_IMAGE_HOSTS="images.cloudfront.net,*.imgix.net" \
  bun run check:social-image-hosts
```

---

## Debugging a single gate locally

The aggregator accepts `--gate <name>` so you can re-run one gate and
get a per-gate report under `seo-host-report/`:

```bash
# List the known gate names
bun run report:seo-host-gates --list-gates

# Re-run just the JSON-LD gate and write report-default.{json,md}
SITE_URL=https://example.com \
  bun run report:seo-host-gates --gate jsonld-hosts

# Reuse an existing per-gate report instead of re-running
SEO_REUSE_REPORTS=1 SEO_REPORT_DIR=./seo-host-report \
  bun run report:seo-host-gates --gate jsonld-hosts
```

The aggregated report (`seo-host-report/report-<label>.md`) is also the
artifact uploaded by the GitHub workflow. It includes:

- **Per-violation snippets** — the actual `<meta>`/`<loc>`/JSON
  fragment around the offending host, so root-causing a failure does
  not require opening the file.
- **Allowlist usage tables** — every configured entry is split into
  *“matched at least once”* (with hit count + which gates) and
  *“unused — consider removing”*. Use this to keep the allowlist tight
  over time and to spot entries that quietly became dead code.
