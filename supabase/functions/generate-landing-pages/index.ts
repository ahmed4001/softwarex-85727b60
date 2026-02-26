import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get categories with products
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .limit(10);

    if (!categories?.length) {
      return new Response(JSON.stringify({ count: 0, message: "No categories found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audiences = ["startups", "enterprise", "small-business", "freelancers"];
    let created = 0;

    for (const cat of categories.slice(0, 5)) {
      for (const audience of audiences.slice(0, 2)) {
        const slug = `${cat.slug}-for-${audience}-2026`;

        // Check if exists
        const { data: existing } = await supabase
          .from("seo_landing_pages")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (existing) continue;

        // Get top products for this category
        const { data: products } = await supabase
          .from("products")
          .select("id, name, tagline, avg_rating, total_reviews")
          .eq("category_id", cat.id)
          .eq("is_active", true)
          .order("avg_rating", { ascending: false })
          .limit(6);

        if (!products?.length) continue;

        const productList = products.map((p: any) => `- ${p.name}: ${p.tagline || "N/A"} (${p.avg_rating}★, ${p.total_reviews} reviews)`).join("\n");

        const prompt = `Write a concise SEO landing page body (markdown, 200-300 words) for "Best ${cat.name} Software for ${audience} in 2026". Include intro, why it matters, and a brief buying guide. Products:\n${productList}`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You write concise, SEO-optimized landing page content. Return only markdown body text." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!aiRes.ok) {
          console.error("AI error:", await aiRes.text());
          continue;
        }

        const aiData = await aiRes.json();
        const body = aiData.choices?.[0]?.message?.content || "";

        const title = `Best ${cat.name} Software for ${audience.charAt(0).toUpperCase() + audience.slice(1)} in 2026`;

        await supabase.from("seo_landing_pages").insert({
          title,
          slug,
          meta_description: `Compare the top ${cat.name.toLowerCase()} tools for ${audience}. Find the best fit for your team in 2026.`,
          body,
          category_id: cat.id,
          audience,
          product_ids: products.map((p: any) => p.id),
          is_published: false,
        });

        created++;
      }
    }

    return new Response(JSON.stringify({ count: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-landing-pages error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
