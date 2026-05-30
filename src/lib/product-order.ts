/**
 * Unified product ordering: real / full-info products first, sparse / seeded last.
 *
 * Backed by site_settings keys:
 *   - real_first_enabled (bool, default true)
 *   - real_first_min_score (int 0-5, default 4)
 *
 * The runtime config is loaded once at app start (see useProductOrderConfig)
 * and exposed synchronously here so Supabase query builders can read it
 * without awaiting anything.
 */
import { supabase } from "@/integrations/supabase/client";

export type ProductSortKey = "rating" | "reviews" | "newest" | "name";

export interface ProductOrderConfig {
  enabled: boolean;
  minRealScore: number; // info_score >= minRealScore counts as "real"
}

const DEFAULT_CONFIG: ProductOrderConfig = {
  enabled: true,
  minRealScore: 4,
};

let _config: ProductOrderConfig = { ...DEFAULT_CONFIG };

export function getProductOrderConfig(): ProductOrderConfig {
  return _config;
}

export function setProductOrderConfig(partial: Partial<ProductOrderConfig>) {
  _config = { ..._config, ...partial };
}

export function resetProductOrderConfig() {
  _config = { ...DEFAULT_CONFIG };
}

/**
 * Append the canonical "real-first" ordering to a Supabase products query
 * followed by the requested user-facing sort. Use this for EVERY product
 * listing so behaviour stays consistent across the site.
 */
export function applyRealFirstOrder<Q extends {
  order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => Q;
}>(query: Q, sort: ProductSortKey = "rating"): Q {
  let q = query;
  if (_config.enabled) {
    q = q.order("info_score", { ascending: false, nullsFirst: false });
  }
  switch (sort) {
    case "rating":
      return q.order("avg_rating", { ascending: false, nullsFirst: false });
    case "reviews":
      return q.order("total_reviews", { ascending: false, nullsFirst: false });
    case "newest":
      return q.order("created_at", { ascending: false });
    case "name":
      return q.order("name", { ascending: true });
  }
}

/**
 * Comparator for in-memory product arrays. Sponsored stays on top (callers
 * may layer their own sponsor ordering first); within the same sponsor tier
 * real products (info_score >= minRealScore) rank ahead of seeded ones,
 * then higher info_score, then avg_rating, then total_reviews.
 */
export function realFirstComparator(a: any, b: any): number {
  const cfg = _config;
  if (cfg.enabled) {
    const ar = (a?.info_score ?? 0) >= cfg.minRealScore ? 1 : 0;
    const br = (b?.info_score ?? 0) >= cfg.minRealScore ? 1 : 0;
    if (ar !== br) return br - ar;
    const ais = a?.info_score ?? 0;
    const bis = b?.info_score ?? 0;
    if (ais !== bis) return bis - ais;
  }
  const arr = Number(a?.avg_rating ?? 0);
  const brr = Number(b?.avg_rating ?? 0);
  if (arr !== brr) return brr - arr;
  const atr = Number(a?.total_reviews ?? 0);
  const btr = Number(b?.total_reviews ?? 0);
  return btr - atr;
}

/** Load the runtime config from site_settings. Safe to call repeatedly. */
export async function loadProductOrderConfig(): Promise<ProductOrderConfig> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["real_first_enabled", "real_first_min_score"]);
    const next: ProductOrderConfig = { ...DEFAULT_CONFIG };
    for (const row of (data || []) as Array<{ key: string; value: any }>) {
      if (row.key === "real_first_enabled") {
        next.enabled = row.value === true || row.value === "true";
      } else if (row.key === "real_first_min_score") {
        const n = Number(row.value);
        if (Number.isFinite(n)) next.minRealScore = Math.max(0, Math.min(5, Math.round(n)));
      }
    }
    setProductOrderConfig(next);
    return next;
  } catch {
    return _config;
  }
}
