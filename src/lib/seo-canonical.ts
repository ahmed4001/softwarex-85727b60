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

// Hosts we must never emit as canonical/og:url. Lovable preview hosts
// (e.g. softwarex.lovable.app, id-preview--*.lovable.app) leak into
// crawler caches if they ever slip through, so we strip them here and
// in SeoHead.
const FORBIDDEN_HOST_FRAGMENTS = ["lovable.app", "lovableproject.com"];

function isForbiddenHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return FORBIDDEN_HOST_FRAGMENTS.some((frag) => host.includes(frag));
  } catch {
    return false;
  }
}

export function canonicalFor(path: string, override?: string | null) {
  if (override && !isForbiddenHost(override)) return override;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const KEYWORD_ROOT_SLUGS = [
  "employee-monitoring-software",
  "project-time-tracking",
  "time-tracking-software",
  "employee-tracking-software",
  "productivity-monitoring-tool",
] as const;
