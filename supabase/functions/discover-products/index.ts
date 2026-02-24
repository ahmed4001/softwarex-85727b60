import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// G2 category slug mapping — maps our category slugs to G2 category paths
const G2_CATEGORY_MAP: Record<string, string> = {
  "project-management": "project-management",
  "crm": "crm",
  "communication": "team-communication",
  "ecommerce": "e-commerce-platforms",
  "analytics": "analytics-platforms",
  "marketing": "marketing-automation",
  "help-desk": "help-desk",
  "hr": "hr-management-suites",
  "accounting": "accounting",
  "seo": "seo-tools",
  "social-media": "social-media-management",
  "cms": "content-management-system-cms",
  "development": "integrated-development-environment-ide",
  "security": "endpoint-protection-suites",
  "collaboration": "collaboration",
  "lms": "learning-management-system-lms",
  "time-tracking": "time-tracking",
  "video-conferencing": "video-conferencing",
  "email-marketing": "email-marketing",
  "live-chat": "live-chat",
  "no-code": "no-code-development-platforms",
  "ai-writing": "ai-writing-assistant",
  "ai-chatbots": "chatbots",
  "ai-code": "ai-code-generation",
  "ai-image-generators": "ai-image-generator",
  "cloud-hosting": "cloud-platform-as-a-service",
  "database-management": "database-management",
  "ci-cd": "continuous-integration",
  "bug-tracking": "bug-tracking",
  "api-management": "api-management",
  "erp": "erp-systems",
  "payroll": "payroll",
  "recruitment": "recruiting",
  "employee-engagement": "employee-engagement",
  "expense-management": "expense-management",
  "contract-management": "contract-management",
  "e-signature": "electronic-signature",
  "document-management": "document-management",
  "survey": "survey",
  "webinar": "webinar",
  "graphic-design": "graphic-design",
  "data-visualization": "data-visualization",
  "business-intelligence": "business-intelligence",
  "inventory-management": "inventory-management",
  "invoicing": "invoicing",
  "lead-generation": "lead-generation",
  "sales-engagement": "sales-engagement",
  "sales-intelligence": "sales-intelligence",
  "customer-success": "customer-success",
  "password-management": "password-manager",
  "antivirus": "antivirus",
  "vpn": "vpn",
  "backup": "backup",
  "supply-chain": "supply-chain-management",
  "tax": "tax-compliance",
  "text-to-speech": "text-to-speech",
  "proposal": "proposal",
};

interface DiscoveredProduct {
  name: string;
  slug: string;
  g2_url: string;
  g2_slug: string;
  website_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, category_slug, g2_category, page, import_products } = await req.json();

    // Action: discover — crawl a G2 category page and extract products
    if (action === "discover") {
      const g2Cat = g2_category || G2_CATEGORY_MAP[category_slug];
      if (!g2Cat) {
        return new Response(
          JSON.stringify({ success: false, error: `No G2 mapping for category '${category_slug}'` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pageNum = page || 1;
      const g2Url = `https://www.g2.com/categories/${g2Cat}?page=${pageNum}`;
      console.log(`Discovering products from: ${g2Url}`);

      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: g2Url,
          formats: [
            {
              type: "json",
              schema: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Product name" },
                        g2_slug: { type: "string", description: "The G2 product slug from the URL (e.g., 'asana' from /products/asana/reviews)" },
                        rating: { type: "number", description: "Average rating on G2" },
                        review_count: { type: "number", description: "Number of reviews" },
                        description: { type: "string", description: "Short product description" },
                      },
                    },
                    description: "List of all software products listed on this G2 category page",
                  },
                  total_products: { type: "number", description: "Total number of products in this category on G2" },
                  has_next_page: { type: "boolean", description: "Whether there are more pages of results" },
                },
              },
            },
          ],
          onlyMainContent: true,
          waitFor: 5000,
        }),
      });

      const scrapeData = await scrapeRes.json();
      const extracted = scrapeData?.data?.json || scrapeData?.json || {};
      const products: DiscoveredProduct[] = (extracted.products || []).map((p: any) => ({
        name: p.name,
        slug: slugify(p.name),
        g2_slug: p.g2_slug || slugify(p.name),
        g2_url: `https://www.g2.com/products/${p.g2_slug || slugify(p.name)}/reviews`,
        rating: p.rating,
        review_count: p.review_count,
        description: p.description,
      }));

      // Check which products already exist
      const slugs = products.map((p: DiscoveredProduct) => p.slug);
      const { data: existing } = await supabase
        .from("products")
        .select("slug")
        .in("slug", slugs);
      const existingSlugs = new Set((existing || []).map((e: any) => e.slug));

      const newProducts = products.map((p: any) => ({
        ...p,
        already_exists: existingSlugs.has(p.slug),
      }));

      return new Response(
        JSON.stringify({
          success: true,
          category_slug,
          g2_category: g2Cat,
          page: pageNum,
          products: newProducts,
          total_products: extracted.total_products || products.length,
          has_next_page: extracted.has_next_page ?? products.length >= 20,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: import — take discovered products and scrape + insert them
    if (action === "import") {
      if (!import_products || !Array.isArray(import_products) || import_products.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "import_products array required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up category ID
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", category_slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!category) {
        return new Response(
          JSON.stringify({ success: false, error: `Category '${category_slug}' not found` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: any[] = [];

      for (const product of import_products) {
        try {
          // Check if already exists
          const { data: existing } = await supabase
            .from("products")
            .select("id")
            .eq("slug", product.slug)
            .maybeSingle();

          if (existing) {
            results.push({ name: product.name, status: "skipped", reason: "already exists" });
            continue;
          }

          // Try to find website URL by scraping the G2 product page
          let websiteUrl = product.website_url || null;
          let g2Data: any = {};

          try {
            const g2Res = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: product.g2_url,
                formats: [
                  {
                    type: "json",
                    schema: {
                      type: "object",
                      properties: {
                        website_url: { type: "string", description: "The official website URL of the product" },
                        avg_rating: { type: "number", description: "Overall average rating out of 5" },
                        total_reviews: { type: "number", description: "Total number of reviews" },
                        description: { type: "string", description: "Product description (2-3 sentences)" },
                        tagline: { type: "string", description: "Product tagline or one-liner" },
                        pricing_model: { type: "string", enum: ["free", "freemium", "paid", "subscription", "one-time"] },
                        pros_summary: { type: "string", description: "Summary of what users like most" },
                        cons_summary: { type: "string", description: "Summary of common complaints" },
                        features: { type: "array", items: { type: "string" }, description: "Key features (up to 8)" },
                      },
                    },
                  },
                ],
                onlyMainContent: true,
                waitFor: 3000,
              }),
            });
            const g2Result = await g2Res.json();
            g2Data = g2Result?.data?.json || g2Result?.json || {};
            if (!websiteUrl && g2Data.website_url) {
              websiteUrl = g2Data.website_url;
            }
          } catch (e) {
            console.error(`Failed to scrape G2 for ${product.name}:`, e);
          }

          // Insert the product
          const productRecord = {
            name: product.name,
            slug: product.slug,
            website_url: websiteUrl,
            category_id: category.id,
            tagline: g2Data.tagline || product.description || `${product.name} software solution`,
            description: g2Data.description || product.description || `${product.name} is a software product.`,
            pricing_model: g2Data.pricing_model || "freemium",
            features: g2Data.features || [],
            avg_rating: g2Data.avg_rating ? Math.min(5, Math.max(0, Number(g2Data.avg_rating))) : product.rating || null,
            total_reviews: g2Data.total_reviews ? Math.max(0, Number(g2Data.total_reviews)) : product.review_count || null,
            pros_summary: g2Data.pros_summary || null,
            cons_summary: g2Data.cons_summary || null,
            is_active: true,
            published_at: new Date().toISOString(),
          };

          const { error: insertError } = await supabase.from("products").insert(productRecord);

          if (insertError) {
            results.push({ name: product.name, status: "error", reason: insertError.message });
          } else {
            results.push({ name: product.name, status: "success" });
          }
        } catch (e) {
          results.push({
            name: product.name,
            status: "error",
            reason: e instanceof Error ? e.message : "Unknown error",
          });
        }

        // Rate limit delay
        await new Promise((r) => setTimeout(r, 1500));
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: list_g2_categories — return the mapping for the UI
    if (action === "list_g2_categories") {
      return new Response(
        JSON.stringify({ success: true, categories: G2_CATEGORY_MAP }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action. Use 'discover', 'import', or 'list_g2_categories'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in discover-products:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
