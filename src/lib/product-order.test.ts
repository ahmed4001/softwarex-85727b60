import { describe, it, expect, beforeEach } from "vitest";
import {
  applyRealFirstOrder,
  realFirstComparator,
  setProductOrderConfig,
  resetProductOrderConfig,
} from "./product-order";

/** Minimal fake of the Supabase query builder used by applyRealFirstOrder. */
function makeQuery() {
  const calls: Array<{ col: string; ascending?: boolean }> = [];
  const q: any = {
    calls,
    order(col: string, opts?: { ascending?: boolean }) {
      calls.push({ col, ascending: opts?.ascending });
      return q;
    },
  };
  return q;
}

describe("applyRealFirstOrder", () => {
  beforeEach(() => resetProductOrderConfig());

  it("orders by info_score desc before the requested sort", () => {
    const q = makeQuery();
    applyRealFirstOrder(q, "rating");
    expect(q.calls[0]).toEqual({ col: "info_score", ascending: false });
    expect(q.calls[1]).toEqual({ col: "avg_rating", ascending: false });
  });

  it("supports all sort keys", () => {
    for (const [sort, expected] of [
      ["reviews", "total_reviews"],
      ["newest", "created_at"],
      ["name", "name"],
    ] as const) {
      const q = makeQuery();
      applyRealFirstOrder(q, sort);
      expect(q.calls[1].col).toBe(expected);
    }
  });

  it("skips info_score ordering when the toggle is disabled", () => {
    setProductOrderConfig({ enabled: false });
    const q = makeQuery();
    applyRealFirstOrder(q, "rating");
    expect(q.calls.find((c) => c.col === "info_score")).toBeUndefined();
    expect(q.calls[0].col).toBe("avg_rating");
  });
});

describe("realFirstComparator", () => {
  beforeEach(() => resetProductOrderConfig());

  const real = { name: "Real", info_score: 5, avg_rating: 4.2, total_reviews: 800 };
  const partial = { name: "Partial", info_score: 4, avg_rating: 4.8, total_reviews: 1200 };
  const seeded = { name: "Seeded", info_score: 3, avg_rating: 4.9, total_reviews: 9999 };

  it("places real products before seeded ones across every category list", () => {
    const sorted = [seeded, real, partial].slice().sort(realFirstComparator);
    expect(sorted.map((p) => p.name)).toEqual(["Real", "Partial", "Seeded"]);
  });

  it("places seeded products last even with higher rating / review counts", () => {
    const sorted = [seeded, seeded, real].slice().sort(realFirstComparator);
    expect(sorted[sorted.length - 1].info_score).toBe(3);
    expect(sorted[0]).toBe(real);
  });

  it("honours the configurable minRealScore threshold", () => {
    setProductOrderConfig({ minRealScore: 5 });
    // Now only info_score===5 counts as real; partial drops below seeded by tier
    const sorted = [partial, real, seeded].slice().sort(realFirstComparator);
    expect(sorted[0]).toBe(real);
    // within the "not real" tier we fall back to info_score desc → partial > seeded
    expect(sorted[1]).toBe(partial);
    expect(sorted[2]).toBe(seeded);
  });

  it("falls back to rating + review counts when disabled (search parity)", () => {
    setProductOrderConfig({ enabled: false });
    const sorted = [real, seeded, partial].slice().sort(realFirstComparator);
    // seeded has highest rating + reviews → first
    expect(sorted[0]).toBe(seeded);
  });
});
