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
  id: string;
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

interface QARow {
  id: string;
  product_id: string;
  parent_id: string | null;
  body: string | null;
  upvote_count: number | null;
  created_at: string | null;
  user_id: string | null;
  author_name?: string | null;
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

interface QAThread {
  question: QARow;
  answers: QARow[]; // ordered: highest upvotes first
}

function renderMarkdown(p: ProductRow, qa: QAThread | null): string {
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

  // ---- QAPage JSON-LD: top user question + accepted/suggested answers ----
  if (qa && qa.question?.body && qa.answers.length > 0) {
    const top = qa.question;
    const accepted = qa.answers[0];
    const suggested = qa.answers.slice(1, 5);
    const qaPage: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "QAPage",
      mainEntity: {
        "@type": "Question",
        name: (top.body || "").slice(0, 240),
        text: top.body || "",
        url: `${url}#qa-${top.id}`,
        answerCount: qa.answers.length,
        ...(top.upvote_count != null && { upvoteCount: top.upvote_count }),
        ...(top.created_at && { dateCreated: new Date(top.created_at).toISOString() }),
        ...(top.author_name && { author: { "@type": "Person", name: top.author_name } }),
        acceptedAnswer: {
          "@type": "Answer",
          text: accepted.body || "",
          ...(accepted.upvote_count != null && { upvoteCount: accepted.upvote_count }),
          ...(accepted.created_at && {
            dateCreated: new Date(accepted.created_at).toISOString(),
          }),
          ...(accepted.author_name && {
            author: { "@type": "Person", name: accepted.author_name },
          }),
        },
        ...(suggested.length > 0 && {
          suggestedAnswer: suggested.map((a) => ({
            "@type": "Answer",
            text: a.body || "",
            ...(a.upvote_count != null && { upvoteCount: a.upvote_count }),
            ...(a.created_at && { dateCreated: new Date(a.created_at).toISOString() }),
            ...(a.author_name && { author: { "@type": "Person", name: a.author_name } }),
          })),
        }),
      },
    };

    lines.push("## Q&A (JSON-LD)");
    lines.push("");
    lines.push(
      `Top community question for ${p.name}. Mirrors the QAPage schema embedded in the HTML page.`
    );
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(qaPage, null, 2));
    lines.push("```");
    lines.push("");
  }

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
    "id,slug,name,tagline,description,website_url,pricing_model,starting_price,pricing_description,founded_year,headquarters,avg_rating,total_reviews,features,integrations,pros_summary,cons_summary,updated_at,info_score,categories:category_id(name,slug)";
  const filter = "&is_active=eq.true&info_score=gte.4&total_reviews=gte.1";
  const url = `${SUPABASE_URL}/rest/v1/products?select=${select}${filter}&limit=5000`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) {
    console.warn(`[product-md] fetch failed: ${res.status}`);
    return [];
  }
  return (await res.json()) as ProductRow[];
}

/**
 * Fetch the top question (by upvotes) for every product plus its answers.
 * Pages through review_qa to capture all top-level questions, then all
 * answers under those top questions. Author names join via a single
 * profiles lookup.
 */
async function fetchTopQA(productIds: string[]): Promise<Map<string, QAThread>> {
  const out = new Map<string, QAThread>();
  if (!productIds.length) return out;
  const PAGE = 1000;
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  // Top-level questions across all products, ordered by upvotes desc.
  const productSet = new Set(productIds);

  // Fetch all active top-level questions globally (filtering by 600+ product
  // IDs would overflow URL/header limits). We filter to our product set in
  // memory afterwards.
  const all: QARow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/review_qa?select=id,product_id,parent_id,body,upvote_count,created_at,user_id&parent_id=is.null&status=eq.active&order=upvote_count.desc.nullslast&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[product-md] QA questions fetch failed: ${res.status}`);
      break;
    }
    const batch = (await res.json()) as QARow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }

  const topByProduct = new Map<string, QARow>();
  for (const q of all) {
    if (!productSet.has(q.product_id)) continue;
    if (!topByProduct.has(q.product_id)) topByProduct.set(q.product_id, q);
  }
  const topQuestionIds = [...topByProduct.values()].map((q) => q.id);
  if (!topQuestionIds.length) return out;

  // Answers under those top questions.
  const answersByQ = new Map<string, QARow[]>();
  for (let offset = 0; ; offset += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/review_qa?select=id,product_id,parent_id,body,upvote_count,created_at,user_id&parent_id=in.(${topQuestionIds.join(",")})&status=eq.active&order=upvote_count.desc.nullslast&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[product-md] QA answers fetch failed: ${res.status}`);
      break;
    }
    const batch = (await res.json()) as QARow[];
    for (const a of batch) {
      if (!a.parent_id) continue;
      const arr = answersByQ.get(a.parent_id) || [];
      arr.push(a);
      answersByQ.set(a.parent_id, arr);
    }
    if (batch.length < PAGE) break;
  }

  // Author names — single profiles lookup.
  const userIds = new Set<string>();
  for (const q of topByProduct.values()) if (q.user_id) userIds.add(q.user_id);
  for (const arr of answersByQ.values()) for (const a of arr) if (a.user_id) userIds.add(a.user_id);
  const nameMap = new Map<string, string>();
  if (userIds.size) {
    const url = `${SUPABASE_URL}/rest/v1/profiles?select=user_id,name&user_id=in.(${[...userIds].join(",")})&limit=5000`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ user_id: string; name: string | null }>;
      for (const r of rows) if (r.name) nameMap.set(r.user_id, r.name);
    }
  }

  for (const [productId, q] of topByProduct) {
    const answers = (answersByQ.get(q.id) || []).map((a) => ({
      ...a,
      author_name: a.user_id ? nameMap.get(a.user_id) || null : null,
    }));
    if (!answers.length) continue; // QAPage requires at least one answer.
    out.set(productId, {
      question: { ...q, author_name: q.user_id ? nameMap.get(q.user_id) || null : null },
      answers,
    });
  }
  return out;
}

async function main() {
  if (existsSync(OUT_DIR)) {
    try {
      rmSync(OUT_DIR, { recursive: true, force: true });
    } catch {}
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const products = await fetchProducts();
  const qaMap = await fetchTopQA(products.map((p) => p.id).filter(Boolean));
  let written = 0;
  let withQa = 0;
  for (const p of products) {
    if (!p.slug) continue;
    try {
      const qa = qaMap.get(p.id) || null;
      if (qa) withQa++;
      writeFileSync(resolve(OUT_DIR, `${p.slug}.md`), renderMarkdown(p, qa));
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
    `Total: ${written} products (${withQa} with QAPage data)`,
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

  console.log(`[product-md] wrote ${written} product .md files (${withQa} with QAPage)`);
}

main().catch((e) => {
  console.error("[product-md] generation failed:", e);
});
