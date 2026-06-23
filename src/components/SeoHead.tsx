import { Helmet } from "react-helmet-async";
import { useSeoSettings } from "@/hooks/useSeoSettings";
import { validateJsonLd } from "@/lib/jsonLdValidator";

interface SeoHeadProps {
  title: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
  type?: string;
  jsonLd?: object | object[];
  author?: string;
  robots?: string;
  lang?: string;
}

// Resolve runtime environment for logging severity. Staging/preview hosts
// should log loudly; production should stay quiet but still drop invalid
// blocks so bad schema never reaches crawlers.
function getRuntimeEnv(): "development" | "staging" | "production" {
  if (typeof window === "undefined") return "production";
  const host = window.location.hostname;
  if (host === "localhost" || host.startsWith("127.") || host.endsWith(".local"))
    return "development";
  if (host.includes("lovable.app") || host.includes("preview") || host.includes("staging"))
    return "staging";
  return "production";
}

export function SeoHead({
  title,
  description,
  keywords,
  ogImage,
  canonicalUrl,
  type = "website",
  jsonLd,
  author,
  robots = "index, follow",
  lang = "en",
}: SeoHeadProps) {
  const settings = useSeoSettings();

  const siteName = settings.siteName || "ReviewHunts";
  // Keep combined title under 70 chars for SERP display: trim page title
  // when concatenation with " | siteName" would overflow.
  const suffix = ` | ${siteName}`;
  const MAX = 70;
  const trimmedTitle =
    title.length + suffix.length > MAX
      ? title.slice(0, Math.max(0, MAX - suffix.length - 1)).trimEnd() + "…"
      : title;
  const fullTitle = `${trimmedTitle}${suffix}`;
  const FALLBACK_DESCRIPTION =
    "Discover, compare, and review top software tools. Real user reviews, AI-powered insights, and curated buyer guides across 100+ categories.";
  const FALLBACK_OG_IMAGE = "/og-image.png";
  const effectiveDescription = description || settings.defaultDescription || FALLBACK_DESCRIPTION;
  const effectiveKeywords = keywords || settings.defaultKeywords;
  const effectiveOgImage = ogImage || settings.defaultOgImage || FALLBACK_OG_IMAGE;

  // Dev-only: surface missing critical SEO fields via console.debug so they
  // appear in DevTools without tripping CI tests that assert no warn/error.
  if (import.meta.env?.DEV && typeof window !== "undefined") {
    if (!title || title === siteName) console.debug("[SeoHead] Missing/generic title", { route: window.location.pathname });
    if (!description) console.debug("[SeoHead] Missing description (using fallback)", { route: window.location.pathname });
    if (!ogImage && !settings.defaultOgImage) console.debug("[SeoHead] Missing og:image (using fallback)", { route: window.location.pathname });
  }

  const rawJsonLdArray = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  // Runtime validation: drop malformed blocks before they reach <head>.
  const { valid: jsonLdArray, invalid } = validateJsonLd(rawJsonLdArray);
  if (invalid.length > 0 && typeof window !== "undefined") {
    const env = getRuntimeEnv();
    const payload = {
      route: window.location.pathname,
      pageTitle: fullTitle,
      invalid,
    };
    // Always log a warning; in dev/staging escalate to console.error so it
    // shows up in CI screen-grabs and replay tooling.
    if (env === "production") {
      console.warn("[SeoHead] Dropped invalid JSON-LD block(s):", payload);
    } else {
      console.error("[SeoHead] Invalid JSON-LD blocked:", payload);
    }
  }

  // Always emit a self-referencing canonical for indexable pages, locked
  // to the production domain so crawlers consolidate to reviewhunts.com.
  // Any incoming canonicalUrl pointing at a Lovable preview/staging host
  // is rewritten to reviewhunts.com so softwarex.lovable.app (and any
  // other *.lovable.app preview) can never leak into <head>.
  const SITE_URL = "https://reviewhunts.com";
  const FORBIDDEN_HOST_FRAGMENTS = ["lovable.app", "lovableproject.com"];
  const stripForbiddenHost = (url: string): string => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (FORBIDDEN_HOST_FRAGMENTS.some((f) => host.includes(f))) {
        return `${SITE_URL}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return url;
    } catch {
      return url;
    }
  };
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const rawCanonical = canonicalUrl
    ? canonicalUrl.startsWith("http")
      ? canonicalUrl
      : `${SITE_URL}${canonicalUrl.startsWith("/") ? "" : "/"}${canonicalUrl}`
    : `${SITE_URL}${pathname}`;
  const resolvedCanonical = stripForbiddenHost(rawCanonical);
  const resolvedOgImage =
    effectiveOgImage && !effectiveOgImage.startsWith("http")
      ? `${SITE_URL}${effectiveOgImage.startsWith("/") ? "" : "/"}${effectiveOgImage}`
      : effectiveOgImage;

  return (
    <Helmet>
      <html lang={lang} />
      <title>{fullTitle}</title>
      {effectiveDescription && <meta name="description" content={effectiveDescription} />}
      {effectiveKeywords && <meta name="keywords" content={effectiveKeywords} />}
      {author && <meta name="author" content={author} />}
      <meta name="robots" content={robots} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />

      {/* Search Console Verification */}
      {settings.googleVerification && <meta name="google-site-verification" content={settings.googleVerification} />}
      {settings.bingVerification && <meta name="msvalidate.01" content={settings.bingVerification} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {effectiveDescription && <meta property="og:description" content={effectiveDescription} />}
      {resolvedOgImage && <meta property="og:image" content={resolvedOgImage} />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={lang === "en" ? "en_US" : lang} />
      {resolvedCanonical && <meta property="og:url" content={resolvedCanonical} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@reviewhunts" />
      <meta name="twitter:title" content={fullTitle} />
      {effectiveDescription && <meta name="twitter:description" content={effectiveDescription} />}
      {resolvedOgImage && <meta name="twitter:image" content={resolvedOgImage} />}

      {/* Canonical (self-referencing by default) */}
      {resolvedCanonical && <link rel="canonical" href={resolvedCanonical} />}

      {/* JSON-LD Structured Data */}
      {jsonLdArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}
