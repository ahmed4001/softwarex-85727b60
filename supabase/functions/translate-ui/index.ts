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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const { targetLang, sourceTranslations } = await req.json();
    if (!targetLang || !sourceTranslations) {
      return new Response(
        JSON.stringify({ error: "targetLang and sourceTranslations required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check DB cache first
    const supabase = createClient(supabaseUrl, anonKey);
    const { data: cached } = await supabase
      .from("ui_translations")
      .select("translations")
      .eq("lang_code", targetLang)
      .single();

    if (cached?.translations) {
      return new Response(
        JSON.stringify({ translations: cached.translations, language: targetLang, source: "cache" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate via AI
    const prompt = `You are a professional translator. Translate the following JSON object from English to ${targetLang}. 
Keep ALL JSON keys exactly the same (do not translate keys). Only translate the string values.
Keep HTML tags like <strong> intact. Keep brand names like "ReviewHunts" unchanged.
Keep template variables like {{year}} unchanged.

Source JSON:
${JSON.stringify(sourceTranslations, null, 2)}

Return ONLY the translated JSON object, no markdown, no explanation.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted, please add funds" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const translations = JSON.parse(jsonStr);

    // Save to DB cache (best-effort, using service role for write)
    try {
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient.from("ui_translations").upsert(
        { lang_code: targetLang, translations, version: "2" },
        { onConflict: "lang_code" }
      );
    } catch {}

    return new Response(
      JSON.stringify({ translations, language: targetLang, source: "generated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Translation error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Translation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
