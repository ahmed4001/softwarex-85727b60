import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batch_size = 5 } = await req.json().catch(() => ({}));

    // Fetch comparisons missing summary
    const { data: comparisons, error: cErr } = await supabase
      .from("comparisons")
      .select("id, title, product_ids, slug")
      .is("summary", null)
      .eq("is_published", true)
      .limit(batch_size);

    if (cErr) throw cErr;
    if (!comparisons || comparisons.length === 0) {
      return new Response(JSON.stringify({ message: "No comparisons to process", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    const errors: string[] = [];

    for (const comparison of comparisons) {
      try {
        const productIds = Array.isArray(comparison.product_ids) ? comparison.product_ids : [];
        if (productIds.length < 2) continue;

        const { data: products } = await supabase
          .from("products")
          .select("id, name, slug, tagline, description, features, pricing_model, starting_price, avg_rating, total_reviews, pros_summary, cons_summary, company_size, founded_year, headquarters, category_id")
          .in("id", productIds.slice(0, 2));

        if (!products || products.length < 2) continue;

        const [productA, productB] = products;

        // Get category
        let categoryId = productA.category_id || productB.category_id;

        const prompt = `You are a SaaS software analyst. Generate a detailed, fair comparison between these two products.

Product A: ${productA.name}
- Tagline: ${productA.tagline || "N/A"}
- Description: ${productA.description?.substring(0, 500) || "N/A"}
- Features: ${JSON.stringify(productA.features || [])}
- Pricing: ${productA.pricing_model}, starting at $${productA.starting_price || 0}/mo
- Rating: ${productA.avg_rating}/5 (${productA.total_reviews} reviews)
- Pros: ${productA.pros_summary || "N/A"}
- Cons: ${productA.cons_summary || "N/A"}
- Founded: ${productA.founded_year || "N/A"}

Product B: ${productB.name}
- Tagline: ${productB.tagline || "N/A"}
- Description: ${productB.description?.substring(0, 500) || "N/A"}
- Features: ${JSON.stringify(productB.features || [])}
- Pricing: ${productB.pricing_model}, starting at $${productB.starting_price || 0}/mo
- Rating: ${productB.avg_rating}/5 (${productB.total_reviews} reviews)
- Pros: ${productB.pros_summary || "N/A"}
- Cons: ${productB.cons_summary || "N/A"}
- Founded: ${productB.founded_year || "N/A"}

Return a JSON object with these fields:
{
  "summary": "2-3 paragraph overview comparing both products",
  "winner_verdict": "1-2 sentences declaring overall winner and why",
  "winner_id": "a" or "b",
  "product_a_score": number 1-10,
  "product_b_score": number 1-10,
  "feature_scores": [{"feature": "Ease of Use", "score_a": 8, "score_b": 7}, {"feature": "Value for Money", "score_a": 7, "score_b": 8}, {"feature": "Customer Support", "score_a": 8, "score_b": 6}, {"feature": "Features & Functionality", "score_a": 9, "score_b": 7}, {"feature": "Integration Options", "score_a": 7, "score_b": 8}],
  "pros_a": ["pro1", "pro2", "pro3"],
  "cons_a": ["con1", "con2", "con3"],
  "pros_b": ["pro1", "pro2", "pro3"],
  "cons_b": ["con1", "con2", "con3"],
  "best_for_a": "Best for teams that...",
  "best_for_b": "Best for teams that...",
  "seo_title": "${productA.name} vs ${productB.name}: Which Is Better in 2026?",
  "seo_description": "Detailed comparison under 160 chars"
}

Return ONLY the JSON object, no markdown.`;

        // Try multiple Lovable AI models, then fall back to Google Gemini direct
        let content = "";
        let aiOk = false;

        const lovableModels = [
          "google/gemini-2.5-flash-lite",
          "google/gemini-3-flash-preview",
          "google/gemini-2.5-flash",
        ];

        for (const model of lovableModels) {
          if (aiOk) break;
          try {
            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lovableKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              content = aiData.choices?.[0]?.message?.content || "";
              if (content) aiOk = true;
            } else {
              const status = aiResponse.status;
              await aiResponse.text();
              console.log(`Lovable AI ${model} returned ${status}`);
              if (status !== 402 && status !== 429) break; // non-quota error, stop
            }
          } catch (e) {
            console.log(`Lovable AI ${model} failed: ${e}`);
          }
        }

        // Fallback: Google Gemini direct API
        if (!aiOk) {
          const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
          if (!geminiKey) {
            errors.push(`No fallback key for ${comparison.id}`);
            continue;
          }

          const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];

          for (const model of models) {
            try {
              const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 },
                  }),
                }
              );

              if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (content) { aiOk = true; break; }
              } else {
                const errText = await geminiRes.text();
                console.log(`Gemini ${model} failed: ${geminiRes.status} ${errText.substring(0, 100)}`);
              }
            } catch (e) {
              console.log(`Gemini ${model} error: ${e}`);
            }
          }

          if (!aiOk) {
            errors.push(`All AI providers failed for ${comparison.id}`);
            continue;
          }
        }

        // Parse JSON from response (handle potential markdown wrapping)
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const result = JSON.parse(jsonStr);

        const winnerId = result.winner_id === "a" ? productA.id : productB.id;

        await supabase
          .from("comparisons")
          .update({
            summary: result.summary,
            winner_verdict: result.winner_verdict,
            winner_product_id: winnerId,
            category_id: categoryId,
            product_a_score: result.product_a_score,
            product_b_score: result.product_b_score,
            feature_scores: result.feature_scores,
            pros_a: result.pros_a,
            cons_a: result.cons_a,
            pros_b: result.pros_b,
            cons_b: result.cons_b,
            best_for_a: result.best_for_a,
            best_for_b: result.best_for_b,
            seo_title: result.seo_title,
            seo_description: result.seo_description,
          })
          .eq("id", comparison.id);

        processed++;
      } catch (err) {
        errors.push(`Error processing ${comparison.id}: ${String(err)}`);
      }
    }

    return new Response(
      JSON.stringify({ processed, total: comparisons.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
