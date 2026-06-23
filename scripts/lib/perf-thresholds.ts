/**
 * Shared loader + zod schema for `perf-thresholds.json`.
 *
 * Used by the perf-smoke runner, the standalone linter, and the
 * threshold-suggestion script. Any invalid file fails fast with the same
 * clear error message everywhere.
 */
import fs from "node:fs";
import path from "node:path";
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
