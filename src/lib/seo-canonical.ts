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

// Resolved at build time from VITE_SITE_URL (set per environment in .env,
// Vercel project settings, or `SITE_URL=... vite build`). Falls back to
// the production host so existing builds keep working unchanged.
export const SITE_URL = (
  (import.meta as any).env?.VITE_SITE_URL || "https://reviewhunts.com"
).replace(/\/+$/, "");

// Lovable preview hosts (softwarex.lovable.app, id-preview--*.lovable.app)
// must never leak as canonical when SITE_URL is the production domain.
// When SITE_URL itself is a lovable host (intentional preview canonicals),
// we skip the rewrite so preview builds self-reference cleanly.
const FORBIDDEN_HOST_FRAGMENTS = ["lovable.app", "lovableproject.com"];
const SITE_URL_HOST = (() => {
  try { return new URL(SITE_URL).hostname.toLowerCase(); } catch { return ""; }
})();
const SITE_URL_IS_PREVIEW = FORBIDDEN_HOST_FRAGMENTS.some((f) => SITE_URL_HOST.includes(f));

function isForbiddenHost(url: string): boolean {
  if (SITE_URL_IS_PREVIEW) return false;
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
