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

describe("queryId", () => {
  it("uses rule label when present", () => {
    expect(queryId({ matched_rule: { label: "Product By Slug" } })).toBe("rule-product-by-slug");
  });

  it("uses match hash when label missing", () => {
    const a = queryId({ matched_rule: { match: "from products where slug =" } });
    const b = queryId({ matched_rule: { match: "FROM PRODUCTS WHERE SLUG =" } });
    expect(a).toMatch(/^match-[a-f0-9]{10}$/);
    expect(a).toBe(b); // case-insensitive
  });

  it("hashes normalized preview when nothing matches", () => {
    const a = queryId({ query_preview: "select 1  from   x" });
    const b = queryId({ query_preview: "SELECT 1 FROM X" });
    expect(a).toMatch(/^q-[a-f0-9]{10}$/);
    expect(a).toBe(b);
  });

  it("is deterministic across calls", () => {
    const args = { query_preview: "select a from b" };
    expect(queryId(args)).toBe(queryId(args));
  });
});

describe("findUncovered", () => {
  it("returns queries with no matching rule", () => {
    const rules = [{ match: "from products" } as any, { match: "from reviews" } as any];
    const hot = [
      { query_preview: "select * from products where slug = $1" },
      { query_preview: "select * from orders where id = $1" },
      { query_preview: "SELECT * FROM REVIEWS WHERE product_id = $1" },
    ];
    const out = findUncovered(hot, rules);
    expect(out).toHaveLength(1);
    expect(out[0].query_preview).toMatch(/orders/);
  });

  it("returns all when there are no rules", () => {
    expect(findUncovered([{ query_preview: "x" }], [])).toHaveLength(1);
  });
});

describe("mergeSuggestions", () => {
  function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merge-"));
    const p = path.join(dir, "perf-thresholds.json");
    fs.writeFileSync(
      p,
      JSON.stringify({
        default: { mean_ms: 200, max_ms: 800 },
        ci: {
          mean_ms: 250,
          max_ms: 1000,
          queries: [{ label: "existing", match: "x", mean_ms: 10, max_ms: 20 }],
        },
        production: { mean_ms: 150, max_ms: 600 },
      }),
    );
    return p;
  }

  it("adds new rules and replaces by label", () => {
    const p = fixture();
    const merge = mergeSuggestions(p, "ci", [
      { label: "existing", match: "x", mean_ms: 99, max_ms: 199 },
      { label: "fresh", match: "y", mean_ms: 5, max_ms: 6 },
    ]);
    expect(merge.added.map((r) => r.label)).toEqual(["fresh"]);
    expect(merge.replaced.map((r) => r.label)).toEqual(["existing"]);
    expect(merge.mergedCount).toBe(2);
  });

  it("leaves other env blocks untouched when writing", () => {
    const p = fixture();
    mergeSuggestions(
      p,
      "ci",
      [{ label: "fresh", match: "y", mean_ms: 5, max_ms: 6 }],
      { write: true },
    );
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(raw.production).toEqual({ mean_ms: 150, max_ms: 600 });
    expect(raw.ci.queries).toHaveLength(2);
  });

  it("throws when env block is missing", () => {
    const p = fixture();
    expect(() =>
      mergeSuggestions(p, "nope", [{ label: "a", match: "a", mean_ms: 1, max_ms: 2 }]),
    ).toThrow(/missing/);
  });
});

describe("unifiedDiff", () => {
  it("renders +/- lines around a change", () => {
    const d = unifiedDiff("a\nb\nc\n", "a\nB\nc\n", "f.txt");
    expect(d).toMatch(/--- a\/f\.txt/);
    expect(d).toMatch(/\+\+\+ b\/f\.txt/);
    expect(d).toMatch(/-b/);
    expect(d).toMatch(/\+B/);
  });
});


import {
  loadLayeredThresholds,
  resolveThresholdsLayers,
  clampChange,
  renderHtmlReport,
  buildAnnotations,
  formatAnnotation,
} from "../perf-thresholds";

describe("loadLayeredThresholds", () => {
  it("merges scalars from later layers and unions queries by key", () => {
    const base = writeTempFile(
      JSON.stringify({
        default: { mean_ms: 100, max_ms: 400 },
        ci: { mean_ms: 250, max_ms: 1000, queries: [{ label: "a", match: "x", mean_ms: 10, max_ms: 20 }] },
      }),
    );
    const dir = path.dirname(base);
    const env = path.join(dir, "perf-thresholds.ci.json");
    fs.writeFileSync(
      env,
      JSON.stringify({
        default: { mean_ms: 100, max_ms: 400 },
        ci: { mean_ms: 300, queries: [{ label: "a", match: "x", mean_ms: 50, max_ms: 200 }, { label: "b", match: "y", mean_ms: 5, max_ms: 10 }] } as any,
      }),
    );
    const t = loadLayeredThresholds([base, env, path.join(dir, "missing.json")], "ci");
    expect(t.envKey).toBe("ci");
    expect(t.mean_ms).toBe(300);
    expect(t.max_ms).toBe(1000); // not overridden by env file
    const a = t.queries.find((q) => q.label === "a")!;
    expect(a.mean_ms).toBe(50);
    expect(a.max_ms).toBe(200);
    expect(t.queries.find((q) => q.label === "b")).toBeTruthy();
  });

  it("throws when the base file is missing", () => {
    expect(() => loadLayeredThresholds(["/nope/x.json"], "default")).toThrow(/not found/);
  });

  it("resolveThresholdsLayers builds env + local conventional names", () => {
    const layers = resolveThresholdsLayers("/tmp/perf-thresholds.json", "ci", ["/tmp/extra.json"]);
    expect(layers).toEqual([
      "/tmp/perf-thresholds.json",
      "/tmp/perf-thresholds.ci.json",
      "/tmp/perf-thresholds.local.json",
      "/tmp/extra.json",
    ]);
  });
});

describe("clampChange", () => {
  it("returns next unchanged when prev or pct missing", () => {
    expect(clampChange(undefined, 999, 25)).toBe(999);
    expect(clampChange(100, 200, undefined)).toBe(200);
    expect(clampChange(100, 200, 0)).toBe(200);
  });
  it("clamps upward and downward", () => {
    expect(clampChange(100, 500, 25)).toBe(125);
    expect(clampChange(100, 10, 25)).toBe(75);
    expect(clampChange(100, 110, 25)).toBe(110);
  });
});

describe("mergeSuggestions with maxChangePct", () => {
  it("clamps suggestions exceeding the cap and reports them", () => {
    const p = writeTempFile(
      JSON.stringify({
        default: { mean_ms: 100, max_ms: 400 },
        ci: { mean_ms: 200, max_ms: 800, queries: [{ label: "a", match: "x", mean_ms: 100, max_ms: 200 }] },
      }),
    );
    const merge = mergeSuggestions(
      p,
      "ci",
      [{ label: "a", match: "x", mean_ms: 1000, max_ms: 2000 }],
      { maxChangePct: 25 },
    );
    expect(merge.clamped.length).toBe(2);
    expect(merge.replaced[0].mean_ms).toBe(125);
    expect(merge.replaced[0].max_ms).toBe(250);
  });
});

describe("renderHtmlReport", () => {
  it("renders an HTML doc with the resolved env and failure rows", () => {
    const p = writeTempFile(JSON.stringify(validFile));
    const t = loadThresholds(p, "ci");
    const html = renderHtmlReport({
      resolved: t,
      layers: [p],
      hotQueries: [{ query_preview: "select 1", mean_ms: 10, max_ms: 20 }],
      failures: [
        { query_id: "rule-product-by-slug", matched_rule: { label: "product-by-slug", match: "from products where slug =" }, mean_ms: 300, max_ms: 800, applied_mean_ms: 50, applied_max_ms: 150, query_preview: "from products where slug =" },
      ],
    });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("PERF_ENV = ci");
    expect(html).toContain("rule-product-by-slug");
    expect(html).toContain("Breaching queries");
  });
});

describe("buildAnnotations + formatAnnotation", () => {
  it("locates rule line in thresholds and query_id line in report", () => {
    const thr = writeTempFile(JSON.stringify(validFile, null, 2));
    const dir = path.dirname(thr);
    const reportPath = path.join(dir, "perf-smoke-report.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        { threshold_failures: [{ query_id: "rule-product-by-slug", mean_ms: 300, max_ms: 800 }] },
        null,
        2,
      ),
    );
    const anns = buildAnnotations({
      thresholdsPath: thr,
      reportPath,
      failures: [
        {
          query_id: "rule-product-by-slug",
          matched_rule: { label: "product-by-slug", match: "from products where slug =" },
          mean_ms: 300,
          max_ms: 800,
          applied_mean_ms: 50,
          applied_max_ms: 150,
        },
      ],
    });
    expect(anns.length).toBeGreaterThanOrEqual(2);
    const cmd = formatAnnotation(anns[0]);
    expect(cmd.startsWith("::error file=")).toBe(true);
    expect(cmd).toContain("line=");
  });
});
