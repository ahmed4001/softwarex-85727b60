import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = await req.json();

    const aiCall = async (prompt: string, maxTokens = 4000) => {
      const response = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: maxTokens,
          messages: [
            {
              role: "system",
              content:
                "You are a data generation assistant. You ONLY return valid JSON arrays or objects. No markdown, no explanation, no code fences. Just raw JSON.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits in workspace settings.");
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      // Strip any markdown fences the model might add
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return cleaned;
    };

    // ACTION 1: Generate products for a category
    if (action === "generate_category") {
      const { category, count, categoryId } = payload;
      const prompt = `Generate ${count} realistic software products for the category "${category}".
Return ONLY a valid JSON array. Each product must have ALL these fields:
{
  "name": "exact real product name that actually exists",
  "slug": "kebab-case-slug",
  "tagline": "one line value proposition under 80 chars",
  "description": "3-4 paragraph detailed description, 200-300 words",
  "website_url": "https://realdomain.com",
  "category": "${category}",
  "pricing_model": "free|freemium|subscription|paid|one-time",
  "starting_price": number or null,
  "avg_rating": number between 3.5 and 4.9,
  "total_reviews": realistic number between 50 and 5000,
  "founded_year": real year the company was founded,
  "headquarters": "City, State/Country",
  "company_size": "1-10|11-50|51-200|201-500|501-1000|1000+",
  "employee_count": realistic number,
  "features": ["feature1","feature2",...8 features],
  "integrations": ["tool1","tool2",...8 integrations],
  "pros_summary": "2-3 sentence summary of main strengths",
  "cons_summary": "2-3 sentence summary of main weaknesses",
  "seo_title": "Product Name Reviews & Pricing 2025",
  "seo_description": "meta description under 160 chars"
}
Use REAL software products that actually exist. Make all data accurate.`;

      const result = await aiCall(prompt, 8000);
      let products = JSON.parse(result);

      // Add Clearbit logo URLs and category_id
      products = products.map((p: any) => {
        const domain = p.website_url
          ? new URL(p.website_url).hostname.replace("www.", "")
          : null;
        return {
          ...p,
          logo_url: domain ? `https://logo.clearbit.com/${domain}` : null,
          category_id: categoryId || null,
          is_verified: true,
          is_featured: false,
          is_active: true,
        };
      });

      return new Response(JSON.stringify({ products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION 2: Generate reviews for a product
    if (action === "generate_reviews") {
      const { product_name, product_category, count, avg_rating } = payload;
      const prompt = `Generate ${count} realistic user reviews for "${product_name}" (${product_category} software).
Reviews should average around ${avg_rating}/5 rating overall.
Return ONLY a valid JSON array. Each review must have:
{
  "overall_rating": 1-5 integer,
  "ease_of_use": 1-5 integer,
  "customer_support": 1-5 integer,
  "value_for_money": 1-5 integer,
  "features_rating": 1-5 integer,
  "title": "specific review title",
  "pros": "3-5 specific pros as paragraph",
  "cons": "2-3 specific cons as paragraph",
  "body": "150-250 word detailed honest review",
  "reviewer_role": "realistic job title",
  "company_size": "1-10|11-50|51-200|201-500|501-1000|1000+",
  "industry": "realistic industry",
  "usage_duration": "3 months|6 months|1 year|2 years|3+ years",
  "use_case": "specific use case description",
  "recommendation_likelihood": 1-10 integer
}
Make reviews sound human. Vary roles, industries, sentiments. Not all positive.`;

      const result = await aiCall(prompt, 6000);
      const reviews = JSON.parse(result);
      return new Response(JSON.stringify({ reviews }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION 3: Enrich existing product
    if (action === "enrich_product") {
      const { product } = payload;
      const prompt = `Enrich this software product with missing/weak data.
Product: ${product.name}
Current data: ${JSON.stringify(product)}

Return ONLY a valid JSON object with improved/filled fields. Include:
- description (200-300 words if weak)
- tagline (under 80 chars)
- features (array of 8+ features)
- integrations (array of 8+ integrations)
- pros_summary, cons_summary
- pricing_model, starting_price
- founded_year, headquarters, company_size, employee_count
- seo_title, seo_description
Only return fields that need updating. Use real accurate data.`;

      const result = await aiCall(prompt, 4000);
      const enrichment = JSON.parse(result);

      // Add Clearbit logo if website_url exists
      const websiteUrl = enrichment.website_url || product.website_url;
      if (websiteUrl && !product.logo_url) {
        try {
          const domain = new URL(websiteUrl).hostname.replace("www.", "");
          enrichment.logo_url = `https://logo.clearbit.com/${domain}`;
        } catch { /* ignore URL parse errors */ }
      }

      return new Response(JSON.stringify({ enrichment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-generate-products error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
