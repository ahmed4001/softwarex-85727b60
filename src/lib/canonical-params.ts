/**
 * Canonical policy for parameterised URLs (/compare?products=…,
 * /search?q=…).
 *
 * Google flagged these as "Duplicate without user-selected canonical",
 * so the rule is:
 *   1. The canonical is always the *bare* path (query string stripped).
 *   2. When any crawl-noise parameter is present the page is
 *      `noindex, follow` — the params produce near-duplicate views.
 *   3. Bare /compare and /search stay indexable.
 *
 * This module is the single source of truth shared by:
 *   - runtime validation inside <SeoHead> (dev/staging console errors)
 *   - the CI gate `scripts/check-param-canonicals.ts`
 *   - unit tests in src/test/seo/canonical-params.test.ts
 */

/** Paths whose query strings must never appear in a canonical. */
export const PARAM_CANONICAL_PATHS = ["/compare", "/search"] as const;

/** Query params that create near-duplicate views of a listing page. */
export const NOISE_PARAMS = [
  "products",
  "q",
  "sort",
  "filter",
  "category",
  "letter",
  "page",
  "lang",
  "view",
] as const;

export type CanonicalPolicy = {
  /** Path the canonical must point at (no query string). */
  canonicalPath: string;
  /** Expected `<meta name="robots">` content. */
  robots: "index, follow" | "noindex, follow";
  /** Noise params detected on the URL, sorted. */
  matchedParams: string[];
  /** Whether this path is governed by the param-canonical policy. */
  governed: boolean;
};

function normalizePath(pathname: string): string {
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  // Drop a single trailing slash (but keep the root path intact).
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isGovernedPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (PARAM_CANONICAL_PATHS as readonly string[]).includes(p);
}

/**
 * Resolve the expected canonical + robots for a governed URL.
 * `search` accepts "?a=b", "a=b" or "".
 */
export function canonicalPolicyFor(pathname: string, search = ""): CanonicalPolicy {
  const path = normalizePath(pathname);
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const matchedParams = (NOISE_PARAMS as readonly string[])
    .filter((k) => {
      const v = params.get(k);
      return v !== null && v !== "";
    })
    .sort();
  const governed = isGovernedPath(path);
  return {
    canonicalPath: path,
    robots: governed && matchedParams.length > 0 ? "noindex, follow" : "index, follow",
    matchedParams,
    governed,
  };
}

export type CanonicalViolation = { tag: string; expected: string; actual: string; reason: string };

/**
 * Validate the head tags emitted for a URL against the policy.
 * Returns [] when the URL is not governed or everything is correct.
 */
export function validateParamCanonical(args: {
  url: string;
  canonical: string;
  ogUrl?: string;
  robots?: string;
  siteUrl: string;
}): CanonicalViolation[] {
  const { url, canonical, ogUrl, robots, siteUrl } = args;
  let parsed: URL;
  try {
    parsed = new URL(url, siteUrl);
  } catch {
    return [{ tag: "url", expected: "parseable URL", actual: url, reason: "unparseable URL" }];
  }
  const policy = canonicalPolicyFor(parsed.pathname, parsed.search);
  if (!policy.governed) return [];

  const base = siteUrl.replace(/\/+$/, "");
  const expected = `${base}${policy.canonicalPath}`;
  const out: CanonicalViolation[] = [];

  const check = (tag: string, value: string | undefined) => {
    if (value === undefined) return;
    if (!value) {
      out.push({ tag, expected, actual: "(missing)", reason: `${tag} is missing` });
      return;
    }
    let absolute = value;
    try {
      absolute = new URL(value, `${base}/`).toString().replace(/\/$/, policy.canonicalPath === "/" ? "/" : "");
    } catch {
      out.push({ tag, expected, actual: value, reason: `${tag} is not a valid URL` });
      return;
    }
    if (absolute.includes("?")) {
      out.push({ tag, expected, actual: value, reason: `${tag} must not contain a query string` });
      return;
    }
    if (absolute !== expected) {
      out.push({ tag, expected, actual: value, reason: `${tag} must be the bare ${policy.canonicalPath} URL` });
    }
  };

  check("canonical", canonical);
  check("og:url", ogUrl);

  if (robots !== undefined) {
    const normalized = robots.toLowerCase().replace(/\s+/g, " ").trim();
    if (normalized !== policy.robots) {
      out.push({
        tag: "robots",
        expected: policy.robots,
        actual: robots,
        reason:
          policy.matchedParams.length > 0
            ? `parameterised URL (${policy.matchedParams.join(", ")}) must be noindex, follow`
            : "bare listing URL must stay indexable",
      });
    }
  }

  return out;
}
