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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { category_id, max_comparisons = 500 } = await req.json();

    // Get categories to process
    let categories: any[] = [];
    if (category_id) {
      const { data } = await supabase.from("categories").select("id, name").eq("id", category_id).single();
      if (data) categories = [data];
    } else {
      const { data } = await supabase.from("categories").select("id, name").eq("is_active", true).order("name");
      categories = data || [];
    }

    // Get existing comparisons to avoid duplicates
    const { data: existing } = await supabase.from("comparisons").select("product_ids");
    const existingSet = new Set(
      (existing || []).map((c: any) => {
        const ids = Array.isArray(c.product_ids) ? c.product_ids : [];
        return ids.sort().join("|");
      })
    );

    let totalCreated = 0;
    let totalSkipped = 0;
    const log: string[] = [];

    for (const cat of categories) {
      // Get products in this category
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .eq("category_id", cat.id)
        .eq("is_active", true)
        .order("name");

      if (!products || products.length < 2) {
        log.push(`${cat.name}: skipped (${products?.length || 0} products)`);
        continue;
      }

      // Generate pairwise comparisons in batch
      const batch: any[] = [];
      for (let i = 0; i < products.length && totalCreated + batch.length < max_comparisons; i++) {
        for (let j = i + 1; j < products.length && totalCreated + batch.length < max_comparisons; j++) {
          const ids = [products[i].id, products[j].id].sort();
          const key = ids.join("|");
          if (existingSet.has(key)) { totalSkipped++; continue; }
          batch.push({ product_ids: ids, title: `${products[i].name} vs ${products[j].name}`, is_published: true });
          existingSet.add(key);
        }
      }

      if (batch.length > 0) {
        // Insert in chunks of 50
        for (let b = 0; b < batch.length; b += 50) {
          const chunk = batch.slice(b, b + 50);
          const { error, data: inserted } = await supabase.from("comparisons").insert(chunk).select("id");
          if (error) {
            log.push(`${cat.name} batch error: ${error.message}`);
          } else {
            totalCreated += inserted?.length || chunk.length;
          }
        }
        log.push(`${cat.name}: +${batch.length} comparisons (${products.length} products)`);
      }

      if (totalCreated >= max_comparisons) {
        log.push(`Reached max comparisons limit (${max_comparisons})`);
        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: totalCreated,
        skipped: totalSkipped,
        categories_processed: categories.length,
        log,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
