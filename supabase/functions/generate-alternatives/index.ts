import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { categoryId, limit = 10 } = await req.json();

    // Fetch products (optionally filtered by category)
    let query = supabase
      .from("products")
      .select("id, name, seo_description, category_id, categories:categories!products_category_id_fkey(name)")
      .eq("is_active", true)
      .order("total_reviews", { ascending: false })
      .limit(80);

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data: products, error: pErr } = await query;
    if (pErr) throw pErr;
    if (!products || products.length < 2) {
      return new Response(JSON.stringify({ error: "Not enough products to generate alternatives" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing alternatives to avoid duplicates
    const { data: existing } = await supabase.from("alternatives").select("product_id, alternative_product_id");
    const existingSet = new Set(
      (existing || []).map((e: any) => `${e.product_id}__${e.alternative_product_id}`)
    );

    const productList = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.seo_description || "",
      category: p.categories?.name || "Unknown",
    }));

    const prompt = `You are a software comparison expert. Given this list of software products, identify ${limit} pairs that are genuine alternatives to each other (competitors solving similar problems).

Products:
${JSON.stringify(productList, null, 2)}

Return a JSON array of objects with:
- product_id: the id of the first product
- alternative_product_id: the id of the second product  
- similarity_score: a number between 0.0 and 1.0 indicating how similar they are
- reason: a brief explanation of why they are alternatives

Only pair products that genuinely compete or serve similar use cases. Do not pair unrelated products.
Return ONLY the JSON array, no other text.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a software comparison expert. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";
    
    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let pairs: any[];
    try {
      pairs = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse AI response");
    }

    // Validate product IDs exist
    const productIds = new Set(products.map((p: any) => p.id));
    const validPairs = pairs.filter(
      (p: any) =>
        productIds.has(p.product_id) &&
        productIds.has(p.alternative_product_id) &&
        p.product_id !== p.alternative_product_id &&
        !existingSet.has(`${p.product_id}__${p.alternative_product_id}`) &&
        !existingSet.has(`${p.alternative_product_id}__${p.product_id}`)
    );

    if (validPairs.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, message: "No new alternative pairs found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = validPairs.map((p: any) => ({
      product_id: p.product_id,
      alternative_product_id: p.alternative_product_id,
      similarity_score: Math.min(1, Math.max(0, Number(p.similarity_score) || 0.5)),
    }));

    const { error: insertErr } = await supabase.from("alternatives").insert(rows);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ inserted: rows.length, pairs: validPairs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-alternatives error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
