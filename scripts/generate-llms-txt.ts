/**
 * Generates public/llms.txt — a curated, LLM-friendly index of the highest-value
 * pages on ReviewHunts. Follows the llmstxt.org spec.
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
}

async function fetchAll(): Promise<{
  topProducts: Item[];
  categories: Item[];
  comparisons: Item[];
  guides: Item[];
  glossary: Item[];
  blog: Item[];
}> {
  const empty = {
    topProducts: [],
    categories: [],
    comparisons: [],
    guides: [],
    glossary: [],
    blog: [],
  };
  if (!SUPABASE_URL || !SUPABASE_KEY) return empty;

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  const [products, cats, comps, guides, glossary, blog] = await Promise.all([
    sb.from("products").select("name,slug,tagline,info_score,avg_rating").eq("status", "active").order("info_score", { ascending: false }).order("avg_rating", { ascending: false }).limit(100),
    sb.from("categories").select("name,slug,description").order("product_count", { ascending: false }).limit(50),
    sb.from("comparisons").select("title,slug,meta_description").eq("status", "published").limit(50),
    sb.from("buyer_guides").select("title,slug,summary").eq("status", "published").limit(30),
    sb.from("glossary_terms").select("term,slug,definition").eq("status", "published").limit(100),
    sb.from("blog_posts").select("title,slug,excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(30),
  ]);

  return {
    topProducts: (products.data ?? []).map((p: any) => ({
      title: p.name,
      url: `${BASE_URL}/product/${p.slug}`,
      desc: p.tagline ?? undefined,
    })),
    categories: (cats.data ?? []).map((c: any) => ({
      title: c.name,
      url: `${BASE_URL}/category/${c.slug}`,
      desc: c.description ?? undefined,
    })),
    comparisons: (comps.data ?? []).map((c: any) => ({
      title: c.title,
      url: `${BASE_URL}/compare/${c.slug}`,
      desc: c.meta_description ?? undefined,
    })),
    guides: (guides.data ?? []).map((g: any) => ({
      title: g.title,
      url: `${BASE_URL}/guides/${g.slug}`,
      desc: g.summary ?? undefined,
    })),
    glossary: (glossary.data ?? []).map((g: any) => ({
      title: g.term,
      url: `${BASE_URL}/glossary/${g.slug}`,
      desc: g.definition ? String(g.definition).slice(0, 140) : undefined,
    })),
    blog: (blog.data ?? []).map((b: any) => ({
      title: b.title,
      url: `${BASE_URL}/blog/${b.slug}`,
      desc: b.excerpt ?? undefined,
    })),
  };
}

function section(title: string, items: Item[]): string {
  if (items.length === 0) return "";
  const lines = items.map((i) =>
    i.desc ? `- [${i.title}](${i.url}): ${i.desc}` : `- [${i.title}](${i.url})`
  );
  return `## ${title}\n\n${lines.join("\n")}\n`;
}

async function main() {
  const data = await fetchAll();

  const header = `# ReviewHunts

> ReviewHunts is a software discovery and review platform. Real user reviews, AI-powered insights, side-by-side comparisons, expert buyer guides, and a curated glossary across 100+ SaaS categories.

This file follows the [llms.txt](https://llmstxt.org) standard to help AI systems (ChatGPT, Claude, Perplexity, Gemini, Copilot) find and cite the most useful pages on this site.

- Site: ${BASE_URL}
- Sitemap: ${BASE_URL}/sitemap.xml
- License: Content may be cited with attribution to ReviewHunts and a link to the source page.
`;

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

  const out = `${header}\n${body}`;
  writeFileSync(resolve("public/llms.txt"), out);
  console.log(
    `llms.txt written (${data.topProducts.length} products, ${data.categories.length} categories, ${data.comparisons.length} comparisons, ${data.guides.length} guides, ${data.glossary.length} glossary, ${data.blog.length} blog)`
  );
}

main().catch((e) => {
  console.error("llms.txt generation failed:", e);
  // Write a minimal fallback so the file always exists
  writeFileSync(
    resolve("public/llms.txt"),
    `# ReviewHunts\n\n> Software discovery and review platform.\n\n- Site: ${BASE_URL}\n- Sitemap: ${BASE_URL}/sitemap.xml\n`
  );
});
