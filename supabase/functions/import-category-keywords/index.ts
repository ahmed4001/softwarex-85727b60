import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/semrush";

type SemrushRow = string[];

function scoreOf(volume: number, difficulty: number, competition: number) {
  // Reward volume, penalise difficulty and paid competition.
  const demand = Math.log10(Math.max(volume, 1) + 1) * 20; // 0..~100
  const ease = (100 - Math.min(Math.max(difficulty, 0), 100)) / 100;
  const paid = 1 - Math.min(Math.max(competition, 0), 1) * 0.3;
  return Math.round(demand * ease * paid * 10) / 10;
}

async function fetchKeywords(
  method: "phrase_related" | "phrase_questions",
  phrase: string,
  database: string,
  limit: number,
  lovableKey: string,
  semrushKey: string,
): Promise<SemrushRow[]> {
  const url = `${GATEWAY}/keywords/${method}?phrase=${encodeURIComponent(phrase)}&database=${database}&export_columns=Ph,Nq,Cp,Co,Kd&display_limit=${limit}&Allow-Limit-Offset=true`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": semrushKey,
      "Allow-Limit-Offset": "true",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Semrush ${method} failed [${res.status}]: ${text}`);
    throw new Error(`[${res.status}]: ${text}`);
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected Semrush response: ${text.slice(0, 300)}`);
  }
  if (json?.error) {
    throw new Error(String(json.error));
  }
  return json?.data?.rows ?? [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const semrushKey = Deno.env.get("SEMRUSH_API_KEY");
    if (!lovableKey || !semrushKey) {
      return new Response(
        JSON.stringify({ error: "Semrush connection is not configured for this project." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const database: string = typeof body.database === "string" ? body.database : "us";
    const perKeyword: number = Math.min(Math.max(Number(body.per_keyword) || 25, 5), 100);
    const categoryLimit: number = Math.min(Math.max(Number(body.category_limit) || 10, 1), 30);
    const maxDifficulty: number = Number.isFinite(Number(body.max_difficulty))
      ? Number(body.max_difficulty)
      : 45;
    const minVolume: number = Number.isFinite(Number(body.min_volume)) ? Number(body.min_volume) : 100;
    const categoryIds: string[] | null = Array.isArray(body.category_ids) && body.category_ids.length
      ? body.category_ids
      : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("categories")
      .select("id, name, slug, product_count")
      .eq("is_active", true);
    if (categoryIds) q = q.in("id", categoryIds);
    const { data: categories, error: catErr } = await q
      .order("product_count", { ascending: false })
      .limit(categoryLimit);
    if (catErr) throw catErr;
    if (!categories?.length) {
      return new Response(JSON.stringify({ imported: 0, message: "No active categories found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imported = 0;
    const errors: string[] = [];

    for (const cat of categories) {
      const seed = `${cat.name} software`.toLowerCase();
      let rows: SemrushRow[] = [];
      try {
        const [related, questions] = await Promise.all([
          fetchKeywords("phrase_related", seed, database, perKeyword, lovableKey, semrushKey),
          fetchKeywords("phrase_questions", seed, database, Math.ceil(perKeyword / 2), lovableKey, semrushKey),
        ]);
        rows = [...related, ...questions];
      } catch (e: any) {
        const msg = `${cat.name}: ${e.message}`;
        console.error(msg);
        errors.push(msg);
        if (String(e.message).includes("TOTAL LIMIT EXCEEDED")) {
          return new Response(
            JSON.stringify({
              imported,
              errors,
              error: "The Semrush API quota is exhausted — upgrade your Semrush plan or wait for the quota to reset.",
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        continue;
      }

      const seen = new Set<string>();
      const payload = rows
        .map((r) => ({
          keyword: String(r[0] ?? "").trim(),
          search_volume: Math.round(Number(r[1]) || 0),
          cpc: Number(r[2]) || 0,
          competition: Number(r[3]) || 0,
          difficulty: Number(r[4]) || 0,
        }))
        .filter((k) => {
          if (!k.keyword || seen.has(k.keyword)) return false;
          seen.add(k.keyword);
          return k.search_volume >= minVolume && k.difficulty <= maxDifficulty;
        })
        .map((k) => ({
          ...k,
          category_id: cat.id,
          category_name: cat.name,
          seed_keyword: seed,
          database_code: database,
          source: "semrush",
          opportunity_score: scoreOf(k.search_volume, k.difficulty, k.competition),
          imported_at: new Date().toISOString(),
        }));

      if (!payload.length) continue;

      const { error: upErr } = await supabase
        .from("keyword_opportunities")
        .upsert(payload, { onConflict: "keyword,database_code,category_id" });
      if (upErr) {
        console.error(`Upsert failed for ${cat.name}:`, upErr.message);
        errors.push(`${cat.name}: ${upErr.message}`);
        continue;
      }
      imported += payload.length;
    }

    return new Response(JSON.stringify({ imported, categories: categories.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("import-category-keywords error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
