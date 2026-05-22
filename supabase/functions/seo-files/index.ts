import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (!type || !["robots", "sitemap"].includes(type)) {
    return new Response("Missing or invalid ?type= parameter. Use 'robots' or 'sitemap'.", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (type === "robots") {
      return await handleRobots(supabase);
    } else {
      const baseUrl = url.searchParams.get("base_url") || url.origin;
      return await handleSitemap(supabase, baseUrl);
    }
  } catch (err) {
    console.error("seo-files error:", err);
    return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
  }
});

async function getSetting(supabase: any, key: string): Promise<any> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

async function handleRobots(supabase: any) {
  const robotsTxt = await getSetting(supabase, "robots_txt");
  const content = robotsTxt ||
    "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /vendor/\nDisallow: /login\n\nSitemap: /sitemap.xml";

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function handleSitemap(supabase: any, baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");

  const [includeProducts, includeCategories, includeBlog, includeComparisons] = await Promise.all([
    getSetting(supabase, "sitemap_include_products"),
    getSetting(supabase, "sitemap_include_categories"),
    getSetting(supabase, "sitemap_include_blog"),
    getSetting(supabase, "sitemap_include_comparisons"),
  ]);

  const urls: { loc: string; lastmod?: string; priority?: string }[] = [];

  // Static pages
  const staticPages = [
    { path: "/", priority: "1.0" },
    { path: "/categories", priority: "0.8" },
    { path: "/compare", priority: "0.7" },
    { path: "/blog", priority: "0.7" },
    { path: "/leaderboard", priority: "0.6" },
  ];
  for (const p of staticPages) {
    urls.push({ loc: `${base}${p.path}`, priority: p.priority });
  }

  if (includeProducts !== false) {
    const { data } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (data) {
      for (const r of data) {
        urls.push({ loc: `${base}/product/${r.slug}`, lastmod: r.updated_at?.split("T")[0], priority: "0.8" });
      }
    }
  }

  if (includeCategories !== false) {
    const { data } = await supabase
      .from("categories")
      .select("slug, updated_at")
      .eq("is_active", true)
      .limit(1000);
    if (data) {
      for (const r of data) {
        urls.push({ loc: `${base}/category/${r.slug}`, lastmod: r.updated_at?.split("T")[0], priority: "0.7" });
      }
    }
  }

  if (includeBlog !== false) {
    const { data } = await supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (data) {
      for (const r of data) {
        urls.push({ loc: `${base}/blog/${r.slug}`, lastmod: r.updated_at?.split("T")[0], priority: "0.6" });
      }
    }
  }

  if (includeComparisons !== false) {
    const { data } = await supabase
      .from("comparisons")
      .select("slug, created_at")
      .eq("is_published", true)
      .limit(1000);
    if (data) {
      for (const r of data) {
        urls.push({ loc: `${base}/compare/${r.slug}`, lastmod: r.created_at?.split("T")[0], priority: "0.6" });
      }
    }
  }

  // Keyword landing pages (Apploye-style root + programmatic families)
  const PREFIX: Record<string, string> = {
    keyword: "",
    feature: "/features",
    use_case: "/use-cases",
    industry: "/industry",
    template: "/templates",
  };
  const { data: landings } = await supabase
    .from("keyword_landing_pages")
    .select("slug, page_type, updated_at, canonical_override")
    .eq("is_published", true)
    .limit(10000);
  if (landings) {
    for (const r of landings as any[]) {
      const loc = r.canonical_override || `${base}${PREFIX[r.page_type] || ""}/${r.slug}`;
      urls.push({ loc, lastmod: r.updated_at?.split("T")[0], priority: "0.8" });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}${u.priority ? `\n    <priority>${u.priority}</priority>` : ""}
  </url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
