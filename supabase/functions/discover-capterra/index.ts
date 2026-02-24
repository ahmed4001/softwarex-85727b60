import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Capterra category slug mapping — maps our category slugs to Capterra URL paths
const CAPTERRA_CATEGORY_MAP: Record<string, string> = {
  "project-management": "project-management-software",
  "crm": "customer-relationship-management-software",
  "communication": "business-instant-messaging-software",
  "ecommerce": "e-commerce-software",
  "analytics": "business-analytics-software",
  "marketing": "marketing-automation-software",
  "help-desk": "help-desk-software",
  "hr": "human-resource-software",
  "accounting": "accounting-software",
  "seo": "seo-software",
  "social-media": "social-media-management-software",
  "cms": "content-management-software",
  "development": "integrated-development-environment-software",
  "security": "endpoint-protection-software",
  "collaboration": "collaboration-software",
  "lms": "learning-management-system-software",
  "time-tracking": "time-tracking-software",
  "video-conferencing": "video-conferencing-software",
  "email-marketing": "email-marketing-software",
  "live-chat": "live-chat-software",
  "no-code": "no-code-platform-software",
  "ai-writing": "ai-writing-software",
  "ai-chatbots": "chatbot-software",
  "ai-code": "ai-code-generation-software",
  "ai-image-generators": "ai-art-generator-software",
  "cloud-hosting": "cloud-management-software",
  "database-management": "database-management-software",
  "ci-cd": "continuous-integration-software",
  "bug-tracking": "bug-tracking-software",
  "api-management": "api-management-software",
  "erp": "erp-software",
  "payroll": "payroll-software",
  "recruitment": "recruiting-software",
  "employee-engagement": "employee-engagement-software",
  "expense-management": "expense-report-software",
  "contract-management": "contract-management-software",
  "e-signature": "electronic-signature-software",
  "document-management": "document-management-software",
  "survey": "survey-software",
  "webinar": "webinar-software",
  "graphic-design": "graphic-design-software",
  "data-visualization": "data-visualization-software",
  "business-intelligence": "business-intelligence-software",
  "inventory-management": "inventory-management-software",
  "invoicing": "invoicing-software",
  "lead-generation": "lead-generation-software",
  "sales-engagement": "sales-enablement-software",
  "sales-intelligence": "sales-intelligence-software",
  "customer-success": "customer-success-software",
  "password-management": "password-manager-software",
  "antivirus": "antivirus-software",
  "vpn": "vpn-software",
  "backup": "backup-software",
  "supply-chain": "supply-chain-management-software",
  "tax": "tax-software",
  "text-to-speech": "text-to-speech-software",
  "proposal": "proposal-software",
};

interface DiscoveredProduct {
  name: string;
  slug: string;
  capterra_url: string;
  capterra_slug: string;
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

    const { action, category_slug, page, import_products, quick_import } = await req.json();

    // Action: discover — scrape a Capterra category page
    if (action === "discover") {
      const capterraCat = CAPTERRA_CATEGORY_MAP[category_slug];
      if (!capterraCat) {
        return new Response(
          JSON.stringify({ success: false, error: `No Capterra mapping for category '${category_slug}'` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pageNum = page || 1;
      const capterraUrl = pageNum === 1
        ? `https://www.capterra.com/${capterraCat}/`
        : `https://www.capterra.com/${capterraCat}/p/${pageNum}/`;
      console.log(`Discovering Capterra products from: ${capterraUrl}`);

      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: capterraUrl,
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
                        capterra_slug: { type: "string", description: "The Capterra product slug from the URL path" },
                        rating: { type: "number", description: "Average rating on Capterra (out of 5)" },
                        review_count: { type: "number", description: "Number of reviews on Capterra" },
                        description: { type: "string", description: "Short product description" },
                      },
                    },
                    description: "List of all software products listed on this Capterra category page",
                  },
                  total_products: { type: "number", description: "Total number of products in this category" },
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
        capterra_slug: p.capterra_slug || slugify(p.name),
        capterra_url: `https://www.capterra.com/p/${p.capterra_slug || slugify(p.name)}/`,
        rating: p.rating,
        review_count: p.review_count,
        description: p.description,
      }));

      // Check which already exist
      const slugs = products.map((p: DiscoveredProduct) => p.slug);
      const { data: existing } = await supabase
        .from("products")
        .select("slug")
        .in("slug", slugs);
      const existingSlugs = new Set((existing || []).map((e: any) => e.slug));

      const enriched = products.map((p: any) => ({
        ...p,
        already_exists: existingSlugs.has(p.slug),
      }));

      return new Response(
        JSON.stringify({
          success: true,
          category_slug,
          page: pageNum,
          products: enriched,
          total_products: extracted.total_products || products.length,
          has_next_page: extracted.has_next_page ?? products.length >= 20,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: import — insert products (quick mode skips per-product scraping)
    if (action === "import") {
      
      if (!import_products || !Array.isArray(import_products) || import_products.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "import_products array required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
          const { data: existing } = await supabase
            .from("products")
            .select("id")
            .eq("slug", product.slug)
            .maybeSingle();

          if (existing) {
            results.push({ name: product.name, status: "skipped", reason: "already exists" });
            continue;
          }

          let capterraData: any = {};
          
          // Only scrape individual product pages in non-quick mode
          if (!quick_import && FIRECRAWL_API_KEY) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout per product
              
              const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                signal: controller.signal,
                body: JSON.stringify({
                  url: product.capterra_url,
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
                          starting_price: { type: "number", description: "Starting price per month in USD, 0 if free" },
                          features: { type: "array", items: { type: "string" }, description: "Key features (up to 8)" },
                          logo_url: { type: "string", description: "URL of the product logo" },
                        },
                      },
                    },
                  ],
                  onlyMainContent: true,
                  waitFor: 3000,
                }),
              });
              clearTimeout(timeout);
              const result = await res.json();
              capterraData = result?.data?.json || result?.json || {};
            } catch (e) {
              console.warn(`Scrape timeout/error for ${product.name}, using discovered data`);
            }
          }

          const productRecord = {
            name: product.name,
            slug: product.slug,
            website_url: capterraData.website_url || null,
            category_id: category.id,
            tagline: capterraData.tagline || product.description || `${product.name} software solution`,
            description: capterraData.description || product.description || `${product.name} is a software product.`,
            pricing_model: capterraData.pricing_model || "freemium",
            starting_price: capterraData.starting_price || null,
            features: capterraData.features || [],
            logo_url: capterraData.logo_url || null,
            avg_rating: capterraData.avg_rating ? Math.min(5, Math.max(0, Number(capterraData.avg_rating))) : product.rating || null,
            total_reviews: capterraData.total_reviews ? Math.max(0, Number(capterraData.total_reviews)) : product.review_count || null,
            pros_summary: capterraData.pros_summary || null,
            cons_summary: capterraData.cons_summary || null,
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

        // Only delay in non-quick mode
        if (!quick_import) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action. Use 'discover' or 'import'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in discover-capterra:", error);
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
