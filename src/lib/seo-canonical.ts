/**
 * Canonical & duplicate-intent policy for SEO.
 * One canonical per intent. Blog stays informational.
 */
export type Intent = "commercial-product" | "commercial-category" | "commercial-comparison" | "commercial-keyword" | "commercial-listicle" | "commercial-programmatic" | "informational";

export const PAGE_INTENT: Record<string, Intent> = {
  product: "commercial-product",
  category: "commercial-category",
  compare: "commercial-comparison",
  alternatives: "commercial-comparison",
  keyword: "commercial-keyword",
  best: "commercial-listicle",
  feature: "commercial-programmatic",
  use_case: "commercial-programmatic",
  industry: "commercial-programmatic",
  template: "commercial-programmatic",
  blog: "informational",
};

export const SITE_URL = "https://reviewhunts.com";

export function canonicalFor(path: string, override?: string | null) {
  if (override) return override;
  // Prefer prod origin so prerendered HTML doesn't bake in 127.0.0.1 / preview hosts.
  const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const isProdOrigin = runtimeOrigin && !/127\.0\.0\.1|localhost|lovable\.app|lovableproject\.com/.test(runtimeOrigin);
  const origin = isProdOrigin ? runtimeOrigin : SITE_URL;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export const KEYWORD_ROOT_SLUGS = [
  "employee-monitoring-software",
  "project-time-tracking",
  "time-tracking-software",
  "employee-tracking-software",
  "productivity-monitoring-tool",
] as const;
