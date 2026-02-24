import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductInput {
  name: string;
  slug: string;
  website_url: string;
  g2_url: string;
  category_slug: string;
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

    const { products, action } = await req.json();

    // Handle comparison creation
    if (action === "create_comparisons") {
      return await handleComparisons(supabase, products);
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Products array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all categories for mapping
    const { data: categories } = await supabase
      .from("categories")
      .select("id, slug")
      .eq("is_active", true);

    const categoryMap = new Map(
      (categories || []).map((c: any) => [c.slug, c.id])
    );

    const results: any[] = [];

    for (const product of products as ProductInput[]) {
      try {
        // Check if product already exists
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("slug", product.slug)
          .maybeSingle();

        if (existing) {
          results.push({ name: product.name, status: "skipped", reason: "already exists" });
          continue;
        }

        const categoryId = categoryMap.get(product.category_slug);
        if (!categoryId) {
          results.push({ name: product.name, status: "skipped", reason: `category '${product.category_slug}' not found` });
          continue;
        }

        // Scrape the product website
        let websiteData: any = {};
        try {
          const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: product.website_url,
              formats: [
                {
                  type: "json",
                  schema: {
                    type: "object",
                    properties: {
                      tagline: { type: "string", description: "The product tagline or hero text" },
                      description: { type: "string", description: "A 2-3 sentence description of what the product does" },
                      pricing_model: { type: "string", enum: ["free", "freemium", "paid", "subscription", "one-time"], description: "Pricing model" },
                      starting_price: { type: "number", description: "Starting price per month in USD, 0 if free" },
                      features: { type: "array", items: { type: "string" }, description: "List of top 5-8 key features" },
                      founded_year: { type: "number", description: "Year the company was founded" },
                      headquarters: { type: "string", description: "Company headquarters location" },
                      logo_url: { type: "string", description: "URL of the product logo image" },
                    },
                  },
                },
              ],
              onlyMainContent: true,
              waitFor: 3000,
            }),
          });
          const scrapeData = await scrapeRes.json();
          websiteData = scrapeData?.data?.json || scrapeData?.json || {};
        } catch (e) {
          console.error(`Failed to scrape website for ${product.name}:`, e);
        }

        // Scrape G2 for ratings
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
                      avg_rating: { type: "number", description: "Overall average rating out of 5" },
                      total_reviews: { type: "number", description: "Total number of reviews" },
                      pros_summary: { type: "string", description: "Summary of what users like most (2-3 sentences)" },
                      cons_summary: { type: "string", description: "Summary of common complaints (2-3 sentences)" },
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
        } catch (e) {
          console.error(`Failed to scrape G2 for ${product.name}:`, e);
        }

        // Build the product record
        const productRecord = {
          name: product.name,
          slug: product.slug,
          website_url: product.website_url,
          category_id: categoryId,
          tagline: websiteData.tagline || `${product.name} - Modern software solution`,
          description: websiteData.description || `${product.name} is a leading software product in its category.`,
          pricing_model: websiteData.pricing_model || "freemium",
          starting_price: websiteData.starting_price || null,
          features: websiteData.features || [],
          founded_year: websiteData.founded_year || null,
          headquarters: websiteData.headquarters || null,
          logo_url: websiteData.logo_url || null,
          avg_rating: g2Data.avg_rating ? Math.min(5, Math.max(0, Number(g2Data.avg_rating))) : null,
          total_reviews: g2Data.total_reviews ? Math.max(0, Number(g2Data.total_reviews)) : null,
          pros_summary: g2Data.pros_summary || null,
          cons_summary: g2Data.cons_summary || null,
          is_active: true,
          published_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("products")
          .insert(productRecord);

        if (insertError) {
          results.push({ name: product.name, status: "error", reason: insertError.message });
        } else {
          results.push({ name: product.name, status: "success" });
        }
      } catch (productError) {
        console.error(`Error processing ${product.name}:`, productError);
        results.push({
          name: product.name,
          status: "error",
          reason: productError instanceof Error ? productError.message : "Unknown error",
        });
      }

      // Small delay between products to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in scrape-products:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleComparisons(supabase: any, comparisons: any[]) {
  const results: any[] = [];

  if (!comparisons || !Array.isArray(comparisons)) {
    return new Response(
      JSON.stringify({ success: false, error: "Comparisons array required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  for (const comp of comparisons) {
    try {
      // Look up product IDs by slug
      const { data: products } = await supabase
        .from("products")
        .select("id, slug")
        .in("slug", comp.products);

      if (!products || products.length < 2) {
        results.push({ title: comp.title, status: "skipped", reason: "Products not found" });
        continue;
      }

      const productIds = products.map((p: any) => p.id);

      // Check if comparison already exists
      const { data: existing } = await supabase
        .from("comparisons")
        .select("id")
        .contains("product_ids", productIds)
        .maybeSingle();

      if (existing) {
        results.push({ title: comp.title, status: "skipped", reason: "Already exists" });
        continue;
      }

      const { error } = await supabase.from("comparisons").insert({
        title: comp.title,
        product_ids: productIds,
        is_published: true,
      });

      if (error) {
        results.push({ title: comp.title, status: "error", reason: error.message });
      } else {
        results.push({ title: comp.title, status: "success" });
      }
    } catch (e) {
      results.push({
        title: comp.title,
        status: "error",
        reason: e instanceof Error ? e.message : "Unknown",
      });
    }
  }

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
