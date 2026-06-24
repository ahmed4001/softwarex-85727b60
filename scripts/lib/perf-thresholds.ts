/**
 * Shared loader + zod schema for `perf-thresholds.json`.
 *
 * Used by the perf-smoke runner, the standalone linter, and the
 * threshold-suggestion script. Any invalid file fails fast with the same
 * clear error message everywhere.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";

export const QueryRuleSchema = z
  .object({
    match: z.string().min(1, "`match` must be a non-empty string"),
    mean_ms: z.number().positive().optional(),
    max_ms: z.number().positive().optional(),
    mean_rows: z.number().nonnegative().optional(),
    max_rows: z.number().nonnegative().optional(),
    label: z.string().min(1).optional(),
  })
  .refine(
    (r) =>
      r.mean_ms !== undefined ||
      r.max_ms !== undefined ||
      r.mean_rows !== undefined ||
      r.max_rows !== undefined,
    {
      message:
        "each query rule must set at least one of `mean_ms`, `max_ms`, `mean_rows`, or `max_rows`",
    },
  );

export const EnvBlockSchema = z.object({
  mean_ms: z.number().positive(),
  max_ms: z.number().positive(),
  mean_rows: z.number().nonnegative().optional(),
  max_rows: z.number().nonnegative().optional(),
  queries: z.array(QueryRuleSchema).optional().default([]),
});

/** Override-layer blocks may omit scalar fields (they inherit from earlier layers). */
export const PartialEnvBlockSchema = z.object({
  mean_ms: z.number().positive().optional(),
  max_ms: z.number().positive().optional(),
  mean_rows: z.number().nonnegative().optional(),
  max_rows: z.number().nonnegative().optional(),
  queries: z.array(QueryRuleSchema).optional().default([]),
});

export const ThresholdsFileSchema = z
  .object({
    $schema: z.string().optional(),
    _comment: z.string().optional(),
    default: EnvBlockSchema,
  })
  .catchall(z.union([EnvBlockSchema, z.string(), z.undefined()]));

/** Schema for override layers: no required `default` block, partial env blocks allowed. */
export const PartialThresholdsFileSchema = z
  .object({
    $schema: z.string().optional(),
    _comment: z.string().optional(),
  })
  .catchall(z.union([PartialEnvBlockSchema, z.string(), z.undefined()]));

export type QueryRule = z.infer<typeof QueryRuleSchema>;
export type EnvBlock = z.infer<typeof EnvBlockSchema>;
export type ThresholdsFile = z.infer<typeof ThresholdsFileSchema>;

export interface ResolvedThresholds {
  envKey: string;
  mean_ms: number;
  max_ms: number;
  queries: QueryRule[];
  thresholdsPath: string;
  raw: ThresholdsFile;
}

export class ThresholdsValidationError extends Error {
  constructor(message: string, public details: string[] = []) {
    super(message);
    this.name = "ThresholdsValidationError";
  }
}

export function formatZodError(err: z.ZodError): string[] {
  return err.issues.map(
    (i) => `  • ${i.path.join(".") || "<root>"}: ${i.message}`,
  );
}

export function loadThresholds(
  filePath: string,
  envKey: string,
): ResolvedThresholds {
  return loadLayeredThresholds([filePath], envKey);
}

/**
 * Load and merge multiple thresholds files in order (later overrides earlier).
 *
 * Layering rules per environment block:
 *  - scalar fields (`mean_ms`, `max_ms`) — later file wins
 *  - `queries[]` — merged by key (`label` || `match`); later occurrences
 *    replace earlier ones, additional rules are appended preserving order.
 *
 * Missing files are silently skipped (so an optional `perf-thresholds.local.json`
 * is safe to leave out). The first file is treated as the base and MUST exist.
 */
export function loadLayeredThresholds(
  filePaths: string[],
  envKey: string,
): ResolvedThresholds {
  if (!filePaths.length) {
    throw new ThresholdsValidationError("No thresholds files provided");
  }
  const resolvedPaths = filePaths.map((p) => path.resolve(p));
  const layers: { path: string; data: ThresholdsFile }[] = [];
  for (let idx = 0; idx < resolvedPaths.length; idx++) {
    const abs = resolvedPaths[idx];
    if (!fs.existsSync(abs)) {
      if (idx === 0) {
        throw new ThresholdsValidationError(`Thresholds file not found: ${abs}`);
      }
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch (e) {
      throw new ThresholdsValidationError(
        `Invalid JSON in ${abs}: ${(e as Error).message}`,
      );
    }
    const schema = idx === 0 ? ThresholdsFileSchema : PartialThresholdsFileSchema;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      const details = formatZodError(result.error);
      throw new ThresholdsValidationError(
        `${abs} failed schema validation:\n${details.join("\n")}`,
        details,
      );
    }
    layers.push({ path: abs, data: result.data });
  }

  const pickBlock = (file: ThresholdsFile, key: string): EnvBlock | undefined => {
    const c = (file as Record<string, unknown>)[key];
    if (c && typeof c === "object") return c as EnvBlock;
    return undefined;
  };

  let effectiveKey = "default";
  for (const l of layers) {
    if (pickBlock(l.data, envKey)) {
      effectiveKey = envKey;
      break;
    }
  }

  let mean_ms: number | undefined;
  let max_ms: number | undefined;
  const queryMap = new Map<string, QueryRule>();
  const keyOf = (q: QueryRule) => q.label ?? q.match;

  for (const l of layers) {
    const block = pickBlock(l.data, effectiveKey) ?? pickBlock(l.data, "default");
    if (!block) continue;
    if (typeof block.mean_ms === "number") mean_ms = block.mean_ms;
    if (typeof block.max_ms === "number") max_ms = block.max_ms;
    for (const q of block.queries ?? []) queryMap.set(keyOf(q), q);
  }

  if (mean_ms === undefined || max_ms === undefined) {
    throw new ThresholdsValidationError(
      `No "${envKey}" or "default" block resolvable across ${resolvedPaths.join(", ")}`,
    );
  }

  return {
    envKey: effectiveKey,
    mean_ms,
    max_ms,
    queries: Array.from(queryMap.values()),
    thresholdsPath: resolvedPaths[0],
    raw: layers[layers.length - 1].data,
  };
}

/**
 * Resolve the default layered file list:
 *   1. base file (PERF_THRESHOLDS_FILE or perf-thresholds.json)
 *   2. perf-thresholds.<env>.json    (next to the base, if present)
 *   3. perf-thresholds.local.json    (next to the base, if present)
 *   4. extra files from PERF_THRESHOLDS_FILES (comma-separated)
 */
export function resolveThresholdsLayers(
  baseFile: string,
  envKey: string,
  extra: string[] = [],
): string[] {
  const dir = path.dirname(path.resolve(baseFile));
  const baseName = path.basename(baseFile, path.extname(baseFile));
  const ext = path.extname(baseFile) || ".json";
  return [
    baseFile,
    path.join(dir, `${baseName}.${envKey}${ext}`),
    path.join(dir, `${baseName}.local${ext}`),
    ...extra,
  ];
}

/** Render a resolved threshold profile as a markdown block. */
export function renderActiveThresholds(t: ResolvedThresholds): string {
  const lines: string[] = [];
  lines.push(
    `**Active thresholds** (\`PERF_ENV=${t.envKey}\`): mean ≤ **${t.mean_ms} ms**, max ≤ **${t.max_ms} ms**`,
  );
  if (t.queries.length) {
    lines.push("", "Per-query overrides:", "");
    lines.push("| label | match | mean (ms) | max (ms) |");
    lines.push("|---|---|---:|---:|");
    for (const q of t.queries) {
      lines.push(
        `| ${q.label ?? "—"} | \`${q.match.replace(/\|/g, "\\|")}\` | ${q.mean_ms ?? t.mean_ms} | ${q.max_ms ?? t.max_ms} |`,
      );
    }
  }
  return lines.join("\n");
}

/** Diff two resolved threshold blocks for the same env. */
export function diffThresholds(
  base: { mean_ms: number; max_ms: number; queries: QueryRule[] } | null,
  head: ResolvedThresholds,
): string | null {
  if (!base) return null;
  const changes: string[] = [];
  if (base.mean_ms !== head.mean_ms) {
    changes.push(`- mean_ms: \`${base.mean_ms}\` → \`${head.mean_ms}\``);
  }
  if (base.max_ms !== head.max_ms) {
    changes.push(`- max_ms: \`${base.max_ms}\` → \`${head.max_ms}\``);
  }

  const keyOf = (q: QueryRule) => q.label ?? q.match;
  const baseMap = new Map(base.queries.map((q) => [keyOf(q), q]));
  const headMap = new Map(head.queries.map((q) => [keyOf(q), q]));

  for (const [k, q] of headMap) {
    const prev = baseMap.get(k);
    if (!prev) {
      changes.push(
        `- ➕ rule \`${k}\`: mean=${q.mean_ms ?? "—"} max=${q.max_ms ?? "—"}`,
      );
    } else if (prev.mean_ms !== q.mean_ms || prev.max_ms !== q.max_ms) {
      changes.push(
        `- ✏️ rule \`${k}\`: mean ${prev.mean_ms ?? "—"} → ${q.mean_ms ?? "—"}, max ${prev.max_ms ?? "—"} → ${q.max_ms ?? "—"}`,
      );
    }
  }
  for (const [k] of baseMap) {
    if (!headMap.has(k)) changes.push(`- ➖ rule \`${k}\` removed`);
  }

  if (!changes.length) return null;
  return ["**Threshold changes vs base branch**", "", ...changes].join("\n");
}

export function loadBaseThresholds(
  envKey: string,
): { mean_ms: number; max_ms: number; queries: QueryRule[] } | null {
  const baseRef = process.env.GITHUB_BASE_REF;
  if (!baseRef) return null;
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const raw = execSync(`git show origin/${baseRef}:perf-thresholds.json`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    const parsed = ThresholdsFileSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const candidate = (parsed.data as Record<string, unknown>)[envKey];
    const block =
      candidate && typeof candidate === "object"
        ? (candidate as EnvBlock)
        : parsed.data.default;
    return {
      mean_ms: block.mean_ms,
      max_ms: block.max_ms,
      queries: block.queries ?? [],
    };
  } catch {
    return null;
  }
}

// ------------------ Suggestion helpers ------------------

export interface SuggestedRule {
  label: string;
  match: string;
  mean_ms: number;
  max_ms: number;
}

/** Slugify a query preview into a short stable label. */
export function deriveLabel(preview: string): string {
  return (
    preview
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .filter(Boolean)
      .slice(0, 6)
      .join("-") || "query"
  );
}

/** Add 20% headroom, round up to nearest 10ms (floor 10). */
export function bumpThreshold(observed: number): number {
  const v = Math.ceil((observed * 1.2) / 10) * 10;
  return Math.max(10, v);
}

export function suggestRule(input: {
  matched_rule?: { label?: string; match?: string };
  query_preview: string;
  mean_ms: number;
  max_ms: number;
}): SuggestedRule {
  const label =
    input.matched_rule?.label ??
    (input.matched_rule?.match
      ? deriveLabel(input.matched_rule.match)
      : deriveLabel(input.query_preview));
  const match =
    input.matched_rule?.match ?? input.query_preview.slice(0, 80).toLowerCase();
  return {
    label,
    match,
    mean_ms: bumpThreshold(input.mean_ms),
    max_ms: bumpThreshold(input.max_ms),
  };
}

// ------------------ Stable query IDs ------------------

function sha1Short(input: string, len = 10): string {
  return createHash("sha1").update(input).digest("hex").slice(0, len);
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}

/**
 * Deterministic anchor id for a hot-query entry. Stable across runs as long
 * as the matched rule or normalized query text doesn't change — line numbers
 * in the report are NOT used.
 */
export function queryId(input: {
  matched_rule?: { label?: string; match?: string } | null;
  query_preview?: string;
  query?: string;
}): string {
  const r = input.matched_rule ?? undefined;
  if (r?.label) return `rule-${slug(r.label)}`;
  if (r?.match) return `match-${sha1Short(r.match.toLowerCase())}`;
  const source = (input.query ?? input.query_preview ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `q-${sha1Short(source)}`;
}

// ------------------ Coverage + merge ------------------

/**
 * Return the subset of hot queries that aren't matched by any rule in the
 * env block. Matching mirrors the RPC: case-insensitive substring, first
 * match wins.
 */
export function findUncovered<T extends { query_preview?: string; query?: string }>(
  hotQueries: T[],
  rules: QueryRule[],
): T[] {
  const lcRules = rules.map((r) => r.match.toLowerCase());
  return hotQueries.filter((q) => {
    const text = (q.query ?? q.query_preview ?? "").toLowerCase();
    return !lcRules.some((m) => text.includes(m));
  });
}

export interface MergeResult {
  before: string;
  after: string;
  added: SuggestedRule[];
  replaced: SuggestedRule[];
  mergedCount: number;
  /** Suggestions that were clamped by `maxChangePct` (with the clamped value). */
  clamped: Array<{
    label: string;
    field: "mean_ms" | "max_ms";
    previous: number;
    requested: number;
    applied: number;
  }>;
}

/**
 * Clamp `next` to be within ±maxPct of `prev`. Returns the original `next`
 * when `prev` is missing or `maxPct` is not a positive finite number.
 */
export function clampChange(prev: number | undefined, next: number, maxPct: number | undefined): number {
  if (!prev || !Number.isFinite(prev)) return next;
  if (!maxPct || !Number.isFinite(maxPct) || maxPct <= 0) return next;
  const lo = prev * (1 - maxPct / 100);
  const hi = prev * (1 + maxPct / 100);
  return Math.min(hi, Math.max(lo, next));
}

/**
 * Merge `suggestions` into the env block's `queries` array (keyed by label,
 * falling back to match). Writes the file when `write=true` and returns the
 * before/after JSON text so callers can build a diff.
 *
 * `maxChangePct` (optional) caps how far a suggested mean_ms / max_ms may move
 * from the existing value (e.g. `25` = ±25% per run). New rules with no prior
 * value are not clamped. Falls back to env-block defaults when a per-query
 * rule didn't previously set the field.
 */
export function mergeSuggestions(
  filePath: string,
  envKey: string,
  suggestions: SuggestedRule[],
  opts: { write?: boolean; maxChangePct?: number } = {},
): MergeResult {
  const abs = path.resolve(filePath);
  const beforeText = fs.readFileSync(abs, "utf8");
  const raw = JSON.parse(beforeText);
  if (!raw[envKey] || typeof raw[envKey] !== "object") {
    throw new Error(`Cannot merge: env block "${envKey}" missing in ${abs}`);
  }
  const actualEnv = envKey;
  const envDefaults = {
    mean_ms: typeof raw[actualEnv].mean_ms === "number" ? raw[actualEnv].mean_ms : undefined,
    max_ms: typeof raw[actualEnv].max_ms === "number" ? raw[actualEnv].max_ms : undefined,
  };
  const existing: QueryRule[] = Array.isArray(raw[actualEnv].queries)
    ? raw[actualEnv].queries
    : [];
  const keyOf = (q: { label?: string; match: string }) => q.label ?? q.match;
  const map = new Map<string, QueryRule | SuggestedRule>();
  for (const q of existing) map.set(keyOf(q), q);
  const added: SuggestedRule[] = [];
  const replaced: SuggestedRule[] = [];
  const clamped: MergeResult["clamped"] = [];
  const maxPct = opts.maxChangePct;
  for (const s of suggestions) {
    const k = keyOf(s);
    const prev = map.get(k) as QueryRule | undefined;
    const prevMean = prev?.mean_ms ?? envDefaults.mean_ms;
    const prevMax = prev?.max_ms ?? envDefaults.max_ms;
    const appliedMean = clampChange(prevMean, s.mean_ms, maxPct);
    const appliedMax = clampChange(prevMax, s.max_ms, maxPct);
    const rounded = { ...s, mean_ms: Math.round(appliedMean), max_ms: Math.round(appliedMax) };
    if (prevMean !== undefined && rounded.mean_ms !== s.mean_ms) {
      clamped.push({ label: k, field: "mean_ms", previous: prevMean, requested: s.mean_ms, applied: rounded.mean_ms });
    }
    if (prevMax !== undefined && rounded.max_ms !== s.max_ms) {
      clamped.push({ label: k, field: "max_ms", previous: prevMax, requested: s.max_ms, applied: rounded.max_ms });
    }
    if (map.has(k)) replaced.push(rounded);
    else added.push(rounded);
    map.set(k, rounded);
  }
  const mergedArray = Array.from(map.values());
  raw[actualEnv].queries = mergedArray;
  const afterText = JSON.stringify(raw, null, 2) + "\n";
  if (opts.write) fs.writeFileSync(abs, afterText);
  return {
    before: beforeText.endsWith("\n") ? beforeText : beforeText + "\n",
    after: afterText,
    added,
    replaced,
    mergedCount: mergedArray.length,
    clamped,
  };
}

// ------------------ HTML report ------------------

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface HtmlReportInput {
  resolved: ResolvedThresholds;
  layers: string[];
  hotQueries: any[];
  failures: any[];
  suggestions?: SuggestedRule[];
  uncovered?: any[];
  generatedAt?: string;
}

/** Render a standalone HTML report visualising the resolved profile + diffs. */
export function renderHtmlReport(input: HtmlReportInput): string {
  const { resolved, layers, hotQueries, failures, suggestions = [], uncovered = [] } = input;
  const generated = input.generatedAt ?? new Date().toISOString();
  const sugMap = new Map(suggestions.map((s) => [s.label, s]));

  const failuresRows = failures.map((f) => {
    const id = f.query_id ?? queryId(f);
    const label = f.matched_rule?.label ?? f.matched_rule?.match ?? "(env default)";
    const sug = sugMap.get(label);
    const beforeMean = f.applied_mean_ms ?? resolved.mean_ms;
    const beforeMax = f.applied_max_ms ?? resolved.max_ms;
    const afterMean = sug?.mean_ms ?? bumpThreshold(Number(f.mean_ms));
    const afterMax = sug?.max_ms ?? bumpThreshold(Number(f.max_ms));
    const meanDelta = beforeMean ? Math.round(((afterMean - beforeMean) / beforeMean) * 100) : 0;
    const maxDelta = beforeMax ? Math.round(((afterMax - beforeMax) / beforeMax) * 100) : 0;
    return `<tr id="${htmlEscape(id)}">
      <td><code>${htmlEscape(id)}</code></td>
      <td>${htmlEscape(String(label))}</td>
      <td class="num">${f.mean_ms}</td>
      <td class="num">${f.max_ms}</td>
      <td>${beforeMean} → <b>${afterMean}</b> <span class="delta ${meanDelta >= 0 ? "up" : "down"}">${meanDelta >= 0 ? "+" : ""}${meanDelta}%</span></td>
      <td>${beforeMax} → <b>${afterMax}</b> <span class="delta ${maxDelta >= 0 ? "up" : "down"}">${maxDelta >= 0 ? "+" : ""}${maxDelta}%</span></td>
      <td class="num">${f.calls ?? "—"}</td>
      <td><code class="q">${htmlEscape(String(f.query_preview ?? ""))}</code></td>
    </tr>`;
  }).join("\n");

  const queriesRows = resolved.queries.map((q) => `<tr>
      <td>${htmlEscape(q.label ?? "—")}</td>
      <td><code>${htmlEscape(q.match)}</code></td>
      <td class="num">${q.mean_ms ?? resolved.mean_ms}</td>
      <td class="num">${q.max_ms ?? resolved.max_ms}</td>
    </tr>`).join("\n");

  const uncoveredRows = uncovered.map((q) => {
    const id = queryId(q);
    return `<tr><td><code>${htmlEscape(id)}</code></td><td><code class="q">${htmlEscape(String(q.query_preview ?? ""))}</code></td></tr>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>db-perf-smoke report — ${htmlEscape(resolved.envKey)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 1200px; margin: 24px auto; padding: 0 16px; }
  h1, h2 { border-bottom: 1px solid #8884; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 24px; font-size: 13px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #8883; vertical-align: top; text-align: left; }
  th { background: #8881; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  code { background: #8882; padding: 1px 4px; border-radius: 3px; }
  code.q { display: inline-block; max-width: 480px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
  .delta.up { color: #c0392b; font-weight: 600; }
  .delta.down { color: #2e7d32; font-weight: 600; }
  .meta { color: #888; font-size: 12px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #8882; margin-right: 4px; }
</style></head><body>
<h1>db-perf-smoke <span class="pill">PERF_ENV = ${htmlEscape(resolved.envKey)}</span></h1>
<p class="meta">Generated ${htmlEscape(generated)}. Layers (in order, later wins): ${layers.map((l) => `<code>${htmlEscape(l)}</code>`).join(" → ")}</p>

<h2>Resolved profile</h2>
<p><b>mean_ms ≤ ${resolved.mean_ms}</b> · <b>max_ms ≤ ${resolved.max_ms}</b> · ${resolved.queries.length} per-query rule${resolved.queries.length === 1 ? "" : "s"}</p>
${resolved.queries.length ? `<table><thead><tr><th>label</th><th>match</th><th>mean_ms</th><th>max_ms</th></tr></thead><tbody>${queriesRows}</tbody></table>` : "<p><em>No per-query overrides.</em></p>"}

<h2>Breaching queries — before / after threshold (${failures.length})</h2>
${failures.length ? `<table><thead><tr><th>id</th><th>rule</th><th>mean (ms)</th><th>max (ms)</th><th>mean: before → after</th><th>max: before → after</th><th>calls</th><th>query</th></tr></thead><tbody>${failuresRows}</tbody></table>` : "<p>None 🎉</p>"}

<h2>Coverage gaps (${uncovered.length})</h2>
${uncovered.length ? `<table><thead><tr><th>id</th><th>preview</th></tr></thead><tbody>${uncoveredRows}</tbody></table>` : "<p>All hot queries are covered by a threshold rule.</p>"}

<h2>Hot queries (${hotQueries.length})</h2>
<p class="meta">Full normalized text + EXPLAIN plans are in <code>perf-smoke-report.json</code>.</p>
</body></html>
`;
}

// ------------------ GitHub check annotations ------------------

export interface AnnotationInput {
  thresholdsPath: string;
  reportPath: string;
  failures: Array<{ query_id?: string; matched_rule?: { label?: string; match?: string } | null; mean_ms?: number; max_ms?: number; applied_mean_ms?: number; applied_max_ms?: number; query_preview?: string }>;
}

export interface Annotation {
  file: string;
  line: number;
  message: string;
}

/**
 * Build GitHub workflow-command annotations pointing at the failing rule
 * inside `perf-thresholds.json` and (when possible) the corresponding entry
 * inside the JSON report. Lines are located by string-matching, so output
 * works against any pretty-printed JSON.
 */
export function buildAnnotations(input: AnnotationInput): Annotation[] {
  const ann: Annotation[] = [];
  const readLines = (p: string): string[] | null => {
    try { return fs.readFileSync(p, "utf8").split("\n"); } catch { return null; }
  };
  const tLines = readLines(input.thresholdsPath);
  const rLines = readLines(input.reportPath);

  const findLine = (lines: string[] | null, needle: string): number | null => {
    if (!lines) return null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(needle)) return i + 1;
    }
    return null;
  };

  for (const f of input.failures) {
    const id = f.query_id ?? queryId(f as any);
    const ruleKey = f.matched_rule?.label ?? f.matched_rule?.match;
    const msg = `Query \`${id}\` breached threshold: mean=${f.mean_ms}ms (≤${f.applied_mean_ms ?? "—"}), max=${f.max_ms}ms (≤${f.applied_max_ms ?? "—"})`;

    if (ruleKey) {
      const needle = f.matched_rule?.label
        ? `"label": "${f.matched_rule.label}"`
        : `"match": "${f.matched_rule!.match}"`;
      const line = findLine(tLines, needle);
      if (line) ann.push({ file: path.relative(process.cwd(), input.thresholdsPath), line, message: `${msg} — rule "${ruleKey}"` });
    }

    const reportNeedle = `"query_id": "${id}"`;
    const reportLine = findLine(rLines, reportNeedle);
    if (reportLine) ann.push({ file: path.relative(process.cwd(), input.reportPath), line: reportLine, message: msg });
  }
  return ann;
}

/** Format an annotation as a GitHub workflow command line. */
export function formatAnnotation(a: Annotation, level: "error" | "warning" = "error"): string {
  const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  return `::${level} file=${a.file},line=${a.line},col=1::${esc(a.message)}`;
}


/** Tiny unified-diff renderer (line-by-line) for the PR comment block. */
export function unifiedDiff(before: string, after: string, label = "perf-thresholds.json"): string {
  const a = before.split("\n");
  const b = after.split("\n");
  const out: string[] = [`--- a/${label}`, `+++ b/${label}`];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(` ${a[i]}`);
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || !a.includes(b[j], i))) {
      out.push(`+${b[j]}`);
      j++;
    } else if (i < a.length) {
      out.push(`-${a[i]}`);
      i++;
    }
  }
  return out.join("\n");
}

