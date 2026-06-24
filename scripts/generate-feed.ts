/**
 * Generates public/feed.xml — RSS 2.0 + Atom-style feed of the latest 50
 * blog posts. Used by Perplexity, ChatGPT, Claude, and traditional readers
 * to detect freshness without crawling the whole site.
 *
 * Runs alongside generate-sitemap.ts and generate-llms-txt.ts.
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

function xmlEscape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(s: string): string {
  return `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

async function main() {
  let items: any[] = [];
  if (SUPABASE_URL && SUPABASE_KEY) {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await sb
      .from("blog_posts")
      .select("title,slug,excerpt,featured_image,category,author_id,published_at,updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    items = data || [];
  }

  const lastBuild = items[0]?.updated_at || items[0]?.published_at || new Date().toISOString();

  const itemsXml = items
    .map((p) => {
      const link = `${BASE_URL}/blog/${p.slug}`;
      const pub = p.published_at ? new Date(p.published_at).toUTCString() : new Date().toUTCString();
      return `    <item>
      <title>${cdata(p.title || "Untitled")}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${pub}</pubDate>
      ${p.category ? `<category>${cdata(p.category)}</category>` : ""}
      ${p.featured_image ? `<enclosure url="${xmlEscape(p.featured_image)}" type="image/jpeg" />` : ""}
      <description>${cdata(p.excerpt || "")}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>ReviewHunts — Latest Articles</title>
    <link>${BASE_URL}/blog</link>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>The latest software reviews, comparisons, buyer guides, and deals from ReviewHunts.</description>
    <language>en</language>
    <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
    <generator>ReviewHunts feed generator</generator>
    <image>
      <url>${BASE_URL}/reviewhunts-logo.png</url>
      <title>ReviewHunts</title>
      <link>${BASE_URL}</link>
    </image>
${itemsXml}
  </channel>
</rss>
`;
  writeFileSync(resolve("public/feed.xml"), xml);
  console.log(`feed.xml written (${items.length} items)`);
}

main().catch((e) => {
  console.error("feed.xml generation failed:", e);
  const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>ReviewHunts</title><link>${BASE_URL}/blog</link><description>ReviewHunts feed</description></channel></rss>
`;
  writeFileSync(resolve("public/feed.xml"), fallback);
});
