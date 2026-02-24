import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, topic, page, import_products } = await req.json();

    if (action === "discover") {
      // Scrape Product Hunt topic/category page
      const phUrl = topic
        ? `https://www.producthunt.com/topics/${topic}`
        : `https://www.producthunt.com/leaderboard/daily/${new Date().toISOString().split("T")[0]}`;

      console.log("Scraping Product Hunt:", phUrl);

      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: phUrl,
          formats: ["markdown", "links"],
          onlyMainContent: true,
          waitFor: 3000,
        }),
      });

      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) {
        throw new Error(`Firecrawl error: ${JSON.stringify(scrapeData)}`);
      }

      const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
      const links = scrapeData?.data?.links || scrapeData?.links || [];

      // Extract product links from Product Hunt
      const phProductLinks = links.filter((link: string) =>
        link.match(/producthunt\.com\/products\/[a-z0-9-]+$/) ||
        link.match(/producthunt\.com\/posts\/[a-z0-9-]+$/)
      );

      // Parse product names from markdown
      const products: Array<{
        name: string;
        slug: string;
        ph_url: string;
        tagline?: string;
        already_exists?: boolean;
      }> = [];

      // Extract from markdown lines – Product Hunt uses format: "### [Name](url)\nTagline"
      const lines = markdown.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const linkMatch = lines[i].match(/\[([^\]]+)\]\((https?:\/\/www\.producthunt\.com\/(?:products|posts)\/([a-z0-9-]+))[^)]*\)/);
        if (linkMatch) {
          const name = linkMatch[1].trim();
          const url = linkMatch[2];
          const slug = linkMatch[3];
          const tagline = lines[i + 1]?.trim() || "";

          if (name && slug && !products.find((p) => p.slug === slug)) {
            products.push({
              name,
              slug,
              ph_url: url,
              tagline: tagline.length > 5 && !tagline.startsWith("[") && !tagline.startsWith("#") ? tagline : undefined,
            });
          }
        }
      }

      // Also extract from standalone links
      for (const link of phProductLinks) {
        const match = link.match(/\/(?:products|posts)\/([a-z0-9-]+)$/);
        if (match && !products.find((p) => p.slug === match[1])) {
          const slug = match[1];
          const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
          products.push({ name, slug, ph_url: link });
        }
      }

      // Check which already exist in DB
      if (products.length > 0) {
        const slugs = products.map((p) => p.slug);
        const { data: existing } = await supabase
          .from("products")
          .select("slug")
          .in("slug", slugs);
        const existingSlugs = new Set((existing || []).map((e: any) => e.slug));
        products.forEach((p) => {
          p.already_exists = existingSlugs.has(p.slug);
        });
      }

      return new Response(
        JSON.stringify({ products, total: products.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "scrape-detail") {
      // Scrape individual product page for full details
      const { ph_url, slug } = import_products[0] || {};
      if (!ph_url) throw new Error("No product URL provided");

      console.log("Scraping product detail:", ph_url);

      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: ph_url,
          formats: ["markdown", "links"],
          onlyMainContent: true,
          waitFor: 3000,
        }),
      });

      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) {
        throw new Error(`Firecrawl error: ${JSON.stringify(scrapeData)}`);
      }

      const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
      const links = scrapeData?.data?.links || scrapeData?.links || [];

      // Find website URL from links (external, non-PH links)
      const websiteUrl = links.find((l: string) =>
        !l.includes("producthunt.com") &&
        !l.includes("twitter.com") &&
        !l.includes("facebook.com") &&
        !l.includes("linkedin.com") &&
        l.startsWith("http")
      ) || null;

      // Extract description from markdown (first substantial paragraph)
      const paragraphs = markdown.split("\n\n").filter((p: string) =>
        p.length > 50 && !p.startsWith("#") && !p.startsWith("[") && !p.startsWith("!")
      );
      const description = paragraphs[0]?.trim() || "";

      return new Response(
        JSON.stringify({ slug, website_url: websiteUrl, description, markdown_preview: markdown.slice(0, 2000) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "import") {
      // Import products to database using AI enrichment
      const results: Array<{ name: string; status: string; reason?: string }> = [];

      for (const product of (import_products || [])) {
        try {
          // Check if already exists
          const { data: existing } = await supabase
            .from("products")
            .select("id")
            .eq("slug", product.slug)
            .maybeSingle();

          if (existing) {
            results.push({ name: product.name, status: "skipped", reason: "Already exists" });
            continue;
          }

          // Try to get logo from Clearbit
          let logoUrl = null;
          if (product.website_url) {
            try {
              const domain = new URL(product.website_url).hostname;
              logoUrl = `https://logo.clearbit.com/${domain}`;
            } catch {}
          }

          // Insert product
          const { error: insertErr } = await supabase.from("products").insert({
            name: product.name,
            slug: product.slug,
            tagline: product.tagline || null,
            description: product.description || `${product.name} - discovered via Product Hunt`,
            website_url: product.website_url || null,
            logo_url: logoUrl,
            is_active: true,
            is_verified: false,
            pricing_model: "freemium",
            seo_title: `${product.name} - Reviews, Pricing & Features`,
            seo_description: product.tagline || `Discover ${product.name} reviews, pricing, and features.`,
          });

          if (insertErr) {
            results.push({ name: product.name, status: "error", reason: insertErr.message });
          } else {
            results.push({ name: product.name, status: "success" });
          }
        } catch (e: any) {
          results.push({ name: product.name, status: "error", reason: e.message });
        }
      }

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("ProductHunt discovery error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
