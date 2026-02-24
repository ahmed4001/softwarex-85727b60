import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function firecrawlHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function scrapeUrl(apiKey: string, url: string, formats: any[], waitFor = 3000) {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: firecrawlHeaders(apiKey),
    body: JSON.stringify({ url, formats, onlyMainContent: true, waitFor }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Firecrawl error: ${JSON.stringify(data)}`);
  return data?.data || data;
}

/** Extract image URLs that look like product screenshots from markdown + links */
function extractScreenshots(markdown: string, links: string[]): string[] {
  const images = new Set<string>();

  // Extract from markdown images: ![alt](url)
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(markdown)) !== null) {
    const url = m[1];
    if (url && isProductImage(url)) images.add(url);
  }

  // Extract from links that are images
  for (const link of links) {
    if (/\.(png|jpg|jpeg|webp|gif|avif)/i.test(link) && isProductImage(link)) {
      images.add(link);
    }
  }

  return Array.from(images).slice(0, 8);
}

function isProductImage(url: string): boolean {
  // Filter out tiny icons, avatars, emojis, tracking pixels
  const ignore = [
    "avatar", "emoji", "icon", "favicon", "badge", "logo.clearbit",
    "1x1", "pixel", "tracking", "analytics", "google", "facebook",
    "twitter", "gravatar", "wp-content/plugins",
  ];
  const lower = url.toLowerCase();
  return !ignore.some((i) => lower.includes(i));
}

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

    const { action, topic, import_products, enrich } = await req.json();

    // ─── DISCOVER ────────────────────────────────────────────────
    if (action === "discover") {
      const phUrl = topic
        ? `https://www.producthunt.com/topics/${topic}`
        : `https://www.producthunt.com/leaderboard/daily/${new Date().toISOString().split("T")[0]}`;

      console.log("Scraping Product Hunt:", phUrl);

      const scrapeData = await scrapeUrl(FIRECRAWL_API_KEY, phUrl, ["markdown", "links"]);
      const markdown = scrapeData?.markdown || "";
      const links = scrapeData?.links || [];

      const phProductLinks = links.filter((link: string) =>
        link.match(/producthunt\.com\/products\/[a-z0-9-]+$/) ||
        link.match(/producthunt\.com\/posts\/[a-z0-9-]+$/)
      );

      const products: Array<{
        name: string;
        slug: string;
        ph_url: string;
        tagline?: string;
        already_exists?: boolean;
      }> = [];

      const lines = markdown.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const linkMatch = lines[i].match(
          /\[([^\]]+)\]\((https?:\/\/www\.producthunt\.com\/(?:products|posts)\/([a-z0-9-]+))[^)]*\)/
        );
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
              tagline:
                tagline.length > 5 && !tagline.startsWith("[") && !tagline.startsWith("#")
                  ? tagline
                  : undefined,
            });
          }
        }
      }

      for (const link of phProductLinks) {
        const match = link.match(/\/(?:products|posts)\/([a-z0-9-]+)$/);
        if (match && !products.find((p) => p.slug === match[1])) {
          const slug = match[1];
          const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
          products.push({ name, slug, ph_url: link });
        }
      }

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

    // ─── IMPORT (with optional deep enrichment) ──────────────────
    if (action === "import") {
      const shouldEnrich = enrich !== false; // default true
      const results: Array<{ name: string; status: string; reason?: string }> = [];

      for (const product of import_products || []) {
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

          let enrichedData: any = {};
          let screenshots: string[] = [];
          let websiteUrl = product.website_url || null;
          let logoUrl: string | null = null;

          // ── Step 1: Scrape Product Hunt product page ──
          if (shouldEnrich && product.ph_url) {
            try {
              console.log(`[enrich] Scraping PH page: ${product.ph_url}`);
              const phData = await scrapeUrl(
                FIRECRAWL_API_KEY,
                product.ph_url,
                ["markdown", "links", "screenshot"]
              );

              const phMd = phData?.markdown || "";
              const phLinks = phData?.links || [];

              // Extract screenshots from PH page
              screenshots = extractScreenshots(phMd, phLinks);

              // Find website URL from PH links
              if (!websiteUrl) {
                websiteUrl =
                  phLinks.find(
                    (l: string) =>
                      !l.includes("producthunt.com") &&
                      !l.includes("twitter.com") &&
                      !l.includes("x.com") &&
                      !l.includes("facebook.com") &&
                      !l.includes("linkedin.com") &&
                      !l.includes("youtube.com") &&
                      !l.includes("github.com") &&
                      l.startsWith("http")
                  ) || null;
              }

              // Extract description from PH page
              const paragraphs = phMd
                .split("\n\n")
                .filter(
                  (p: string) =>
                    p.length > 50 &&
                    !p.startsWith("#") &&
                    !p.startsWith("[") &&
                    !p.startsWith("!")
                );
              if (paragraphs[0]) {
                enrichedData.ph_description = paragraphs[0].trim();
              }
            } catch (e) {
              console.error(`[enrich] PH scrape failed for ${product.name}:`, e);
            }

            // Small delay between scrapes
            await new Promise((r) => setTimeout(r, 800));
          }

          // ── Step 2: Scrape the product's own website ──
          if (shouldEnrich && websiteUrl) {
            try {
              console.log(`[enrich] Scraping website: ${websiteUrl}`);
              const siteData = await scrapeUrl(FIRECRAWL_API_KEY, websiteUrl, [
                {
                  type: "json",
                  schema: {
                    type: "object",
                    properties: {
                      tagline: { type: "string", description: "Product tagline or hero text" },
                      description: {
                        type: "string",
                        description: "A 2-3 sentence description of the product",
                      },
                      pricing_model: {
                        type: "string",
                        enum: ["free", "freemium", "paid", "subscription", "one-time"],
                      },
                      starting_price: {
                        type: "number",
                        description: "Starting price per month in USD, 0 if free",
                      },
                      features: {
                        type: "array",
                        items: { type: "string" },
                        description: "Top 5-8 key features",
                      },
                      founded_year: { type: "number" },
                      headquarters: { type: "string" },
                    },
                  },
                },
                "screenshot",
                "links",
              ]);

              const jsonData = siteData?.json || {};
              enrichedData = { ...enrichedData, ...jsonData };

              // Get more screenshots from website
              const siteMd = siteData?.markdown || "";
              const siteLinks = siteData?.links || [];
              const siteScreenshots = extractScreenshots(siteMd, siteLinks);
              screenshots = [...screenshots, ...siteScreenshots].slice(0, 8);

              // Get the screenshot of the homepage
              if (siteData?.screenshot) {
                // The screenshot is base64, we can't store it directly. Skip for now.
              }
            } catch (e) {
              console.error(`[enrich] Website scrape failed for ${product.name}:`, e);
            }

            await new Promise((r) => setTimeout(r, 800));
          }

          // ── Step 3: Get logo ──
          if (websiteUrl) {
            try {
              const domain = new URL(websiteUrl).hostname;
              logoUrl = `https://logo.clearbit.com/${domain}`;
            } catch {}
          }

          // ── Step 4: Insert product ──
          const productRecord = {
            name: product.name,
            slug: product.slug,
            tagline: enrichedData.tagline || product.tagline || null,
            description:
              enrichedData.description ||
              enrichedData.ph_description ||
              `${product.name} - discovered via Product Hunt`,
            website_url: websiteUrl,
            logo_url: logoUrl,
            screenshots: screenshots.length > 0 ? screenshots : [],
            features: enrichedData.features || [],
            pricing_model: enrichedData.pricing_model || "freemium",
            starting_price: enrichedData.starting_price || null,
            founded_year: enrichedData.founded_year || null,
            headquarters: enrichedData.headquarters || null,
            is_active: true,
            is_verified: false,
            published_at: new Date().toISOString(),
            seo_title: `${product.name} - Reviews, Pricing & Features`,
            seo_description:
              enrichedData.tagline ||
              product.tagline ||
              `Discover ${product.name} reviews, pricing, and features.`,
          };

          const { error: insertErr } = await supabase.from("products").insert(productRecord);

          if (insertErr) {
            results.push({ name: product.name, status: "error", reason: insertErr.message });
          } else {
            results.push({
              name: product.name,
              status: "success",
              reason: shouldEnrich
                ? `Enriched: ${screenshots.length} photos, ${(enrichedData.features || []).length} features`
                : undefined,
            });
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
