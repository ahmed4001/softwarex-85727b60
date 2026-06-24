// Generates a sitemap INDEX plus per-type child sitemaps at predev/prebuild.
// Splitting helps Google process high-value URLs first and reduces "Discovered –
// currently not indexed" backlog. Only quality URLs are included; thin pages
// (empty tag/author/category) are skipped.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = process.env.SITE_URL || "https://reviewhunts.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ffeimjfunghzxgeqiwma.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg";

interface Entry { loc: string; lastmod?: string; changefreq?: string; priority?: string; }

const today = new Date().toISOString().split("T")[0];

async function fetchTable(table: string, select: string, filter = ""): Promise<any[]> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}&limit=5000`;
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) { console.warn(`[sitemap] ${table} -> ${res.status}`); return []; }
    return await res.json();
  } catch (e) { console.warn(`[sitemap] ${table} failed`, e); return []; }
}

const fmt = (d?: string) => d ? d.split("T")[0] : undefined;
const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildUrlset(entries: Entry[]): string {
  const body = entries.map(e => [
    "  <url>",
    `    <loc>${xmlEscape(e.loc)}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n")).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function writeSitemap(filename: string, entries: Entry[]) {
  if (!entries.length) return null;
  writeFileSync(resolve(`public/${filename}`), buildUrlset(entries));
  console.log(`[sitemap] ${filename}: ${entries.length} URLs`);
  return filename;
}

async function main() {
  // ---- Static high-priority pages ----
  const staticEntries: Entry[] = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/categories", changefreq: "weekly", priority: "0.9" },
    { loc: "/search", changefreq: "weekly", priority: "0.6" },
    { loc: "/compare", changefreq: "weekly", priority: "0.7" },
    { loc: "/blog", changefreq: "daily", priority: "0.8" },
    { loc: "/leaderboard", changefreq: "weekly", priority: "0.6" },
    { loc: "/awards", changefreq: "monthly", priority: "0.5" },
    { loc: "/lists", changefreq: "weekly", priority: "0.6" },
    { loc: "/stacks", changefreq: "weekly", priority: "0.6" },
    { loc: "/guides", changefreq: "weekly", priority: "0.7" },
    { loc: "/glossary", changefreq: "monthly", priority: "0.5" },
    { loc: "/partners", changefreq: "monthly", priority: "0.4" },
    { loc: "/pricing", changefreq: "monthly", priority: "0.6" },
    { loc: "/discussions", changefreq: "daily", priority: "0.5" },
  ].map(e => ({ ...e, loc: `${BASE_URL}${e.loc}`, lastmod: today }));

  // ---- Fetch all content ----
  const [products, categories, posts, comparisons, pages, guides, lists, glossary, landing, discussions] =
    await Promise.all([
      // Quality filter: must have description (skip thin pages Google would mark "Crawled - not indexed")
      // Quality filter: must have description, real website, and at least 1 review (avoids "Crawled - not indexed")
      fetchTable("products", "slug,updated_at,description,website_url,total_reviews,info_score", "&is_active=eq.true&info_score=gte.4&total_reviews=gte.1"),
      fetchTable("categories", "slug,updated_at,description", "&is_active=eq.true"),
      fetchTable("blog_posts", "slug,updated_at", "&status=eq.published"),
      fetchTable("comparisons", "slug,created_at", "&is_published=eq.true"),
      fetchTable("pages", "slug,updated_at", "&is_active=eq.true"),
      fetchTable("buyer_guides", "slug,updated_at"),
      fetchTable("lists", "slug,updated_at", "&is_published=eq.true"),
      fetchTable("glossary_terms", "slug,updated_at,definition"),
      fetchTable("keyword_landing_pages", "slug,updated_at", "&is_published=eq.true"),
      fetchTable("discussions", "slug,updated_at"),
    ]);

  const toEntries = (rows: any[], prefix: string, priority: string, qualityKey?: string): Entry[] =>
    (rows || [])
      .filter(r => r?.slug && (!qualityKey || (r[qualityKey] && String(r[qualityKey]).length > 40)))
      .map(r => ({
        loc: `${BASE_URL}${prefix}/${r.slug}`,
        lastmod: fmt(r.updated_at || r.created_at) || today,
        priority,
      }));

  const productEntries = toEntries(products, "/product", "0.8", "description");
  const categoryEntries = toEntries(categories, "/category", "0.8", "description");
  const blogEntries = toEntries(posts, "/blog", "0.7");
  const compareEntries = toEntries(comparisons, "/compare", "0.7");
  const pageEntries = toEntries(pages, "/page", "0.5");
  const guideEntries = toEntries(guides, "/guides", "0.6");
  const listEntries = toEntries(lists, "/lists", "0.5");
  const glossaryEntries = toEntries(glossary, "/glossary", "0.4", "definition");
  const discussionEntries = toEntries(discussions, "/discussions", "0.4");
  const landingEntries = (landing || [])
    .filter(r => r?.slug)
    .map(r => ({ loc: `${BASE_URL}/${r.slug}`, lastmod: fmt(r.updated_at) || today, priority: "0.6" }));

  // ---- Write per-type child sitemaps ----
  const childMaps: string[] = [];
  const add = (name: string, entries: Entry[]) => {
    const f = writeSitemap(name, entries);
    if (f) childMaps.push(f);
  };
  add("sitemap-main.xml", [...staticEntries, ...pageEntries]);
  add("sitemap-products.xml", productEntries);
  add("sitemap-categories.xml", categoryEntries);
  add("sitemap-blog.xml", blogEntries);
  add("sitemap-comparisons.xml", compareEntries);
  add("sitemap-guides.xml", [...guideEntries, ...listEntries]);
  add("sitemap-glossary.xml", glossaryEntries);
  add("sitemap-landing.xml", landingEntries);
  add("sitemap-discussions.xml", discussionEntries);

  // ---- Write sitemap index ----
  const indexBody = childMaps.map(name =>
    `  <sitemap>\n    <loc>${BASE_URL}/${name}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
  ).join("\n");
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexBody}\n</sitemapindex>\n`;
  writeFileSync(resolve("public/sitemap.xml"), indexXml);
  console.log(`[sitemap] sitemap.xml index: ${childMaps.length} child sitemaps`);
}

main().catch(err => { console.error(err); process.exit(0); });
