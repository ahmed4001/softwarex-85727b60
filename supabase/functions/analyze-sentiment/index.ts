import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { reviews } = await req.json();
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return new Response(JSON.stringify({ error: "No reviews provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const reviewTexts = reviews.map((r: any, i: number) =>
      `Review ${i + 1} (ID: ${r.id}):\nTitle: ${r.title || "N/A"}\nPros: ${r.pros || "N/A"}\nCons: ${r.cons || "N/A"}\nBody: ${r.body || "N/A"}`
    ).join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a sentiment analysis tool. Analyze each review and return structured data.",
          },
          {
            role: "user",
            content: `Analyze the sentiment of these reviews:\n\n${reviewTexts}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_sentiments",
              description: "Return sentiment analysis for each review",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Review ID" },
                        sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
                        score: { type: "number", description: "Sentiment score from -1 (very negative) to 1 (very positive)" },
                        keywords: { type: "array", items: { type: "string" }, description: "Key themes or topics mentioned" },
                        summary: { type: "string", description: "One-sentence summary of the review sentiment" },
                      },
                      required: ["id", "sentiment", "score", "keywords", "summary"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["results"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_sentiments" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const results = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sentiment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
