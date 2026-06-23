import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadThresholds,
  diffThresholds,
  renderActiveThresholds,
  bumpThreshold,
  deriveLabel,
  suggestRule,
  queryId,
  findUncovered,
  mergeSuggestions,
  unifiedDiff,
  ThresholdsValidationError,
} from "../perf-thresholds";

function writeTempFile(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-thresholds-"));
  const p = path.join(dir, "perf-thresholds.json");
  fs.writeFileSync(p, content);
  return p;
}

const validFile = {
  default: { mean_ms: 200, max_ms: 800 },
  ci: {
    mean_ms: 250,
    max_ms: 1000,
    queries: [
      { label: "product-by-slug", match: "from products where slug =", mean_ms: 50, max_ms: 150 },
    ],
  },
};

describe("loadThresholds", () => {
  it("resolves the requested env block with its overrides", () => {
    const p = writeTempFile(JSON.stringify(validFile));
    const t = loadThresholds(p, "ci");
    expect(t.envKey).toBe("ci");
    expect(t.mean_ms).toBe(250);
    expect(t.max_ms).toBe(1000);
    expect(t.queries).toHaveLength(1);
    expect(t.queries[0].label).toBe("product-by-slug");
  });

  it("falls back to default when env key is missing", () => {
    const p = writeTempFile(JSON.stringify(validFile));
    const t = loadThresholds(p, "nope");
    expect(t.envKey).toBe("default");
    expect(t.mean_ms).toBe(200);
    expect(t.queries).toEqual([]);
  });

  it("throws ThresholdsValidationError when mean_ms is missing", () => {
    const p = writeTempFile(JSON.stringify({ default: { max_ms: 800 } }));
    expect(() => loadThresholds(p, "default")).toThrow(ThresholdsValidationError);
    try {
      loadThresholds(p, "default");
    } catch (e) {
      expect((e as ThresholdsValidationError).message).toMatch(/mean_ms/);
    }
  });

  it("throws when a field has the wrong type", () => {
    const p = writeTempFile(
      JSON.stringify({ default: { mean_ms: "fast", max_ms: 800 } }),
    );
    expect(() => loadThresholds(p, "default")).toThrow(/mean_ms/);
  });

  it("rejects negative thresholds", () => {
    const p = writeTempFile(JSON.stringify({ default: { mean_ms: -1, max_ms: 800 } }));
    expect(() => loadThresholds(p, "default")).toThrow(ThresholdsValidationError);
  });

  it("rejects a query rule with neither mean_ms nor max_ms", () => {
    const p = writeTempFile(
      JSON.stringify({
        default: {
          mean_ms: 200,
          max_ms: 800,
          queries: [{ match: "foo" }],
        },
      }),
    );
    expect(() => loadThresholds(p, "default")).toThrow(/mean_ms.*max_ms/i);
  });

  it("preserves rules that set both mean_ms and max_ms (precedence)", () => {
    const p = writeTempFile(
      JSON.stringify({
        default: {
          mean_ms: 200,
          max_ms: 800,
          queries: [{ match: "x", mean_ms: 5, max_ms: 7, label: "x" }],
        },
      }),
    );
    const t = loadThresholds(p, "default");
    expect(t.queries[0]).toMatchObject({ mean_ms: 5, max_ms: 7, label: "x" });
  });

  it("throws on missing file", () => {
    expect(() => loadThresholds("/nonexistent/x.json", "default")).toThrow(
      /not found/,
    );
  });

  it("throws on invalid JSON", () => {
    const p = writeTempFile("{ this is not json");
    expect(() => loadThresholds(p, "default")).toThrow(/Invalid JSON/);
  });
});

describe("diffThresholds", () => {
  const base = { mean_ms: 200, max_ms: 800, queries: [] };
  const head = (q: any) =>
    ({
      envKey: "default",
      mean_ms: 200,
      max_ms: 800,
      queries: q,
      thresholdsPath: "",
      raw: {} as any,
    });

  it("returns null when nothing changes", () => {
    expect(diffThresholds(base, head([]))).toBeNull();
  });

  it("detects scalar threshold changes", () => {
    const out = diffThresholds(base, { ...head([]), mean_ms: 250 });
    expect(out).toMatch(/mean_ms.*200.*250/);
  });

  it("detects added, removed, and changed rules", () => {
    const baseQ = {
      mean_ms: 200,
      max_ms: 800,
      queries: [
        { label: "a", match: "a", mean_ms: 10, max_ms: 20 },
        { label: "b", match: "b", mean_ms: 30, max_ms: 40 },
      ],
    };
    const out = diffThresholds(
      baseQ,
      head([
        { label: "a", match: "a", mean_ms: 15, max_ms: 20 },
        { label: "c", match: "c", mean_ms: 1, max_ms: 2 },
      ]),
    )!;
    expect(out).toMatch(/➕ rule `c`/);
    expect(out).toMatch(/➖ rule `b`/);
    expect(out).toMatch(/✏️ rule `a`/);
  });
});

describe("renderActiveThresholds", () => {
  it("includes env name and per-query table", () => {
    const t = loadThresholds(writeTempFile(JSON.stringify(validFile)), "ci");
    const md = renderActiveThresholds(t);
    expect(md).toMatch(/PERF_ENV=ci/);
    expect(md).toMatch(/product-by-slug/);
    expect(md).toMatch(/\| label \|/);
  });
});

describe("suggestion helpers", () => {
  it("bumpThreshold adds 20% headroom rounded up to 10ms", () => {
    expect(bumpThreshold(100)).toBe(120);
    expect(bumpThreshold(101)).toBe(130);
    expect(bumpThreshold(0)).toBe(10);
  });

  it("deriveLabel produces a slug from a preview", () => {
    expect(deriveLabel("SELECT * FROM products WHERE slug = $1")).toBe(
      "select-from-products-where-slug-1",
    );
    expect(deriveLabel("")).toBe("query");
  });

  it("suggestRule reuses matched_rule label/match when present", () => {
    const r = suggestRule({
      matched_rule: { label: "L", match: "M" },
      query_preview: "select 1",
      mean_ms: 100,
      max_ms: 200,
    });
    expect(r).toEqual({ label: "L", match: "M", mean_ms: 120, max_ms: 240 });
  });

  it("suggestRule derives label from query_preview when no match", () => {
    const r = suggestRule({
      query_preview: "SELECT * FROM reviews WHERE product_id = $1",
      mean_ms: 50,
      max_ms: 60,
    });
    expect(r.label).toMatch(/select-from-reviews/);
    expect(r.match).toMatch(/select \* from reviews/);
  });
});
