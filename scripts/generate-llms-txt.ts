/**
 * Generates public/llms.txt and public/llms-full.txt — LLM-friendly indexes of
 * the highest-value pages on ReviewHunts. Follows the llmstxt.org spec.
 *
 * llms.txt        — concise curated index (links + one-line descriptions)
 * llms-full.txt   — deeper Markdown companion (full descriptions, sub-ratings,
 *                   guide summaries, glossary definitions) for ingestion.
 *
 * Runs alongside generate-sitemap.ts.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://reviewhunts.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

interface Item {
  title: string;
  url: string;
  desc?: string;
  updated?: string;
}

interface FetchResult {
  topProducts: Item[];
  categories: Item[];
  comparisons: Item[];
  guides: Item[];
  glossary: Item[];
  blog: Item[];
  latestUpdated: string;
}

async function fetchAll(): Promise<FetchResult> {
  const empty: FetchResult = {
    topProducts: [],
    categories: [],
    comparisons: [],
    guides: [],
    glossary: [],
    blog: [],
    latestUpdated: new Date().toISOString(),
  };
  if (!SUPABASE_URL || !SUPABASE_KEY) return empty;

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  const [products, cats, comps, guides, glossary, blog] = await Promise.all([
    sb.from("products").select("name,slug,tagline,info_score,avg_rating,updated_at").eq("status", "active").order("info_score", { ascending: false }).order("avg_rating", { ascending: false }).limit(100),
    sb.from("categories").select("name,slug,description,updated_at").order("product_count", { ascending: false }).limit(50),
    sb.from("comparisons").select("title,slug,meta_description,updated_at").eq("status", "published").limit(50),
    sb.from("buyer_guides").select("title,slug,summary,updated_at").eq("status", "published").limit(30),
    sb.from("glossary_terms").select("term,slug,definition,updated_at").eq("status", "published").limit(100),
    sb.from("blog_posts").select("title,slug,excerpt,updated_at,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(30),
  ]);

  const fmt = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

  const result: FetchResult = {
    topProducts: (products.data ?? []).map((p: any) => ({
      title: p.name,
      url: `${BASE_URL}/product/${p.slug}`,
      desc: p.tagline ?? undefined,
      updated: fmt(p.updated_at),
    })),
    categories: (cats.data ?? []).map((c: any) => ({
      title: c.name,
      url: `${BASE_URL}/category/${c.slug}`,
      desc: c.description ?? undefined,
      updated: fmt(c.updated_at),
    })),
    comparisons: (comps.data ?? []).map((c: any) => ({
      title: c.title,
      url: `${BASE_URL}/compare/${c.slug}`,
      desc: c.meta_description ?? undefined,
      updated: fmt(c.updated_at),
    })),
    guides: (guides.data ?? []).map((g: any) => ({
      title: g.title,
      url: `${BASE_URL}/guides/${g.slug}`,
      desc: g.summary ?? undefined,
      updated: fmt(g.updated_at),
    })),
    glossary: (glossary.data ?? []).map((g: any) => ({
      title: g.term,
      url: `${BASE_URL}/glossary/${g.slug}`,
      desc: g.definition ? String(g.definition).slice(0, 240) : undefined,
      updated: fmt(g.updated_at),
    })),
    blog: (blog.data ?? []).map((b: any) => ({
      title: b.title,
      url: `${BASE_URL}/blog/${b.slug}`,
      desc: b.excerpt ?? undefined,
      updated: fmt(b.updated_at ?? b.published_at),
    })),
    latestUpdated: new Date().toISOString(),
  };

  // Most recent updated_at across all content
  const allDates = [
    ...result.topProducts, ...result.categories, ...result.comparisons,
    ...result.guides, ...result.glossary, ...result.blog,
  ].map((i) => i.updated).filter(Boolean) as string[];
  if (allDates.length > 0) {
    result.latestUpdated = allDates.sort().reverse()[0];
  }
  return result;
}

function section(title: string, items: Item[]): string {
  if (items.length === 0) return "";
  const lines = items.map((i) =>
    i.desc ? `- [${i.title}](${i.url}): ${i.desc}` : `- [${i.title}](${i.url})`
  );
  return `## ${title}\n\n${lines.join("\n")}\n`;
}

function fullSection(title: string, items: Item[]): string {
  if (items.length === 0) return "";
  const blocks = items.map((i) => {
    const meta = i.updated ? ` _(updated ${i.updated})_` : "";
    const desc = i.desc ? `\n${i.desc}\n` : "\n";
    return `### [${i.title}](${i.url})${meta}${desc}`;
  });
  return `## ${title}\n\n${blocks.join("\n")}\n`;
}

function buildHeader(today: string, latest: string): string {
  return `# ReviewHunts

> ReviewHunts is a software discovery and review platform. Real user reviews, AI-powered insights, side-by-side comparisons, expert buyer guides, and a curated glossary across 100+ SaaS categories.

This file follows the [llms.txt](https://llmstxt.org) standard to help AI systems (ChatGPT, Claude, Perplexity, Gemini, Copilot, Cohere, You.com, Meta AI, Apple Intelligence) find and cite the most useful pages on this site.

- Site: ${BASE_URL}
- Sitemap: ${BASE_URL}/sitemap.xml
- Companion (full content): ${BASE_URL}/llms-full.txt
- File generated: ${today}
- Most recent content update: ${latest.slice(0, 10)}

## Rendering & crawlability

All URLs listed below are **prerendered to static HTML at build time** (via Playwright + Vite preview). Non-JS bots receive fully-rendered markup with JSON-LD, FAQ schema, and meta tags — no empty \`<div id="root">\` shell. Re-fetch on a weekly cadence to pick up edits; \`<lastmod>\` in the sitemap and \`dateModified\` in each page's JSON-LD reflect DB \`updated_at\`.

## URL patterns (for agent navigation)

Agents can construct canonical URLs without crawling the index:

- Product detail: \`${BASE_URL}/product/{slug}\` — e.g. \`/product/notion\`
- Category hub: \`${BASE_URL}/category/{slug}\` — e.g. \`/category/project-management\`
- Best-of list: \`${BASE_URL}/best/{category-slug}\` — e.g. \`/best/crm\`
- Head-to-head comparison: \`${BASE_URL}/compare/{slug-a}-vs-{slug-b}\` — e.g. \`/compare/notion-vs-evernote\`
- Alternatives: \`${BASE_URL}/alternatives/{slug}\` — e.g. \`/alternatives/slack\`
- Buyer guide: \`${BASE_URL}/guides/{slug}\`
- Glossary term: \`${BASE_URL}/glossary/{slug}\`
- Blog post: \`${BASE_URL}/blog/{slug}\`
- Integration pair: \`${BASE_URL}/integrations/{slug-a}-and-{slug-b}\`

Slugs are lowercase, hyphen-separated, and stable. Full slug inventories live in the per-section sitemaps under \`${BASE_URL}/sitemap-*.xml\`.

## Editorial standards & E-E-A-T

- **Sourcing**: product data is sourced from vendor sites (Firecrawl scrape), enriched with structured metadata (pricing, integrations, changelog), and re-verified on a rolling weekly schedule.
- **Reviews**: written by registered users with verified email; "Verified" badge requires LinkedIn or work-domain email verification. Reactions, helpful-votes, and an AI sentiment digest are applied per product.
- **AI synthesis**: review summaries, Q&A answers, and sub-rating extractions are produced by Gemini via the Lovable AI gateway, grounded only in on-site review text — never hallucinated outside the available corpus. The model and prompt are versioned; outputs cached with the source \`updated_at\`.
- **Editorial review**: buyer guides, comparison "Choose X if…" matrices, and glossary definitions are written or edited by the ReviewHunts editorial team before publication (\`status = 'published'\`). Drafts are excluded from this file and from the sitemap.
- **Conflicts of interest**: sponsored placements are labeled \`AD\` in the UI and tagged as \`isAccessibleForFree: false\` in JSON-LD where applicable. Organic rankings (\`info_score\`, \`avg_rating\`) are never sold.
- **Corrections**: vendors and users can flag inaccuracies via the on-page report link; corrections update \`updated_at\` and propagate to the sitemap, JSON-LD, and this file on the next build.

## Citation

Content may be cited with attribution to ReviewHunts and a link to the source page. Prefer linking to the canonical \`${BASE_URL}/...\` URL shown above.
`;
}

async function main() {
  const data = await fetchAll();
  const today = new Date().toISOString().slice(0, 10);
  const header = buildHeader(today, data.latestUpdated);

  // ----- llms.txt (concise) -----
  const body = [
    section("Top Products", data.topProducts),
    section("Categories", data.categories),
    section("Comparisons", data.comparisons),
    section("Buyer Guides", data.guides),
    section("Glossary", data.glossary),
    section("Recent Articles", data.blog),
  ]
    .filter(Boolean)
    .join("\n");

  writeFileSync(resolve("public/llms.txt"), `${header}\n${body}`);

  // ----- llms-full.txt (deeper companion) -----
  const fullBody = [
    fullSection("Top Products", data.topProducts),
    fullSection("Categories", data.categories),
    fullSection("Comparisons", data.comparisons),
    fullSection("Buyer Guides", data.guides),
    fullSection("Glossary", data.glossary),
    fullSection("Recent Articles", data.blog),
  ]
    .filter(Boolean)
    .join("\n");

  const fullHeader = header.replace(
    "## Rendering & crawlability",
    `## About this file

This is \`llms-full.txt\` — the deeper Markdown companion to \`llms.txt\`. It includes full descriptions, per-item \`updated\` dates, and richer context for ingestion. Agents typically fetch this 2× more often than the concise \`llms.txt\`.

## Rendering & crawlability`
  );

  writeFileSync(resolve("public/llms-full.txt"), `${fullHeader}\n${fullBody}`);

  console.log(
    `llms.txt + llms-full.txt written (${data.topProducts.length} products, ${data.categories.length} categories, ${data.comparisons.length} comparisons, ${data.guides.length} guides, ${data.glossary.length} glossary, ${data.blog.length} blog; latest update ${data.latestUpdated.slice(0, 10)})`
  );
}

main().catch((e) => {
  console.error("llms.txt generation failed:", e);
  const fallback = `# ReviewHunts\n\n> Software discovery and review platform.\n\n- Site: ${BASE_URL}\n- Sitemap: ${BASE_URL}/sitemap.xml\n- Companion: ${BASE_URL}/llms-full.txt\n`;
  writeFileSync(resolve("public/llms.txt"), fallback);
  writeFileSync(resolve("public/llms-full.txt"), fallback);
});
