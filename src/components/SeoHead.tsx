import { Helmet } from "react-helmet-async";
import { useSeoSettings } from "@/hooks/useSeoSettings";

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
  const fullTitle = `${title} | ${siteName}`;
  const effectiveDescription = description || settings.defaultDescription;
  const effectiveKeywords = keywords || settings.defaultKeywords;
  const effectiveOgImage = ogImage || settings.defaultOgImage;
  const jsonLdArray = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  // Always emit a self-referencing canonical for indexable pages.
  const resolvedCanonical =
    canonicalUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : undefined);

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
      {effectiveOgImage && <meta property="og:image" content={effectiveOgImage} />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={lang === "en" ? "en_US" : lang} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@reviewhunts" />
      <meta name="twitter:title" content={fullTitle} />
      {effectiveDescription && <meta name="twitter:description" content={effectiveDescription} />}
      {effectiveOgImage && <meta name="twitter:image" content={effectiveOgImage} />}

      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* JSON-LD Structured Data */}
      {jsonLdArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}
