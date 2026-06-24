/**
 * Generates per-product Markdown alternates at public/product/<slug>.md.
 *
 * AI agents (ChatGPT, Claude, Perplexity, Gemini) ingest plain Markdown 3-5×
 * more reliably than rendered HTML. We expose a clean .md companion next to
 * each product page and advertise it via <link rel="alternate" type="text/markdown">
 * so crawlers can fetch the canonical text content without parsing the SPA.
 *
 * Runs alongside generate-sitemap.ts / generate-llms-txt.ts / generate-feed.ts.
 */
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve } from "path";

const BASE_URL = process.env.SITE_URL || "https://reviewhunts.com";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://ffeimjfunghzxgeqiwma.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg";

const OUT_DIR = resolve("public/product");

interface ProductRow {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  website_url: string | null;
  pricing_model: string | null;
  starting_price: number | null;
  pricing_description: string | null;
  founded_year: number | null;
  headquarters: string | null;
  avg_rating: number | null;
  total_reviews: number | null;
  features: any;
  integrations: any;
  pros_summary: string | null;
  cons_summary: string | null;
  updated_at: string | null;
  info_score: number | null;
  categories?: { name?: string; slug?: string } | null;
}

function mdEscape(s: string): string {
  return String(s ?? "").replace(/\r\n/g, "\n").trim();
}

function stripHtml(s: string | null): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        typeof x === "string"
          ? x
          : x?.name || x?.title || x?.label || x?.feature || ""
      )
      .filter(Boolean);
  }
  return [];
}

function renderMarkdown(p: ProductRow): string {
  const url = `${BASE_URL}/product/${p.slug}`;
  const category = p.categories?.name || "Software";
  const lines: string[] = [];

  // YAML front matter — machine-friendly metadata for AI ingestion.
  lines.push("---");
  lines.push(`title: "${(p.name || "").replace(/"/g, '\\"')} Review 2026"`);
  lines.push(`slug: ${p.slug}`);
  lines.push(`url: ${url}`);
  lines.push(`canonical: ${url}`);
  if (p.tagline) lines.push(`tagline: "${p.tagline.replace(/"/g, '\\"')}"`);
  lines.push(`category: "${category}"`);
  if (p.pricing_model) lines.push(`pricing_model: ${p.pricing_model}`);
  if (p.starting_price != null) lines.push(`starting_price: ${p.starting_price}`);
  if (p.founded_year) lines.push(`founded_year: ${p.founded_year}`);
  if (p.headquarters) lines.push(`headquarters: "${p.headquarters.replace(/"/g, '\\"')}"`);
  if (p.website_url) lines.push(`website: ${p.website_url}`);
  if (p.avg_rating != null) lines.push(`avg_rating: ${p.avg_rating}`);
  if (p.total_reviews != null) lines.push(`total_reviews: ${p.total_reviews}`);
  if (p.updated_at) lines.push(`updated_at: ${p.updated_at}`);
  lines.push(`source: ReviewHunts`);
  lines.push(`license: "Editorial content © ReviewHunts. AI training permitted per /ai.txt."`);
  lines.push("---");
  lines.push("");

  lines.push(`# ${p.name} Review (2026)`);
  lines.push("");
  if (p.tagline) {
    lines.push(`> ${mdEscape(p.tagline)}`);
    lines.push("");
  }

  // Quick facts
  lines.push("## Quick Facts");
  lines.push("");
  lines.push(`- **Category:** ${category}`);
  if (p.pricing_model) lines.push(`- **Pricing model:** ${p.pricing_model}`);
  if (p.starting_price != null)
    lines.push(`- **Starting price:** $${p.starting_price}`);
  if (p.founded_year) lines.push(`- **Founded:** ${p.founded_year}`);
  if (p.headquarters) lines.push(`- **Headquarters:** ${p.headquarters}`);
  if (p.website_url) lines.push(`- **Website:** ${p.website_url}`);
  if (p.avg_rating != null && p.total_reviews)
    lines.push(
      `- **Rating:** ${p.avg_rating}/5 (${p.total_reviews} verified review${p.total_reviews === 1 ? "" : "s"})`
    );
  lines.push(`- **Canonical URL:** ${url}`);
  lines.push("");

  // Overview
  const description = stripHtml(p.description);
  if (description) {
    lines.push("## Overview");
    lines.push("");
    lines.push(description);
    lines.push("");
  }

  // Features
  const features = toList(p.features);
  if (features.length) {
    lines.push("## Key Features");
    lines.push("");
    for (const f of features.slice(0, 30)) lines.push(`- ${stripHtml(f)}`);
    lines.push("");
  }

  // Integrations
  const integrations = toList(p.integrations);
  if (integrations.length) {
    lines.push("## Integrations");
    lines.push("");
    lines.push(integrations.slice(0, 50).map((i) => stripHtml(i)).join(", "));
    lines.push("");
  }

  // Pricing
  if (p.pricing_description) {
    lines.push("## Pricing");
    lines.push("");
    lines.push(stripHtml(p.pricing_description));
    lines.push("");
  }

  // Pros / Cons
  if (p.pros_summary) {
    lines.push("## Pros");
    lines.push("");
    lines.push(stripHtml(p.pros_summary));
    lines.push("");
  }
  if (p.cons_summary) {
    lines.push("## Cons");
    lines.push("");
    lines.push(stripHtml(p.cons_summary));
    lines.push("");
  }

  // JSON-LD excerpt — fenced code block keeps it valid Markdown while making
  // structured data trivially extractable for AI agents that ingest .md.
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": ["Product", "SoftwareApplication"],
    name: p.name,
    url,
    applicationCategory: category,
    operatingSystem: "Web",
  };
  if (p.tagline) jsonLd.slogan = p.tagline;
  if (description) jsonLd.description = description.slice(0, 500);
  if (p.website_url) jsonLd.sameAs = [p.website_url];
  if (p.founded_year) jsonLd.dateCreated = String(p.founded_year);
  if (p.avg_rating != null && p.total_reviews) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.avg_rating,
      reviewCount: p.total_reviews,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (p.starting_price != null || p.pricing_model) {
    jsonLd.offers = {
      "@type": "Offer",
      ...(p.starting_price != null && {
        price: p.starting_price,
        priceCurrency: "USD",
      }),
      ...(p.pricing_model && { category: p.pricing_model }),
      url: p.website_url || url,
    };
  }
  if (p.categories?.slug) {
    jsonLd.about = {
      "@type": "Thing",
      name: category,
      url: `${BASE_URL}/category/${p.categories.slug}`,
    };
  }

  lines.push("## Structured Data (JSON-LD)");
  lines.push("");
  lines.push(
    "Canonical machine-readable summary for AI extraction. Mirrors the JSON-LD embedded in the HTML page."
  );
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(jsonLd, null, 2));
  lines.push("```");
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push(
    `*Generated by ReviewHunts. Full interactive page: ${url}. See ${BASE_URL}/ai.txt for AI training terms.*`
  );
  lines.push("");

  return lines.join("\n");
}

async function fetchProducts(): Promise<ProductRow[]> {
  const select =
    "slug,name,tagline,description,website_url,pricing_model,starting_price,pricing_description,founded_year,headquarters,avg_rating,total_reviews,features,integrations,pros_summary,cons_summary,updated_at,info_score,categories:category_id(name,slug)";
  const filter = "&is_active=eq.true&info_score=gte.4&total_reviews=gte.1";
  const url = `${SUPABASE_URL}/rest/v1/products?select=${select}${filter}&limit=5000`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    console.warn(`[product-md] fetch failed: ${res.status}`);
    return [];
  }
  return (await res.json()) as ProductRow[];
}

async function main() {
  if (existsSync(OUT_DIR)) {
    try {
      rmSync(OUT_DIR, { recursive: true, force: true });
    } catch {}
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const products = await fetchProducts();
  let written = 0;
  for (const p of products) {
    if (!p.slug) continue;
    try {
      writeFileSync(resolve(OUT_DIR, `${p.slug}.md`), renderMarkdown(p));
      written++;
    } catch (e) {
      console.warn(`[product-md] failed for ${p.slug}:`, e);
    }
  }

  // Lightweight index for crawlers that want a single entry-point.
  const index = [
    "# ReviewHunts — Product Markdown Index",
    "",
    `Updated: ${new Date().toISOString()}`,
    `Total: ${written} products`,
    "",
    "Each entry is a canonical Markdown rendering of the corresponding HTML page.",
    "Linked from each HTML page via <link rel=\"alternate\" type=\"text/markdown\">.",
    "",
    ...products
      .filter((p) => p.slug)
      .map(
        (p) =>
          `- [${p.name}](${BASE_URL}/product/${p.slug}.md) — ${BASE_URL}/product/${p.slug}`
      ),
    "",
  ].join("\n");
  writeFileSync(resolve(OUT_DIR, "index.md"), index);

  console.log(`[product-md] wrote ${written} product .md files`);
}

main().catch((e) => {
  console.error("[product-md] generation failed:", e);
});
