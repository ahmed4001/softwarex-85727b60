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
    label: z.string().min(1).optional(),
  })
  .refine((r) => r.mean_ms !== undefined || r.max_ms !== undefined, {
    message: "each query rule must set at least one of `mean_ms` or `max_ms`",
  });

export const EnvBlockSchema = z.object({
  mean_ms: z.number().positive(),
  max_ms: z.number().positive(),
  queries: z.array(QueryRuleSchema).optional().default([]),
});

export const ThresholdsFileSchema = z
  .object({
    $schema: z.string().optional(),
    _comment: z.string().optional(),
    default: EnvBlockSchema,
  })
  .catchall(z.union([EnvBlockSchema, z.string(), z.undefined()]));

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
  const thresholdsPath = path.resolve(filePath);

  if (!fs.existsSync(thresholdsPath)) {
    throw new ThresholdsValidationError(
      `Thresholds file not found: ${thresholdsPath}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(thresholdsPath, "utf8"));
  } catch (e) {
    throw new ThresholdsValidationError(
      `Invalid JSON in ${thresholdsPath}: ${(e as Error).message}`,
    );
  }

  const result = ThresholdsFileSchema.safeParse(parsed);
  if (!result.success) {
    const details = formatZodError(result.error);
    throw new ThresholdsValidationError(
      `perf-thresholds.json failed schema validation:\n${details.join("\n")}`,
      details,
    );
  }

  const file = result.data;
  const candidate = (file as Record<string, unknown>)[envKey];
  const block: EnvBlock | undefined =
    candidate && typeof candidate === "object"
      ? (candidate as EnvBlock)
      : file.default;

  if (!block) {
    throw new ThresholdsValidationError(
      `No "${envKey}" or "default" block in ${thresholdsPath}`,
    );
  }

  return {
    envKey: (file as Record<string, unknown>)[envKey] ? envKey : "default",
    mean_ms: block.mean_ms,
    max_ms: block.max_ms,
    queries: block.queries ?? [],
    thresholdsPath,
    raw: file,
  };
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
}

/**
 * Merge `suggestions` into the env block's `queries` array (keyed by label,
 * falling back to match). Writes the file when `write=true` and returns the
 * before/after JSON text so callers can build a diff.
 */
export function mergeSuggestions(
  filePath: string,
  envKey: string,
  suggestions: SuggestedRule[],
  opts: { write?: boolean } = {},
): MergeResult {
  const abs = path.resolve(filePath);
  const beforeText = fs.readFileSync(abs, "utf8");
  const raw = JSON.parse(beforeText);
  if (!raw[envKey] || typeof raw[envKey] !== "object") {
    throw new Error(`Cannot merge: env block "${envKey}" missing in ${abs}`);
  }
  const actualEnv = envKey;
  const existing: QueryRule[] = Array.isArray(raw[actualEnv].queries)
    ? raw[actualEnv].queries
    : [];
  const keyOf = (q: { label?: string; match: string }) => q.label ?? q.match;
  const map = new Map<string, QueryRule | SuggestedRule>();
  for (const q of existing) map.set(keyOf(q), q);
  const added: SuggestedRule[] = [];
  const replaced: SuggestedRule[] = [];
  for (const s of suggestions) {
    if (map.has(keyOf(s))) replaced.push(s);
    else added.push(s);
    map.set(keyOf(s), s);
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
  };
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

