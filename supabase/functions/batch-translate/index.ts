import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOP_LANGUAGES = ["zh", "es", "hi", "ar", "pt", "ru", "ja", "de", "ko", "fr"];

const TRANSLATION_VERSION = "2"; // Bump when en.json changes significantly

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Allow specifying languages or default to top 10
    const body = await req.json().catch(() => ({}));
    const langs: string[] = body.languages || TOP_LANGUAGES;
    const forceRefresh = body.force === true;

    // Get English source
    const { sourceTranslations } = body;
    if (!sourceTranslations) {
      return new Response(
        JSON.stringify({ error: "sourceTranslations required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which languages already have up-to-date translations
    const { data: existing } = await supabase
      .from("ui_translations")
      .select("lang_code, version")
      .in("lang_code", langs);

    const existingMap = new Map((existing || []).map((e: any) => [e.lang_code, e.version]));

    const toTranslate = langs.filter((lang) => {
      if (forceRefresh) return true;
      return existingMap.get(lang) !== TRANSLATION_VERSION;
    });

    const results: { lang: string; status: string }[] = [];

    // Translate sequentially to avoid rate limits
    for (const lang of toTranslate) {
      try {
        const prompt = `You are a professional translator. Translate the following JSON object from English to ${lang}. 
Keep ALL JSON keys exactly the same (do not translate keys). Only translate the string values.
Keep HTML tags like <strong> intact. Keep brand names like "ReviewHunts" unchanged.
Keep template variables like {{year}}, {{count}}, {{name}}, {{query}}, {{max}} unchanged.

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
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
          }),
        });

        if (!aiResponse.ok) {
          results.push({ lang, status: `error: AI ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const translations = JSON.parse(jsonStr);

        // Upsert into DB
        const { error } = await supabase.from("ui_translations").upsert(
          { lang_code: lang, translations, version: TRANSLATION_VERSION },
          { onConflict: "lang_code" }
        );

        if (error) {
          results.push({ lang, status: `db error: ${error.message}` });
        } else {
          results.push({ lang, status: "success" });
        }

        // Small delay between translations
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        results.push({ lang, status: `error: ${err instanceof Error ? err.message : "unknown"}` });
      }
    }

    // Mark skipped languages
    for (const lang of langs) {
      if (!toTranslate.includes(lang)) {
        results.push({ lang, status: "cached (up-to-date)" });
      }
    }

    return new Response(
      JSON.stringify({ results, translated: toTranslate.length, skipped: langs.length - toTranslate.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Batch translation error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Batch translation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
