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
            content: "You generate concise product review summaries. Return ONLY valid JSON, no markdown.",
          },
          {
            role: "user",
            content: `Analyze these ${reviews.length} reviews for "${product?.name || "this product"}" and generate a summary.

Return a JSON object with:
- "pros_summary": A 2-3 sentence summary of the most commonly praised aspects
- "cons_summary": A 2-3 sentence summary of the most common criticisms
- "overall_summary": A 1-2 sentence overall verdict

Reviews:
${reviewTexts}`,
          },
        ],
        temperature: 0.3,
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
    const content = aiData?.choices?.[0]?.message?.content || "";

    let summary;
    try {
      const cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
      summary = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response");
    }

    // Update product with summaries
    const { error: updateErr } = await supabase
      .from("products")
      .update({
        pros_summary: summary.pros_summary || null,
        cons_summary: summary.cons_summary || null,
      })
      .eq("id", product_id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, summary }), {
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
