// Generates public/sitemap.xml at predev/prebuild time.
// Fetches dynamic slugs from Supabase via the public REST API (anon key).

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = process.env.SITE_URL || "https://reviewhunts.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ffeimjfunghzxgeqiwma.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg";

interface Entry { loc: string; lastmod?: string; changefreq?: string; priority?: string; }

const staticEntries: Entry[] = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/categories", changefreq: "weekly", priority: "0.9" },
  { loc: "/search", changefreq: "weekly", priority: "0.7" },
  { loc: "/compare", changefreq: "weekly", priority: "0.7" },
  { loc: "/blog", changefreq: "daily", priority: "0.8" },
  { loc: "/leaderboard", changefreq: "weekly", priority: "0.6" },
  { loc: "/awards", changefreq: "monthly", priority: "0.6" },
  { loc: "/lists", changefreq: "weekly", priority: "0.6" },
  { loc: "/stacks", changefreq: "weekly", priority: "0.6" },
  { loc: "/buyer-guides", changefreq: "weekly", priority: "0.7" },
  { loc: "/glossary", changefreq: "monthly", priority: "0.5" },
  { loc: "/partners", changefreq: "monthly", priority: "0.5" },
  { loc: "/pricing", changefreq: "monthly", priority: "0.6" },
  { loc: "/discussions", changefreq: "daily", priority: "0.6" },
  { loc: "/activity", changefreq: "daily", priority: "0.4" },
];

async function fetchTable(table: string, select: string, filter = ""): Promise<any[]> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}&limit=2000`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[sitemap] ${table} -> ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.warn(`[sitemap] ${table} failed`, e);
    return [];
  }
}

function fmt(d?: string): string | undefined { return d ? d.split("T")[0] : undefined; }

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  const entries: Entry[] = staticEntries.map(e => ({ ...e, loc: `${BASE_URL}${e.loc}` }));

  const [products, categories, posts, comparisons, pages, guides, lists, glossary, landing] =
    await Promise.all([
      fetchTable("products", "slug,updated_at", "&is_active=eq.true"),
      fetchTable("categories", "slug,updated_at", "&is_active=eq.true"),
      fetchTable("blog_posts", "slug,updated_at,tags,category,author_id", "&status=eq.published"),
      fetchTable("comparisons", "slug,created_at", "&is_published=eq.true"),
      fetchTable("pages", "slug,updated_at", "&is_active=eq.true"),
      fetchTable("buyer_guides", "slug,updated_at"),
      fetchTable("lists", "slug,updated_at", "&is_published=eq.true"),
      fetchTable("glossary_terms", "slug,updated_at"),
      fetchTable("keyword_landing_pages", "slug,updated_at", "&is_published=eq.true"),
    ]);

  const push = (rows: any[], prefix: string, priority = "0.7") => {
    for (const r of rows || []) {
      if (!r?.slug) continue;
      entries.push({ loc: `${BASE_URL}${prefix}/${r.slug}`, lastmod: fmt(r.updated_at), priority });
    }
  };
  push(products, "/product", "0.8");
  push(categories, "/category", "0.8");
  push(posts, "/blog", "0.7");
  push(comparisons, "/compare", "0.7");
  push(pages, "/page", "0.5");
  push(guides, "/buyer-guides", "0.6");
  push(lists, "/lists", "0.5");
  push(glossary, "/glossary", "0.4");
  push(landing, "", "0.6");

  // Blog taxonomy + author pages derived from published posts.
  const tagSet = new Set<string>();
  const categorySet = new Set<string>();
  const authorSet = new Set<string>();
  for (const p of posts || []) {
    if (Array.isArray(p?.tags)) for (const t of p.tags) if (t) tagSet.add(String(t));
    if (p?.category) categorySet.add(String(p.category));
    if (p?.author_id) authorSet.add(String(p.author_id));
  }
  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  for (const tag of tagSet) {
    entries.push({ loc: `${BASE_URL}/blog/tag/${encodeURIComponent(slugify(tag))}`, priority: "0.5" });
  }
  for (const cat of categorySet) {
    entries.push({ loc: `${BASE_URL}/blog/category/${encodeURIComponent(slugify(cat))}`, priority: "0.5" });
  }
  for (const id of authorSet) {
    entries.push({ loc: `${BASE_URL}/author/${id}`, priority: "0.4" });
  }



  const body = entries.map(e => [
    "  <url>",
    `    <loc>${xmlEscape(e.loc)}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n")).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`[sitemap] wrote ${entries.length} URLs to public/sitemap.xml`);
}

main().catch(err => { console.error(err); process.exit(0); });
