// Comprehensive on-page SEO scorer for blog posts (0–100).
// Designed to mirror Yoast/RankMath-style checks but lean.

export type SeoLevel = "good" | "warn" | "bad";

export interface SeoCheck {
  id: string;
  label: string;
  level: SeoLevel;
  message: string;
  weight: number; // 1-10
}

export interface SeoScoreInput {
  title: string;
  seoTitle?: string;
  metaDescription?: string;
  slug: string;
  body: string; // HTML
  focusKeyword?: string;
  featuredImage?: string;
}

export interface SeoScoreResult {
  score: number; // 0-100
  level: SeoLevel;
  checks: SeoCheck[];
  stats: {
    words: number;
    readingTime: number;
    h1: number;
    h2: number;
    h3: number;
    internalLinks: number;
    externalLinks: number;
    images: number;
    imagesMissingAlt: number;
    keywordDensity: number; // percent
  };
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countMatches(haystack: string, needle: string) {
  if (!needle) return 0;
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (haystack.match(re) || []).length;
}

// Flesch Reading Ease — simplified
function readability(text: string): number {
  const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);
  const syllables = words.reduce((acc, w) => acc + Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length), 0);
  const score = 206.835 - 1.015 * (wordCount / sentences) - 84.6 * (syllables / wordCount);
  return Math.max(0, Math.min(100, score));
}

export function computeSeoScore(input: SeoScoreInput): SeoScoreResult {
  const checks: SeoCheck[] = [];
  const text = stripHtml(input.body || "");
  const words = text.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(words / 200));
  const effectiveTitle = input.seoTitle || input.title || "";
  const kw = (input.focusKeyword || "").trim().toLowerCase();

  const h1 = (input.body.match(/<h1\b/gi) || []).length;
  const h2 = (input.body.match(/<h2\b/gi) || []).length;
  const h3 = (input.body.match(/<h3\b/gi) || []).length;

  const linkMatches = Array.from(input.body.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)).map((m) => m[1]);
  const internalLinks = linkMatches.filter((h) => h.startsWith("/") || h.includes(location?.hostname || "")).length;
  const externalLinks = linkMatches.length - internalLinks;

  const imgTags = Array.from(input.body.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
  const images = imgTags.length;
  const imagesMissingAlt = imgTags.filter((t) => !/\salt=["'][^"']+["']/i.test(t)).length;

  const kwHits = kw ? countMatches(text, kw) : 0;
  const keywordDensity = kw && words > 0 ? (kwHits / words) * 100 : 0;

  // ---- TITLE
  const titleLen = effectiveTitle.length;
  if (titleLen >= 50 && titleLen <= 60) {
    checks.push({ id: "title-length", label: "Title length", level: "good", message: `Title is ${titleLen} chars — perfect.`, weight: 8 });
  } else if (titleLen >= 40 && titleLen <= 70) {
    checks.push({ id: "title-length", label: "Title length", level: "warn", message: `Title is ${titleLen} chars — aim for 50–60.`, weight: 8 });
  } else {
    checks.push({ id: "title-length", label: "Title length", level: "bad", message: titleLen === 0 ? "Title is empty." : `Title is ${titleLen} chars — too ${titleLen < 40 ? "short" : "long"}.`, weight: 8 });
  }

  // ---- META DESCRIPTION
  const md = input.metaDescription || "";
  if (md.length >= 140 && md.length <= 160) {
    checks.push({ id: "meta-desc", label: "Meta description", level: "good", message: `${md.length} chars — perfect.`, weight: 8 });
  } else if (md.length >= 110 && md.length <= 170) {
    checks.push({ id: "meta-desc", label: "Meta description", level: "warn", message: `${md.length} chars — aim for 140–160.`, weight: 8 });
  } else {
    checks.push({ id: "meta-desc", label: "Meta description", level: "bad", message: md.length === 0 ? "Missing meta description." : `${md.length} chars — out of range.`, weight: 8 });
  }

  // ---- FOCUS KEYWORD
  if (!kw) {
    checks.push({ id: "kw-set", label: "Focus keyword", level: "bad", message: "Set a focus keyword.", weight: 9 });
  } else {
    checks.push({ id: "kw-set", label: "Focus keyword", level: "good", message: `Targeting "${kw}".`, weight: 9 });

    checks.push({
      id: "kw-title",
      label: "Keyword in title",
      level: effectiveTitle.toLowerCase().includes(kw) ? "good" : "bad",
      message: effectiveTitle.toLowerCase().includes(kw) ? "Found in title." : "Add focus keyword to title.",
      weight: 9,
    });
    checks.push({
      id: "kw-meta",
      label: "Keyword in meta description",
      level: md.toLowerCase().includes(kw) ? "good" : "warn",
      message: md.toLowerCase().includes(kw) ? "Found in meta." : "Add keyword to meta description.",
      weight: 6,
    });
    checks.push({
      id: "kw-slug",
      label: "Keyword in URL slug",
      level: input.slug.toLowerCase().includes(kw.replace(/\s+/g, "-")) ? "good" : "warn",
      message: input.slug.toLowerCase().includes(kw.replace(/\s+/g, "-")) ? "Slug contains keyword." : "Add keyword to URL slug.",
      weight: 6,
    });
    const inFirstPara = text.slice(0, 200).toLowerCase().includes(kw);
    checks.push({
      id: "kw-intro",
      label: "Keyword in intro",
      level: inFirstPara ? "good" : "warn",
      message: inFirstPara ? "Found in first paragraph." : "Mention keyword in the first paragraph.",
      weight: 5,
    });

    // density 0.5%-2.5% ideal
    if (keywordDensity >= 0.5 && keywordDensity <= 2.5) {
      checks.push({ id: "kw-density", label: "Keyword density", level: "good", message: `${keywordDensity.toFixed(2)}% — good.`, weight: 5 });
    } else if (keywordDensity > 0 && keywordDensity < 3.5) {
      checks.push({ id: "kw-density", label: "Keyword density", level: "warn", message: `${keywordDensity.toFixed(2)}% — aim for 0.5–2.5%.`, weight: 5 });
    } else {
      checks.push({ id: "kw-density", label: "Keyword density", level: "bad", message: keywordDensity === 0 ? "Keyword not used in body." : `${keywordDensity.toFixed(2)}% — too high (keyword stuffing).`, weight: 5 });
    }
  }

  // ---- HEADINGS
  if (h2 >= 2) {
    checks.push({ id: "h-structure", label: "Heading structure", level: "good", message: `${h2} H2 / ${h3} H3 — well structured.`, weight: 6 });
  } else if (h2 === 1) {
    checks.push({ id: "h-structure", label: "Heading structure", level: "warn", message: "Add more H2 sections to break up content.", weight: 6 });
  } else {
    checks.push({ id: "h-structure", label: "Heading structure", level: "bad", message: "No H2 headings found.", weight: 6 });
  }

  if (h1 > 1) {
    checks.push({ id: "h1-count", label: "Single H1", level: "bad", message: `Found ${h1} H1 tags — should be exactly 1.`, weight: 5 });
  }

  // ---- IMAGES
  if (images === 0) {
    checks.push({ id: "img-alt", label: "Image alt text", level: "warn", message: "No images in post.", weight: 4 });
  } else if (imagesMissingAlt === 0) {
    checks.push({ id: "img-alt", label: "Image alt text", level: "good", message: `All ${images} image(s) have alt text.`, weight: 6 });
  } else {
    checks.push({ id: "img-alt", label: "Image alt text", level: "bad", message: `${imagesMissingAlt} of ${images} images missing alt text.`, weight: 6 });
  }

  // ---- LINKS
  checks.push({
    id: "internal-links",
    label: "Internal links",
    level: internalLinks >= 2 ? "good" : internalLinks >= 1 ? "warn" : "bad",
    message: internalLinks >= 2 ? `${internalLinks} internal links.` : internalLinks === 1 ? "Add at least 1 more internal link." : "Add internal links to related posts.",
    weight: 7,
  });
  checks.push({
    id: "external-links",
    label: "External links",
    level: externalLinks >= 1 ? "good" : "warn",
    message: externalLinks >= 1 ? `${externalLinks} external link(s).` : "Add at least one external authority link.",
    weight: 4,
  });

  // ---- SLUG
  if (input.slug.length === 0) {
    checks.push({ id: "slug", label: "URL slug", level: "bad", message: "Slug is empty.", weight: 5 });
  } else if (input.slug.length > 75) {
    checks.push({ id: "slug", label: "URL slug", level: "warn", message: "Slug is long — keep under 75 chars.", weight: 4 });
  } else if (/[A-Z_]/.test(input.slug) || /--/.test(input.slug)) {
    checks.push({ id: "slug", label: "URL slug", level: "warn", message: "Use lowercase, hyphen-separated slug.", weight: 4 });
  } else {
    checks.push({ id: "slug", label: "URL slug", level: "good", message: "Clean URL slug.", weight: 4 });
  }

  // ---- LENGTH
  if (words >= 1200) {
    checks.push({ id: "length", label: "Content length", level: "good", message: `${words} words — comprehensive.`, weight: 5 });
  } else if (words >= 600) {
    checks.push({ id: "length", label: "Content length", level: "warn", message: `${words} words — aim for 1200+ for ranking.`, weight: 5 });
  } else {
    checks.push({ id: "length", label: "Content length", level: "bad", message: `${words} words — too short.`, weight: 6 });
  }

  // ---- READABILITY
  const r = readability(text);
  if (r >= 60) {
    checks.push({ id: "readability", label: "Readability", level: "good", message: `Reading ease ${r.toFixed(0)} — easy.`, weight: 5 });
  } else if (r >= 40) {
    checks.push({ id: "readability", label: "Readability", level: "warn", message: `Reading ease ${r.toFixed(0)} — could be simpler.`, weight: 5 });
  } else {
    checks.push({ id: "readability", label: "Readability", level: "bad", message: `Reading ease ${r.toFixed(0)} — hard to read.`, weight: 5 });
  }

  // ---- FEATURED IMAGE
  checks.push({
    id: "featured",
    label: "Featured image",
    level: input.featuredImage ? "good" : "warn",
    message: input.featuredImage ? "Featured image set." : "Add a featured image for social sharing.",
    weight: 4,
  });

  // Score: weighted average where good=1, warn=0.5, bad=0
  const totalWeight = checks.reduce((a, c) => a + c.weight, 0);
  const earned = checks.reduce((a, c) => a + c.weight * (c.level === "good" ? 1 : c.level === "warn" ? 0.5 : 0), 0);
  const score = Math.round((earned / Math.max(1, totalWeight)) * 100);
  const level: SeoLevel = score >= 80 ? "good" : score >= 55 ? "warn" : "bad";

  return {
    score,
    level,
    checks,
    stats: { words, readingTime, h1, h2, h3, internalLinks, externalLinks, images, imagesMissingAlt, keywordDensity },
  };
}
