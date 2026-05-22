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
    paragraphs: number;
    avgSentenceLength: number;
    transitionWordRatio: number;
    passiveRatio: number;
    lists: number;
    videos: number;
  };
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Transition word list (subset, English)
const TRANSITION_WORDS = [
  "however", "therefore", "furthermore", "moreover", "additionally", "consequently",
  "meanwhile", "nevertheless", "nonetheless", "accordingly", "subsequently", "instead",
  "likewise", "similarly", "in addition", "for example", "for instance", "in contrast",
  "on the other hand", "as a result", "in conclusion", "finally", "first", "second",
  "third", "next", "then", "because", "although", "while", "since", "thus", "hence",
  "specifically", "notably", "indeed", "overall", "in fact", "of course",
];

const POWER_WORDS = [
  "ultimate", "best", "proven", "essential", "complete", "free", "new", "easy",
  "powerful", "guide", "guaranteed", "secret", "amazing", "incredible", "exclusive",
  "definitive", "must", "stunning", "remarkable", "epic", "smart", "instant",
];

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
  const imgAltsWithKw = kw
    ? imgTags.filter((t) => {
        const m = t.match(/\salt=["']([^"']+)["']/i);
        return m && m[1].toLowerCase().includes(kw);
      }).length
    : 0;

  const kwHits = kw ? countMatches(text, kw) : 0;
  const keywordDensity = kw && words > 0 ? (kwHits / words) * 100 : 0;

  // ---- Content structure stats
  const paragraphs = (input.body.match(/<p\b/gi) || []).length;
  const lists = (input.body.match(/<(ul|ol)\b/gi) || []).length;
  const videos =
    (input.body.match(/<(video|iframe)\b/gi) || []).length;

  // Sentence stats
  const sentenceArr = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const sentenceCount = Math.max(1, sentenceArr.length);
  const avgSentenceLength = words / sentenceCount;
  const longSentences = sentenceArr.filter((s) => s.split(/\s+/).length > 25).length;
  const longSentenceRatio = longSentences / sentenceCount;

  // Transition words
  const lowerText = " " + text.toLowerCase() + " ";
  const transitionHits = TRANSITION_WORDS.reduce(
    (a, w) => a + (lowerText.match(new RegExp(`\\b${w}\\b`, "g")) || []).length,
    0,
  );
  const transitionWordRatio = sentenceCount ? transitionHits / sentenceCount : 0;

  // Passive voice (rough: "was/were/been/being/is/are + past-participle-ish ending in 'ed' or common irregulars")
  const passiveRe =
    /\b(?:was|were|been|being|is|are|am|be)\s+(?:\w+ly\s+)?(\w+ed|done|made|given|taken|seen|known|written|said|told|shown|built|sent|kept|held|brought|bought|caught|found|left|paid|put|set|let)\b/gi;
  const passiveHits = (text.match(passiveRe) || []).length;
  const passiveRatio = sentenceCount ? passiveHits / sentenceCount : 0;


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

  // ---- TITLE: starts with keyword
  if (kw) {
    const startsWithKw = effectiveTitle.toLowerCase().trimStart().startsWith(kw);
    checks.push({
      id: "kw-title-start",
      label: "Keyword near title start",
      level: startsWithKw ? "good" : "warn",
      message: startsWithKw
        ? "Keyword appears at the start of the title."
        : "Move the focus keyword closer to the start of the title.",
      weight: 4,
    });

    // Keyword in a subheading
    const headingsHtml = (input.body.match(/<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>/gi) || [])
      .join(" ")
      .toLowerCase();
    const kwInHeading = headingsHtml.includes(kw);
    checks.push({
      id: "kw-heading",
      label: "Keyword in subheading",
      level: kwInHeading ? "good" : "warn",
      message: kwInHeading
        ? "Focus keyword found in a subheading."
        : "Include the focus keyword in at least one H2/H3.",
      weight: 5,
    });

    // Keyword in image alt
    if (images > 0) {
      checks.push({
        id: "kw-img-alt",
        label: "Keyword in image alt",
        level: imgAltsWithKw > 0 ? "good" : "warn",
        message: imgAltsWithKw > 0
          ? `${imgAltsWithKw} image alt text contains the keyword.`
          : "Add the focus keyword to at least one image alt.",
        weight: 4,
      });
    }
  }

  // ---- TITLE: power word
  const titleLower = effectiveTitle.toLowerCase();
  const hasPower = POWER_WORDS.some((w) => titleLower.includes(w));
  checks.push({
    id: "title-power",
    label: "Power word in title",
    level: hasPower ? "good" : "warn",
    message: hasPower
      ? "Title contains an engaging power word."
      : "Try a power word (best, ultimate, proven, guide…) to boost CTR.",
    weight: 3,
  });

  // ---- TITLE: number / year
  const hasNumber = /\d/.test(effectiveTitle);
  const currentYear = new Date().getFullYear();
  const hasFreshYear =
    new RegExp(`\\b(${currentYear}|${currentYear - 1})\\b`).test(effectiveTitle);
  checks.push({
    id: "title-number",
    label: "Number in title",
    level: hasNumber ? "good" : "warn",
    message: hasNumber
      ? "Numbers in titles improve click-through rates."
      : "Add a number to your title (e.g. '7 ways', '2025 guide').",
    weight: 3,
  });
  checks.push({
    id: "title-freshness",
    label: "Title freshness",
    level: hasFreshYear ? "good" : "warn",
    message: hasFreshYear
      ? "Title signals fresh, up-to-date content."
      : `Consider including ${currentYear} to signal freshness.`,
    weight: 2,
  });

  // ---- PARAGRAPHS
  const wordsPerPara = paragraphs > 0 ? words / paragraphs : words;
  if (paragraphs >= 3 && wordsPerPara <= 120) {
    checks.push({
      id: "paragraphs",
      label: "Paragraph length",
      level: "good",
      message: `Avg ${Math.round(wordsPerPara)} words per paragraph — scannable.`,
      weight: 4,
    });
  } else if (paragraphs >= 1) {
    checks.push({
      id: "paragraphs",
      label: "Paragraph length",
      level: "warn",
      message:
        wordsPerPara > 120
          ? `Paragraphs avg ${Math.round(wordsPerPara)} words — keep under 120.`
          : "Break content into more paragraphs.",
      weight: 4,
    });
  } else {
    checks.push({
      id: "paragraphs",
      label: "Paragraph length",
      level: "bad",
      message: "No <p> paragraphs detected.",
      weight: 4,
    });
  }

  // ---- SENTENCE LENGTH
  if (words > 0) {
    if (longSentenceRatio <= 0.25) {
      checks.push({
        id: "sentence-length",
        label: "Sentence length",
        level: "good",
        message: `Avg ${avgSentenceLength.toFixed(1)} words — clear.`,
        weight: 4,
      });
    } else {
      checks.push({
        id: "sentence-length",
        label: "Sentence length",
        level: "warn",
        message: `${Math.round(longSentenceRatio * 100)}% of sentences are >25 words. Shorten them.`,
        weight: 4,
      });
    }
  }

  // ---- TRANSITION WORDS
  if (words > 100) {
    if (transitionWordRatio >= 0.3) {
      checks.push({
        id: "transition-words",
        label: "Transition words",
        level: "good",
        message: `${Math.round(transitionWordRatio * 100)}% of sentences use transitions.`,
        weight: 4,
      });
    } else {
      checks.push({
        id: "transition-words",
        label: "Transition words",
        level: "warn",
        message: "Use more transitions (however, therefore, for example…) to improve flow.",
        weight: 4,
      });
    }
  }

  // ---- PASSIVE VOICE
  if (words > 100) {
    if (passiveRatio <= 0.1) {
      checks.push({
        id: "passive-voice",
        label: "Active voice",
        level: "good",
        message: `Only ${Math.round(passiveRatio * 100)}% passive — strong active voice.`,
        weight: 3,
      });
    } else {
      checks.push({
        id: "passive-voice",
        label: "Active voice",
        level: "warn",
        message: `${Math.round(passiveRatio * 100)}% of sentences are passive — aim for <10%.`,
        weight: 3,
      });
    }
  }

  // ---- LISTS
  checks.push({
    id: "lists",
    label: "Lists & bullets",
    level: lists >= 1 ? "good" : "warn",
    message: lists >= 1
      ? `${lists} list(s) found — great for scannability.`
      : "Add bullet or numbered lists to improve scannability.",
    weight: 3,
  });

  // ---- MEDIA RICHNESS (video / embed)
  checks.push({
    id: "media-rich",
    label: "Multimedia",
    level: videos >= 1 || images >= 2 ? "good" : "warn",
    message:
      videos >= 1
        ? `Video / embed included.`
        : images >= 2
          ? `${images} images — visually rich.`
          : "Add a video or more images to enrich the post.",
    weight: 3,
  });


  // ---- TITLE: starts with capital
  if (effectiveTitle) {
    const firstChar = effectiveTitle.trimStart()[0] || "";
    const capStart = firstChar === firstChar.toUpperCase() && /[A-Za-z]/.test(firstChar);
    checks.push({
      id: "title-capital",
      label: "Title sentence case",
      level: capStart ? "good" : "warn",
      message: capStart ? "Title starts with a capital letter." : "Capitalize the first letter of the title.",
      weight: 2,
    });
  }

  // ---- META: question / curiosity hook
  if (md) {
    const hasHook = /\?|how|why|what|when|discover|learn|find out/i.test(md);
    checks.push({
      id: "meta-hook",
      label: "Meta description hook",
      level: hasHook ? "good" : "warn",
      message: hasHook
        ? "Meta description contains a curiosity hook."
        : "Add a question or CTA word (how, why, discover…) to the meta description.",
      weight: 3,
    });
  }

  // ---- META: call-to-action verb
  if (md) {
    const ctaRe = /\b(learn|discover|explore|read|find|see|get|try|start|build|compare|review|download)\b/i;
    const hasCta = ctaRe.test(md);
    checks.push({
      id: "meta-cta",
      label: "Meta CTA verb",
      level: hasCta ? "good" : "warn",
      message: hasCta
        ? "Meta description includes an action verb."
        : "Add an action verb (Discover, Learn, Compare…) to drive clicks.",
      weight: 3,
    });
  }

  // ---- HEADING HIERARCHY (no skipping H2 -> H4)
  const hasH4WithoutH3 = /<h4\b/i.test(input.body) && h3 === 0;
  if (h2 > 0) {
    checks.push({
      id: "h-hierarchy",
      label: "Heading hierarchy",
      level: hasH4WithoutH3 ? "warn" : "good",
      message: hasH4WithoutH3
        ? "H4 used without H3 — don't skip heading levels."
        : "Heading levels nest correctly.",
      weight: 3,
    });
  }

  // ---- LINKS: descriptive anchor text (no "click here")
  const anchorTexts = Array.from(
    input.body.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/gi),
  ).map((m) => stripHtml(m[1]).toLowerCase().trim());
  if (anchorTexts.length > 0) {
    const generic = anchorTexts.filter((t) =>
      ["click here", "here", "read more", "this", "link", "more"].includes(t),
    ).length;
    checks.push({
      id: "anchor-text",
      label: "Descriptive anchor text",
      level: generic === 0 ? "good" : "warn",
      message: generic === 0
        ? "All link anchors are descriptive."
        : `${generic} link(s) use generic anchor text like "click here".`,
      weight: 4,
    });
  }

  // ---- LINKS: external links open safely (rel)
  const externalAnchors = Array.from(
    input.body.matchAll(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi),
  ).map((m) => m[0]);
  if (externalAnchors.length > 0) {
    const safe = externalAnchors.filter((a) => /rel=["'][^"']*noopener/i.test(a)).length;
    checks.push({
      id: "link-safety",
      label: "Safe external links",
      level: safe === externalAnchors.length ? "good" : "warn",
      message: safe === externalAnchors.length
        ? "All external links use rel=noopener."
        : `${externalAnchors.length - safe} external link(s) missing rel="noopener".`,
      weight: 2,
    });
  }

  // ---- IMAGES: lazy loading
  if (images > 1) {
    const lazy = imgTags.filter((t) => /\sloading=["']lazy["']/i.test(t)).length;
    checks.push({
      id: "img-lazy",
      label: "Lazy-loaded images",
      level: lazy >= images - 1 ? "good" : "warn",
      message: lazy >= images - 1
        ? "Below-the-fold images use lazy loading."
        : `${images - lazy} image(s) not lazy-loaded — slows page speed.`,
      weight: 3,
    });
  }

  // ---- SLUG: word count (3-5 words ideal)
  if (input.slug) {
    const slugWords = input.slug.split("-").filter(Boolean).length;
    if (slugWords >= 3 && slugWords <= 5) {
      checks.push({
        id: "slug-words",
        label: "Slug word count",
        level: "good",
        message: `${slugWords} words — ideal.`,
        weight: 3,
      });
    } else {
      checks.push({
        id: "slug-words",
        label: "Slug word count",
        level: "warn",
        message: `${slugWords} words — aim for 3–5 words.`,
        weight: 3,
      });
    }
  }

  // ---- STOP WORDS in slug
  if (input.slug) {
    const stopWords = ["a","an","the","and","or","but","of","in","on","at","to","for","with","is","are"];
    const slugBits = input.slug.split("-").filter(Boolean);
    const stopHits = slugBits.filter((w) => stopWords.includes(w.toLowerCase())).length;
    if (stopHits === 0) {
      checks.push({
        id: "slug-stop",
        label: "Slug stop words",
        level: "good",
        message: "Slug has no stop words.",
        weight: 2,
      });
    } else {
      checks.push({
        id: "slug-stop",
        label: "Slug stop words",
        level: "warn",
        message: `Remove stop words from slug (${stopHits} found).`,
        weight: 2,
      });
    }
  }

  // ---- KEYWORD: not over-stuffed in title
  if (kw) {
    const kwTitleHits = countMatches(effectiveTitle, kw);
    if (kwTitleHits > 2) {
      checks.push({
        id: "kw-title-stuff",
        label: "Keyword stuffing in title",
        level: "bad",
        message: `Keyword appears ${kwTitleHits}× in title — looks spammy.`,
        weight: 4,
      });
    }
  }

  // ---- TITLE: duplicate of body H1 (rough — title appears as first H1 in body)
  const firstH1 = input.body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (firstH1 && effectiveTitle) {
    const h1Text = stripHtml(firstH1[1]).toLowerCase().trim();
    const same = h1Text === effectiveTitle.toLowerCase().trim();
    checks.push({
      id: "title-h1-match",
      label: "Title vs H1",
      level: same ? "good" : "warn",
      message: same
        ? "H1 matches the SEO title."
        : "H1 differs from the SEO title — keep them aligned.",
      weight: 3,
    });
  }

  // ---- READING TIME guidance
  if (readingTime >= 4 && readingTime <= 12) {
    checks.push({
      id: "read-time",
      label: "Reading time",
      level: "good",
      message: `${readingTime} min read — ideal for engagement.`,
      weight: 3,
    });
  } else if (readingTime > 0) {
    checks.push({
      id: "read-time",
      label: "Reading time",
      level: "warn",
      message:
        readingTime < 4
          ? `${readingTime} min — too short for in-depth ranking.`
          : `${readingTime} min — consider splitting into multiple posts.`,
      weight: 2,
    });
  }

  // ---- H1 PRESENT / KEYWORD IN H1
  if (h1 === 0) {
    checks.push({
      id: "h1-missing", label: "H1 present", level: "bad",
      message: "Post has no H1 tag — add a single H1.", weight: 6,
    });
  } else {
    checks.push({
      id: "h1-missing", label: "H1 present", level: "good",
      message: "H1 found.", weight: 6,
    });
    if (kw && firstH1) {
      const h1Text = stripHtml(firstH1[1]).toLowerCase();
      const has = h1Text.includes(kw);
      checks.push({
        id: "kw-h1", label: "Keyword in H1",
        level: has ? "good" : "warn",
        message: has ? "H1 contains the focus keyword." : "Add focus keyword to your H1.",
        weight: 5,
      });
    }
  }

  // ---- SLUG: special chars / underscores
  if (input.slug) {
    if (/[^a-z0-9-]/.test(input.slug.toLowerCase())) {
      checks.push({
        id: "slug-special", label: "URL special characters", level: "bad",
        message: "Slug contains special characters — use only letters, numbers, hyphens.",
        weight: 3,
      });
    }
    if (input.slug.includes("_")) {
      checks.push({
        id: "slug-underscore", label: "Hyphens, not underscores", level: "warn",
        message: "Replace underscores (_) with hyphens (-) in your slug.",
        weight: 3,
      });
    }
  }

  // ---- INSECURE (HTTP) LINKS
  const httpLinks = linkMatches.filter((h) => h.toLowerCase().startsWith("http://")).length;
  if (httpLinks > 0) {
    checks.push({
      id: "http-links", label: "HTTPS links", level: "warn",
      message: `${httpLinks} link(s) use insecure http:// — switch to https://.`,
      weight: 3,
    });
  }

  // ---- TOO MANY LINKS
  if (externalLinks > 10) {
    checks.push({
      id: "external-overuse", label: "Too many outbound links", level: "warn",
      message: `${externalLinks} external links — keep under 10 to preserve link equity.`,
      weight: 3,
    });
  }
  if (internalLinks > 15) {
    checks.push({
      id: "internal-overuse", label: "Too many internal links", level: "warn",
      message: `${internalLinks} internal links — looks spammy.`,
      weight: 2,
    });
  }

  // ---- GENERIC ALT TEXT
  if (images > 0) {
    const genericAlts = imgTags.filter((t) => {
      const m = t.match(/\salt=["']([^"']+)["']/i);
      if (!m) return false;
      const v = m[1].toLowerCase().trim();
      return /^(image|img|photo|picture|screenshot)\s*\d*$/.test(v) || v.length < 3;
    }).length;
    if (genericAlts > 0) {
      checks.push({
        id: "alt-generic", label: "Descriptive alt text", level: "warn",
        message: `${genericAlts} image(s) have generic alt text. Be descriptive.`,
        weight: 3,
      });
    }
  }

  // ---- INTRO LENGTH
  const firstParaMatch = input.body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const firstParaText = firstParaMatch ? stripHtml(firstParaMatch[1]) : "";
  const firstParaWords = firstParaText.split(/\s+/).filter(Boolean).length;
  if (firstParaWords < 30) {
    checks.push({
      id: "intro-length", label: "Strong introduction", level: "warn",
      message: firstParaWords === 0
        ? "Add an introductory paragraph."
        : `Intro is only ${firstParaWords} words — aim for 40–80 words.`,
      weight: 4,
    });
  } else {
    checks.push({
      id: "intro-length", label: "Strong introduction", level: "good",
      message: `Intro is ${firstParaWords} words — sets up the post well.`,
      weight: 4,
    });
  }

  // ---- CONCLUSION
  const headingTexts = (input.body.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi) || [])
    .map((h) => stripHtml(h).toLowerCase());
  const hasConclusion =
    headingTexts.some((h) => /conclusion|takeaway|summary|final thoughts|wrap[\s-]?up|key points/.test(h)) ||
    /\b(in conclusion|to sum up|to wrap up|in summary|final thoughts)\b/i.test(text.slice(-500));
  if (words > 400) {
    checks.push({
      id: "conclusion", label: "Clear conclusion",
      level: hasConclusion ? "good" : "warn",
      message: hasConclusion
        ? "Post has a conclusion section."
        : "Add a 'Conclusion' or 'Key Takeaways' section.",
      weight: 3,
    });
  }

  // ---- CTA
  const ctaTextRe = /\b(subscribe|sign up|download|get started|try (it )?(free|now|today)|learn more|book a (demo|call)|contact us|join|register)\b/i;
  const hasCtaBody = ctaTextRe.test(text) || /<button\b|class=["'][^"']*\bbtn\b/i.test(input.body);
  checks.push({
    id: "cta-body", label: "Call-to-action",
    level: hasCtaBody ? "good" : "warn",
    message: hasCtaBody
      ? "Post includes a call-to-action."
      : "Add a CTA (Subscribe, Try free, Learn more…) to drive engagement.",
    weight: 3,
  });

  // ---- AUTHORITY / REFERENCE (E-E-A-T)
  const authorityRe =
    /https?:\/\/(?:[\w.-]+\.)?(?:wikipedia\.org|gov|edu|nature\.com|sciencedirect\.com|nih\.gov|who\.int|forbes\.com|hbr\.org|nytimes\.com|reuters\.com|bbc\.|harvard\.edu|stanford\.edu|mit\.edu)/i;
  const hasAuthority = linkMatches.some((h) => authorityRe.test(h));
  if (words > 400) {
    checks.push({
      id: "authority-link", label: "Authority reference",
      level: hasAuthority ? "good" : "warn",
      message: hasAuthority
        ? "Cites an authoritative source — boosts E-E-A-T."
        : "Link to an authoritative source (.gov, .edu, Wikipedia, major publisher).",
      weight: 3,
    });
  }

  // ---- SUBHEADING DISTRIBUTION
  if (words > 600) {
    const wordsPerHeading = (h2 + h3) > 0 ? words / (h2 + h3) : words;
    checks.push({
      id: "subhead-distribution", label: "Subheading distribution",
      level: wordsPerHeading <= 300 ? "good" : "warn",
      message: wordsPerHeading <= 300
        ? `~${Math.round(wordsPerHeading)} words per subheading — well paced.`
        : `${Math.round(wordsPerHeading)} words per subheading — break long sections with H2/H3.`,
      weight: 3,
    });
  }

  // ---- LSI / SEMANTIC COVERAGE
  if (effectiveTitle && words > 200) {
    const stopwords = new Set([
      "the","a","an","and","or","but","of","in","on","at","to","for","with","is","are",
      "your","you","how","what","why","when","this","that","best","top",
    ]);
    const titleWords = effectiveTitle
      .toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 3 && !stopwords.has(w));
    if (titleWords.length > 0) {
      const lowerBody = text.toLowerCase();
      const covered = titleWords.filter((w) => lowerBody.includes(w)).length;
      const ratio = covered / titleWords.length;
      checks.push({
        id: "lsi-coverage", label: "Semantic coverage",
        level: ratio >= 0.7 ? "good" : ratio >= 0.4 ? "warn" : "bad",
        message: ratio >= 0.7
          ? `${covered}/${titleWords.length} title topics covered in body.`
          : `Only ${covered}/${titleWords.length} title topics appear in body — expand coverage.`,
        weight: 4,
      });
    }
  }

  // ---- TITLE: clickbait / shouting
  if (effectiveTitle) {
    const bangs = (effectiveTitle.match(/[!?]/g) || []).length;
    const letters = effectiveTitle.replace(/[^a-zA-Z]/g, "").length;
    const caps = effectiveTitle.replace(/[^A-Z]/g, "").length;
    const allCaps = letters > 8 && caps / letters > 0.6;
    if (bangs > 1 || allCaps) {
      checks.push({
        id: "title-clickbait", label: "Title professionalism", level: "warn",
        message: allCaps
          ? "Avoid all-caps titles — looks like shouting."
          : "Avoid multiple '!' or '?' — looks clickbaity.",
        weight: 2,
      });
    }
  }

  const totalWeight = checks.reduce((a, c) => a + c.weight, 0);
  const earned = checks.reduce((a, c) => a + c.weight * (c.level === "good" ? 1 : c.level === "warn" ? 0.5 : 0), 0);
  const score = Math.round((earned / Math.max(1, totalWeight)) * 100);
  const level: SeoLevel = score >= 80 ? "good" : score >= 55 ? "warn" : "bad";

  return {
    score,
    level,
    checks,
    stats: {
      words, readingTime, h1, h2, h3,
      internalLinks, externalLinks,
      images, imagesMissingAlt, keywordDensity,
      paragraphs, avgSentenceLength, transitionWordRatio, passiveRatio,
      lists, videos,
    },
  };
}
