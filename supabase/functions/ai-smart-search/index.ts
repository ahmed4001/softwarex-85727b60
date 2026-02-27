import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || query.trim().length < 3) {
      return new Response(JSON.stringify({ results: [], interpretation: "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use Lovable AI to parse the natural language query into structured filters
    const parsePrompt = `You are a search query parser for a software review website. Parse the user's natural language query into structured filters.

User query: "${query}"

Return a JSON object with these optional fields:
- keywords: array of search keywords (product names, categories)
- max_price: number or null (monthly price limit)
- min_rating: number or null (minimum star rating 1-5)
- pricing_model: one of "free", "freemium", "paid", "subscription", "one-time" or null
- category_hint: string describing the category (e.g. "CRM", "project management", "email marketing") or null
- company_size: string like "startup", "small business", "enterprise" or null
- intent: "find" | "compare" | "alternative" — what the user wants

ONLY return valid JSON, nothing else.`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: parsePrompt }],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";
    
    // Extract JSON from markdown code blocks if present
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    
    let filters: any = {};
    try { filters = JSON.parse(jsonStr); } catch { filters = {}; }

    // Build the query
    let dbQuery = supabase
      .from("products")
      .select("id, name, slug, tagline, logo_url, avg_rating, total_reviews, pricing_model, starting_price, is_featured, is_sponsored, sponsor_tier, categories!products_category_id_fkey(name, slug)")
      .eq("is_active", true)
      .order("info_score", { ascending: false })
      .order("avg_rating", { ascending: false })
      .limit(20);

    // Apply parsed filters
    if (filters.pricing_model) {
      dbQuery = dbQuery.eq("pricing_model", filters.pricing_model);
    }
    if (filters.max_price !== undefined && filters.max_price !== null) {
      dbQuery = dbQuery.lte("starting_price", filters.max_price);
    }
    if (filters.min_rating) {
      dbQuery = dbQuery.gte("avg_rating", filters.min_rating);
    }

    // Search by keywords or category hint
    const searchTerms = [
      ...(filters.keywords || []),
      ...(filters.category_hint ? [filters.category_hint] : []),
    ].filter(Boolean);

    if (searchTerms.length > 0) {
      const orClauses = searchTerms.map(term => 
        `name.ilike.%${term}%,tagline.ilike.%${term}%,description.ilike.%${term}%`
      ).join(",");
      dbQuery = dbQuery.or(orClauses);
    }

    const { data: products, error } = await dbQuery;

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ results: [], interpretation: "Search error", filters }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a human-readable interpretation
    const parts: string[] = [];
    if (filters.category_hint) parts.push(`Category: ${filters.category_hint}`);
    if (filters.pricing_model) parts.push(`Pricing: ${filters.pricing_model}`);
    if (filters.max_price) parts.push(`Under $${filters.max_price}/mo`);
    if (filters.min_rating) parts.push(`${filters.min_rating}+ stars`);
    if (filters.company_size) parts.push(`For ${filters.company_size}`);
    const interpretation = parts.length > 0 ? `Showing results for: ${parts.join(" • ")}` : `Results for "${query}"`;

    return new Response(JSON.stringify({ results: products || [], interpretation, filters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI search error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
