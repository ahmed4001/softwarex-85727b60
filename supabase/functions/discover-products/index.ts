import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  "chrome-extensions": "chrome-extensions",
  "apple-apps": "mac-software",
  "google-play-apps": "android-apps",
  "browser-extensions": "browser-extension",
  "mobile-apps": "mobile-app-development",
  "affiliate-marketing": "affiliate-marketing",
  "app-development": "mobile-development",
  "appointment-scheduling": "appointment-scheduling",
  "asset-management": "digital-asset-management",
  "audio-editing": "audio-editing",
  "billing-invoicing": "billing",
  "board-management": "board-management",
  "business-phone": "business-voip",
  "cad-software": "cad",
  "church-management": "church-management",
  "clinical-trials": "clinical-trial-management",
  "cloud-security": "cloud-security",
  "commission-management": "commission",
  "compliance-management": "compliance",
  "construction-management": "construction-management",
  "content-creation": "content-creation",
  "conversational-ai": "conversational-ai",
  "cdp": "customer-data-platform",
  "data-integration": "data-integration",
  "data-privacy": "data-privacy",
  "digital-adoption": "digital-adoption-platform",
  "digital-signage": "digital-signage",
  "dns-management": "dns-management",
  "email-deliverability": "email-deliverability",
  "event-management": "event-management",
  "field-service": "field-service-management",
  "file-sharing": "file-sharing",
  "fleet-management": "fleet-management",
  "form-builder": "form-builder",
  "fraud-detection": "fraud-detection",
  "fundraising": "fundraising",
  "gantt-chart": "gantt-chart",
  "gis-software": "gis",
  "gym-management": "gym-management",
  "hipaa-compliance": "hipaa-compliance",
  "home-design": "home-design",
  "hotel-management": "hotel-management",
  "identity-management": "identity-management",
  "influencer-marketing": "influencer-marketing",
  "insurance-software": "insurance",
  "iot-platforms": "iot",
  "itsm": "it-service-management-itsm",
  "knowledge-base": "knowledge-management",
  "landing-page-builder": "landing-page",
  "legal-practice": "legal-case-management",
  "localization": "localization",
  "logistics": "logistics",
  "low-code": "low-code-development",
  "marketplace-software": "marketplace",
  "mental-health": "mental-health",
  "monitoring": "application-performance-management-apm",
  "note-taking": "note-taking",
  "ocr-software": "ocr",
  "okr-software": "okr",
  "photo-editing": "photo-editing",
  "podcast-hosting": "podcast-hosting",
  "pos-systems": "point-of-sale",
  "product-analytics": "product-analytics",
  "rpa": "robotic-process-automation-rpa",
  "sales-enablement": "sales-enablement",
  "subscription-management": "subscription-management",
};

// Auto-generate labels from slugs
function categoryLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface DiscoveredProduct {
  name: string;
  slug: string;
  g2_url: string;
  g2_slug: string;
  rating?: number;
  review_count?: number;
  description?: string;
  website_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, category_slug, g2_category, page, import_products, quick_import } = await req.json();

    // ========== ACTION: DISCOVER ==========
    if (action === "discover") {
      const g2Cat = g2_category || G2_CATEGORY_MAP[category_slug];
      const catLabel = categoryLabel(category_slug);

      if (!g2Cat) {
        return new Response(
          JSON.stringify({ success: false, error: `No G2 mapping for category '${category_slug}'` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pageNum = page || 1;

      // Strategy: Use Firecrawl search to find G2 products, then use AI to parse
      let products: DiscoveredProduct[] = [];

      if (FIRECRAWL_API_KEY) {
        try {
          // Use Firecrawl search to find products on G2 for this category
          const searchQuery = `site:g2.com/products best ${catLabel} software`;
          console.log(`Searching Firecrawl for: ${searchQuery}`);

          const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: searchQuery,
              limit: 20,
              scrapeOptions: { formats: ["markdown"] },
            }),
          });

          const searchData = await searchRes.json();
          console.log(`Firecrawl search returned ${searchData?.data?.length || 0} results`);

          if (searchData?.data && Array.isArray(searchData.data)) {
            for (const result of searchData.data) {
              const url = result.url || "";
              // Extract product slugs from G2 URLs like g2.com/products/slack/reviews
              const g2Match = url.match(/g2\.com\/products\/([^\/]+)/);
              if (g2Match) {
                const g2Slug = g2Match[1];
                // Skip "alternatives" and "competitors" comparison pages
                if (url.includes("/competitors") || url.includes("/compare")) continue;
                
                // Clean the product name from G2 title patterns
                let name = result.title || g2Slug;
                name = name
                  .replace(/^Top \d+\s+/i, "")
                  .replace(/\s+Alternatives?\s*(&|and)?\s*Competitors?\s*(in\s+\d+)?\s*-?\s*G2\s*$/i, "")
                  .replace(/\s+Competitors?\s*\d*\s*-?\s*G2\s*$/i, "")
                  .replace(/\s+Reviews?\s*\d*\s*-?\s*G2\s*$/i, "")
                  .replace(/\s*\|\s*G2\s*$/i, "")
                  .replace(/\s*-\s*G2\s*$/i, "")
                  .trim();
                
                if (!name || name.length < 2) name = g2Slug;
                
                // Skip if we already have this product in the list
                if (products.some(p => p.g2_slug === g2Slug)) continue;
                
                products.push({
                  name,
                  slug: slugify(name),
                  g2_slug: g2Slug,
                  g2_url: `https://www.g2.com/products/${g2Slug}/reviews`,
                  description: result.description || "",
                });
              }
            }
          }
        } catch (e) {
          console.error("Firecrawl search error:", e);
        }
      }

      // Fallback/supplement: Use Lovable AI to generate known product names for this category
      if (products.length < 10 && LOVABLE_API_KEY) {
        try {
          const offset = (pageNum - 1) * 20;
          console.log(`Using AI to discover ${catLabel} products (offset ${offset})`);

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "You are a software industry expert. Return ONLY valid JSON, no markdown formatting.",
                },
                {
                  role: "user",
                  content: `List 20 real, well-known ${catLabel} software products (skip the first ${offset}). For each, provide:
- name: exact product name
- g2_slug: the G2.com URL slug (e.g., "slack" for g2.com/products/slack)
- rating: approximate G2 rating (1-5, one decimal)
- review_count: approximate number of G2 reviews
- description: one-sentence description
- website_url: official website URL

Return as JSON: { "products": [...] }`,
                },
              ],
              temperature: 0.3,
            }),
          });

          const aiData = await aiRes.json();
          const content = aiData?.choices?.[0]?.message?.content || "";
          
          // Parse JSON from AI response (handle markdown code blocks)
          let parsed: any = {};
          try {
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
            parsed = JSON.parse(jsonMatch[1]?.trim() || content.trim());
          } catch (e) {
            console.warn("Failed to parse AI response:", content.substring(0, 200));
          }

          if (parsed.products && Array.isArray(parsed.products)) {
            for (const p of parsed.products) {
              if (!p.name) continue;
              const slug = slugify(p.name);
              if (products.some(ep => ep.slug === slug)) continue;
              
              products.push({
                name: p.name,
                slug,
                g2_slug: p.g2_slug || slug,
                g2_url: `https://www.g2.com/products/${p.g2_slug || slug}/reviews`,
                rating: p.rating,
                review_count: p.review_count,
                description: p.description,
                website_url: p.website_url,
              });
            }
          }
        } catch (e) {
          console.error("AI discovery error:", e);
        }
      }

      // Check which products already exist in DB
      if (products.length > 0) {
        const slugs = products.map(p => p.slug);
        const { data: existing } = await supabase
          .from("products")
          .select("slug")
          .in("slug", slugs);
        const existingSlugs = new Set((existing || []).map((e: any) => e.slug));

        products = products.map(p => ({
          ...p,
          already_exists: existingSlugs.has(p.slug),
        }));
      }

      console.log(`Discovered ${products.length} products for ${catLabel}`);

      return new Response(
        JSON.stringify({
          success: true,
          category_slug,
          g2_category: g2Cat,
          page: pageNum,
          products,
          total_products: products.length,
          has_next_page: pageNum === 1 && products.length >= 15,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ACTION: IMPORT ==========
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

          let websiteUrl = product.website_url || null;
          let g2Data: any = {};

          // In non-quick mode, try to scrape more details from the product's G2 page
          if (!quick_import && FIRECRAWL_API_KEY) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);

              const g2Res = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                signal: controller.signal,
                body: JSON.stringify({
                  url: product.g2_url,
                  formats: ["markdown"],
                  onlyMainContent: true,
                  waitFor: 3000,
                }),
              });
              clearTimeout(timeout);
              const g2Result = await g2Res.json();
              const markdown = g2Result?.data?.markdown || g2Result?.markdown || "";

              // Use AI to extract structured data from the markdown
              if (markdown && LOVABLE_API_KEY) {
                const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash-lite",
                    messages: [
                      { role: "system", content: "Extract product data from this G2 page content. Return ONLY valid JSON." },
                      { role: "user", content: `Extract from this G2 product page:\n\n${markdown.substring(0, 4000)}\n\nReturn JSON: { "website_url": "...", "description": "...", "tagline": "...", "pricing_model": "free|freemium|paid|subscription|one-time", "features": ["..."], "avg_rating": N, "total_reviews": N, "pros_summary": "...", "cons_summary": "..." }` },
                    ],
                    temperature: 0.1,
                  }),
                });
                const aiData = await aiRes.json();
                const content = aiData?.choices?.[0]?.message?.content || "";
                try {
                  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
                  g2Data = JSON.parse(jsonMatch[1]?.trim() || content.trim());
                } catch {}
              }

              if (!websiteUrl && g2Data.website_url) websiteUrl = g2Data.website_url;
            } catch (e) {
              console.warn(`Scrape error for ${product.name}, using discovered data`);
            }
          }

          // Auto-fetch logo URL via Clearbit if we have a website
          let logoUrl: string | null = null;
          if (websiteUrl) {
            try {
              const domain = new URL(websiteUrl).hostname;
              logoUrl = `https://logo.clearbit.com/${domain}`;
            } catch {}
          }

          const productRecord = {
            name: product.name,
            slug: product.slug,
            website_url: websiteUrl,
            logo_url: logoUrl,
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

        if (!quick_import) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ACTION: ENRICH ==========
    if (action === "enrich") {
      if (!FIRECRAWL_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: "Firecrawl not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = supabase
        .from("products")
        .select("id, name, slug, website_url, features")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (category_slug) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", category_slug)
          .maybeSingle();
        if (cat) query = query.eq("category_id", cat.id);
      }

      const { data: products } = await query.limit(50);

      const toEnrich = (products || []).filter(
        (p: any) => !p.website_url || !p.features || (Array.isArray(p.features) && p.features.length === 0)
      );

      if (toEnrich.length === 0) {
        return new Response(
          JSON.stringify({ success: true, results: [], message: "No products need enrichment" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: any[] = [];

      for (const product of toEnrich) {
        try {
          const g2Url = `https://www.g2.com/products/${product.slug}/reviews`;
          let enrichedData: any = {};

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);

            const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                "Content-Type": "application/json",
              },
              signal: controller.signal,
              body: JSON.stringify({
                url: g2Url,
                formats: ["markdown"],
                onlyMainContent: true,
                waitFor: 3000,
              }),
            });
            clearTimeout(timeout);
            const result = await res.json();
            const markdown = result?.data?.markdown || result?.markdown || "";

            if (markdown && LOVABLE_API_KEY) {
              const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    { role: "system", content: "Extract product data. Return ONLY valid JSON." },
                    { role: "user", content: `Extract from this G2 page:\n\n${markdown.substring(0, 4000)}\n\nReturn JSON: { "website_url": "...", "description": "...", "tagline": "...", "pricing_model": "free|freemium|paid|subscription|one-time", "features": ["..."], "avg_rating": N, "total_reviews": N, "pros_summary": "...", "cons_summary": "..." }` },
                  ],
                  temperature: 0.1,
                }),
              });
              const aiData = await aiRes.json();
              const content = aiData?.choices?.[0]?.message?.content || "";
              try {
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
                enrichedData = JSON.parse(jsonMatch[1]?.trim() || content.trim());
              } catch {}
            }
          } catch (e) {
            console.warn(`Enrich scrape failed for ${product.name}:`, e);
            results.push({ name: product.name, status: "error", reason: "Scrape timeout" });
            continue;
          }

          const updates: any = {};
          if (!product.website_url && enrichedData.website_url) updates.website_url = enrichedData.website_url;
          if (enrichedData.description) updates.description = enrichedData.description;
          if (enrichedData.tagline) updates.tagline = enrichedData.tagline;
          if (enrichedData.pricing_model) updates.pricing_model = enrichedData.pricing_model;
          if (enrichedData.features?.length > 0 && (!product.features || (Array.isArray(product.features) && product.features.length === 0))) {
            updates.features = enrichedData.features;
          }
          if (enrichedData.avg_rating) updates.avg_rating = Math.min(5, Math.max(0, Number(enrichedData.avg_rating)));
          if (enrichedData.total_reviews) updates.total_reviews = Math.max(0, Number(enrichedData.total_reviews));
          if (enrichedData.pros_summary) updates.pros_summary = enrichedData.pros_summary;
          if (enrichedData.cons_summary) updates.cons_summary = enrichedData.cons_summary;

          if (Object.keys(updates).length === 0) {
            results.push({ name: product.name, status: "skipped", reason: "No new data found" });
            continue;
          }

          const { error: updateError } = await supabase
            .from("products")
            .update(updates)
            .eq("id", product.id);

          if (updateError) {
            results.push({ name: product.name, status: "error", reason: updateError.message });
          } else {
            results.push({ name: product.name, status: "success" });
          }

          await new Promise((r) => setTimeout(r, 500));
        } catch (e) {
          results.push({
            name: product.name,
            status: "error",
            reason: e instanceof Error ? e.message : "Unknown error",
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
