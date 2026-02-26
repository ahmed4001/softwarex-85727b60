import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { product_id } = await req.json();
    if (!product_id) {
      return new Response(JSON.stringify({ error: "product_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch approved reviews
    const { data: reviews } = await supabase
      .from("reviews")
      .select("overall_rating, title, body, pros, cons, ease_of_use, customer_support, value_for_money, features_rating")
      .eq("product_id", product_id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!reviews || reviews.length === 0) {
      return new Response(JSON.stringify({ error: "No reviews to summarize" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch product name
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", product_id)
      .single();

    const reviewTexts = reviews.map((r: any, i: number) =>
      `Review ${i + 1} (${r.overall_rating}/5): ${r.title || ""}\nPros: ${r.pros || "N/A"}\nCons: ${r.cons || "N/A"}\n${r.body || ""}`
    ).join("\n---\n");

    // Calculate average sub-ratings
    const avg = (field: string) => {
      const vals = reviews.map((r: any) => r[field]).filter((v: any) => v != null && v > 0);
      return vals.length > 0 ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null;
    };
    const avgSubRatings: Record<string, number | null> = {
      ease_of_use: avg("ease_of_use"),
      customer_support: avg("customer_support"),
      value_for_money: avg("value_for_money"),
      features: avg("features_rating"),
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a review analysis assistant. Analyze product reviews and return structured digest data using the provided tool.",
          },
          {
            role: "user",
            content: `Analyze these ${reviews.length} reviews for "${product?.name || "this product"}" and generate a comprehensive review digest.\n\nReviews:\n${reviewTexts}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_review_digest",
              description: "Return the structured review digest analysis",
              parameters: {
                type: "object",
                properties: {
                  overall_verdict: { type: "string", description: "1-2 sentence overall verdict of the product based on reviews" },
                  pros_summary: { type: "string", description: "2-3 sentence summary of the most commonly praised aspects" },
                  cons_summary: { type: "string", description: "2-3 sentence summary of the most common criticisms" },
                  top_themes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Top 5 keywords/themes extracted from reviews (e.g. 'Easy setup', 'Great support', 'Pricey')",
                  },
                  sentiment_pct: {
                    type: "object",
                    properties: {
                      positive: { type: "number", description: "Percentage of positive reviews (0-100)" },
                      neutral: { type: "number", description: "Percentage of neutral reviews (0-100)" },
                      negative: { type: "number", description: "Percentage of negative reviews (0-100)" },
                    },
                    required: ["positive", "neutral", "negative"],
                    additionalProperties: false,
                  },
                },
                required: ["overall_verdict", "pros_summary", "cons_summary", "top_themes", "sentiment_pct"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_review_digest" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const digest = JSON.parse(toolCall.function.arguments);

    // Upsert into review_digests
    const { error: upsertErr } = await supabase
      .from("review_digests")
      .upsert(
        {
          product_id,
          overall_verdict: digest.overall_verdict || null,
          pros_summary: digest.pros_summary || null,
          cons_summary: digest.cons_summary || null,
          top_themes: digest.top_themes || [],
          sentiment_pct: digest.sentiment_pct || { positive: 0, neutral: 0, negative: 0 },
          avg_sub_ratings: avgSubRatings,
          review_count: reviews.length,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id" }
      );

    if (upsertErr) throw upsertErr;

    // Backward compatibility: update products table
    await supabase
      .from("products")
      .update({
        pros_summary: digest.pros_summary || null,
        cons_summary: digest.cons_summary || null,
      })
      .eq("id", product_id);

    return new Response(JSON.stringify({ success: true, digest }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
