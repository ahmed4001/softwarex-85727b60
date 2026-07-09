/**
 * Browser-less prerender: writes per-route dist/<path>/index.html files with
 * unique <head> tags (title, description, canonical, og:*, twitter:*, JSON-LD)
 * derived from Supabase content. No Playwright/Chromium — safe on Vercel.
 *
 * Fixes the "Duplicate without user-selected canonical" bucket in GSC where
 * every product/blog URL previously served identical homepage HTML.
 *
 * Run: `tsx scripts/prerender-static.ts` after `vite build`.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://reviewhunts.com").replace(/\/+$/, "");
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ffeimjfunghzxgeqiwma.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg";

const PAGE_SIZE = 1000;

async function fetchAll(table: string, select: string, filter = "", order = ""): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}${order}`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${from}-${to}`,
          "Range-Unit": "items",
        },
      });
      if (!res.ok) { console.warn(`[prerender-static] ${table} ${res.status}`); break; }
      const batch = await res.json();
      if (!Array.isArray(batch) || !batch.length) break;
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += batch.length;
    } catch (e) { console.warn(`[prerender-static] ${table}`, e); break; }
  }
  return all;
}

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const truncate = (s: string, max: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).replace(/[,;:.\s]+\S*$/, "") + "…";
};

interface Meta {
  title: string;
  description: string;
  path: string;
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogType?: string;
}

function renderHead(m: Meta, template: string): string {
  const canonical = `${SITE_URL}${m.path}`;
  const title = truncate(m.title, 65);
  const desc = truncate(m.description || m.title, 158);
  const image = m.image || `${SITE_URL}/reviewhunts-logo.png`;
  const ogType = m.ogType || "website";
  const ldArr = Array.isArray(m.jsonLd) ? m.jsonLd : m.jsonLd ? [m.jsonLd] : [];
  const ldHtml = ldArr
    .map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`)
    .join("\n    ");

  let html = template;
  // <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
  // description
  html = html.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${esc(desc)}" />`,
  );
  // canonical
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(canonical)}" />`);
  } else {
    html = html.replace("</head>", `  <link rel="canonical" href="${esc(canonical)}" />\n</head>`);
  }
  // og:* / twitter:* — replace or append
  const upserts: [RegExp, string][] = [
    [/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${esc(title)}" />`],
    [/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${esc(desc)}" />`],
    [/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${esc(canonical)}" />`],
    [/<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${esc(ogType)}" />`],
    [/<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${esc(image)}" />`],
    [/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${esc(title)}" />`],
    [/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${esc(desc)}" />`],
    [/<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${esc(image)}" />`],
  ];
  for (const [re, tag] of upserts) {
    html = re.test(html) ? html.replace(re, tag) : html.replace("</head>", `  ${tag}\n</head>`);
  }
  if (ldHtml) {
    // Append per-page JSON-LD (in addition to sitewide Organization/WebSite)
    html = html.replace("</head>", `    ${ldHtml}\n</head>`);
  }
  // Marker so we can verify prerendering worked
  html = html.replace("<html ", '<html data-prerendered="static" ');
  return html;
}

async function writeRoute(distDir: string, m: Meta, template: string) {
  const html = renderHead(m, template);
  const outPath =
    m.path === "/"
      ? path.join(distDir, "index.html")
      : path.join(distDir, m.path.replace(/^\//, ""), "index.html");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, "utf8");
}

async function main() {
  const distDir = path.resolve("dist");
  if (!existsSync(distDir)) { console.error("[prerender-static] dist/ missing — run vite build first"); process.exit(1); }
  const template = await readFile(path.join(distDir, "index.html"), "utf8");

  const [products, categories, posts, comparisons, guides, glossary, landing, bestLanding] = await Promise.all([
    fetchAll("products", "slug,name,description,tagline,logo_url,avg_rating,total_reviews", "&is_active=eq.true", ""),
    fetchAll("categories", "slug,name,description,icon", "&is_active=eq.true", ""),
    fetchAll("blog_posts", "slug,title,excerpt,featured_image,published_at,updated_at,seo_title,seo_description", "&status=eq.published", ""),
    fetchAll("comparisons", "slug,title,summary,seo_title,seo_description", "&is_published=eq.true&slug=not.is.null", ""),
    fetchAll("buyer_guides", "slug,title,description,updated_at", "&is_published=eq.true", ""),
    fetchAll("glossary_terms", "slug,term,definition", "", ""),
    fetchAll("keyword_landing_pages", "slug,page_type,h1,meta_title,meta_description,excerpt", "&is_published=eq.true&status=eq.published", ""),
    Promise.resolve([]),
  ]);

  console.log(
    `[prerender-static] fetched: products=${products.length} categories=${categories.length} posts=${posts.length} comparisons=${comparisons.length} guides=${guides.length} glossary=${glossary.length} landing=${landing.length} best=${bestLanding.length}`,
  );

  let count = 0;
  const brand = "ReviewHunts";

  for (const p of products) {
    if (!p?.slug) continue;
    const name = p.name || p.slug;
    const title = `${name} Review — Features, Pricing & Alternatives | ${brand}`;
    const description = p.description || p.tagline || `Read verified user reviews of ${name}. Compare features, pricing, pros/cons, and alternatives on ${brand}.`;
    const path_ = `/product/${p.slug}`;
    const image = p.logo_url || undefined;
    const jsonLd: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description: truncate(description, 300),
        url: `${SITE_URL}${path_}`,
        ...(image ? { image } : {}),
        ...(p.avg_rating && p.total_reviews ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(p.avg_rating).toFixed(1),
            reviewCount: p.total_reviews,
          },
        } : {}),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Products", item: `${SITE_URL}/categories` },
          { "@type": "ListItem", position: 3, name, item: `${SITE_URL}${path_}` },
        ],
      },
    ];
    await writeRoute(distDir, { title, description, path: path_, image, jsonLd, ogType: "product" }, template);
    count++;
  }

  for (const c of categories) {
    if (!c?.slug) continue;
    const name = c.name || c.slug;
    const title = `Best ${name} Software in 2026 — Reviews & Pricing | ${brand}`;
    const description = c.description || `Compare the best ${name} software. Verified reviews, pricing, features, and alternatives — updated for 2026.`;
    await writeRoute(distDir, {
      title, description, path: `/category/${c.slug}`, image: c.icon || undefined,
      jsonLd: {
        "@context": "https://schema.org", "@type": "CollectionPage",
        name: title, description: truncate(description, 300), url: `${SITE_URL}/category/${c.slug}`,
      },
    }, template);
    count++;
  }

  for (const b of posts) {
    if (!b?.slug) continue;
    const bt = b.seo_title || b.title;
    const title = `${bt} | ${brand} Blog`;
    const description = b.seo_description || b.excerpt || bt;
    await writeRoute(distDir, {
      title, description, path: `/blog/${b.slug}`, image: b.featured_image || undefined, ogType: "article",
      jsonLd: {
        "@context": "https://schema.org", "@type": "Article",
        headline: b.title, description: truncate(description, 300),
        url: `${SITE_URL}/blog/${b.slug}`,
        ...(b.featured_image ? { image: b.featured_image } : {}),
        ...(b.published_at ? { datePublished: b.published_at } : {}),
        ...(b.updated_at ? { dateModified: b.updated_at } : {}),
        publisher: { "@type": "Organization", name: brand, logo: { "@type": "ImageObject", url: `${SITE_URL}/reviewhunts-logo.png` } },
      },
    }, template);
    count++;
  }

  for (const c of comparisons) {
    if (!c?.slug) continue;
    await writeRoute(distDir, {
      title: `${c.seo_title || c.title || c.slug} — Side-by-Side Comparison | ${brand}`,
      description: c.seo_description || c.summary || `Compare ${c.title || c.slug} — features, pricing, pros/cons, and user reviews side-by-side.`,
      path: `/compare/${c.slug}`,
    }, template);
    count++;
  }

  for (const g of guides) {
    if (!g?.slug) continue;
    await writeRoute(distDir, {
      title: `${g.title || g.slug} — Buyer's Guide | ${brand}`,
      description: g.description || `${g.title}: expert buyer's guide covering features, pricing, and how to choose.`,
      path: `/guides/${g.slug}`,
      ogType: "article",
    }, template);
    count++;
  }

  for (const t of glossary) {
    if (!t?.slug) continue;
    const term = t.term || t.slug;
    const def = t.definition || `Definition of ${term} in the ${brand} SaaS glossary.`;
    await writeRoute(distDir, {
      title: `${term} — Definition & Meaning | ${brand} Glossary`,
      description: def,
      path: `/glossary/${t.slug}`,
      jsonLd: {
        "@context": "https://schema.org", "@type": "DefinedTerm",
        name: term, description: truncate(def, 300), url: `${SITE_URL}/glossary/${t.slug}`,
        inDefinedTermSet: `${SITE_URL}/glossary`,
      },
    }, template);
    count++;
  }

  for (const l of landing) {
    if (!l?.slug) continue;
    const prefix = l.page_type === "feature" ? "/features"
      : l.page_type === "use_case" ? "/use-cases"
      : l.page_type === "industry" ? "/industry"
      : l.page_type === "template" ? "/templates"
      : "";
    const path_ = prefix ? `${prefix}/${l.slug}` : `/${l.slug}`;
    const lt = l.meta_title || l.h1 || l.slug;
    await writeRoute(distDir, {
      title: `${lt} | ${brand}`,
      description: l.meta_description || l.excerpt || lt,
      path: path_,
    }, template);
    count++;
  }

  for (const l of bestLanding) {
    if (!l?.slug) continue;
    await writeRoute(distDir, {
      title: `${l.title || l.slug} | ${brand}`,
      description: l.description || l.title || `${l.title} on ${brand}.`,
      path: `/best/${l.slug}`,
    }, template);
    count++;
  }

  console.log(`[prerender-static] wrote ${count} per-route HTML files`);
}

main().catch((e) => { console.error("[prerender-static] fatal", e); process.exit(1); });
