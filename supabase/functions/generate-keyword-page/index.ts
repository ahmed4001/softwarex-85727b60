import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates structured 8-section content for a keyword landing page
 * Template: Problem → Solution → Features → How it works → Benefits → Use cases → CTA → FAQ
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword, page_id, primary_product_name, category } = await req.json();
    if (!keyword) throw new Error("keyword required");

    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const systemPrompt = `You are an SEO content strategist writing programmatic landing pages (Apploye/G2 style).
Output ONLY valid JSON. Do not wrap in markdown. The page targets ONE keyword and must rank + convert.
Tone: practical, benefits-led, scannable. Avoid fluff.`;

    const userPrompt = `Keyword: "${keyword}"
${category ? `Category: ${category}` : ""}
${primary_product_name ? `Primary product to feature in CTAs: ${primary_product_name}` : ""}

Produce a JSON object with this exact shape:
{
  "h1": "string (includes keyword naturally)",
  "meta_title": "string <60 chars, includes keyword",
  "meta_description": "string <160 chars, includes keyword + benefit",
  "hero_body": "1-2 paragraph markdown intro",
  "sections": [
    { "heading": "The Problem", "body": "2-3 sentences on pain points", "bullets": ["pain 1","pain 2","pain 3","pain 4"] },
    { "heading": "The Solution", "body": "2-3 sentences how ${keyword} solves it", "bullets": [] },
    { "heading": "Key Features", "body": "", "bullets": ["feature 1","feature 2","feature 3","feature 4","feature 5","feature 6","feature 7"] },
    { "heading": "How It Works", "body": "", "bullets": ["Step 1: ...","Step 2: ...","Step 3: ...","Step 4: ..."] },
    { "heading": "Benefits", "body": "", "bullets": ["benefit 1","benefit 2","benefit 3","benefit 4","benefit 5"] },
    { "heading": "Who Uses It", "body": "1-2 sentences", "bullets": ["use case / persona 1","use case 2","use case 3","use case 4"] },
    { "heading": "Get Started", "body": "1 paragraph CTA framing tying back to the primary product" }
  ],
  "faq": [
    { "q": "What is ${keyword}?", "a": "..." },
    { "q": "How much does ${keyword} cost?", "a": "..." },
    { "q": "Is ${keyword} secure?", "a": "..." },
    { "q": "Does ${keyword} integrate with other tools?", "a": "..." },
    { "q": "Who is ${keyword} best for?", "a": "..." },
    { "q": "How do I get started with ${keyword}?", "a": "..." }
  ],
  "related_keywords": ["6-10 long-tail variants"]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("AI error:", err);
      return new Response(JSON.stringify({ error: `AI gateway: ${aiRes.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    let content: any;
    try {
      content = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON from AI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Optionally write back to a draft row
    if (page_id) {
      await supabase.from("keyword_landing_pages").update({
        h1: content.h1,
        meta_title: content.meta_title,
        meta_description: content.meta_description,
        hero_body: content.hero_body,
        sections: content.sections || [],
        faq: content.faq || [],
        related_keywords: content.related_keywords || [],
        status: "ready",
      }).eq("id", page_id);
    }

    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("generate-keyword-page error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
