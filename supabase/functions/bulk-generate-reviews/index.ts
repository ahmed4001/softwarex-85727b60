import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require admin (or service role) — protects against unauthenticated abuse
    const _authHeader = req.headers.get("Authorization") || "";
    const _token = _authHeader.replace("Bearer ", "");
    const _serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (_token !== _serviceKey) {
      const _authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${_token}` } } }
      );
      const { data: _userData } = await _authClient.auth.getUser();
      const _user = _userData.user;
      if (!_user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const _adminClient = createClient(Deno.env.get("SUPABASE_URL")!, _serviceKey);
      const [_a, _s] = await Promise.all([
        _adminClient.rpc("has_role", { _user_id: _user.id, _role: "admin" }),
        _adminClient.rpc("has_role", { _user_id: _user.id, _role: "superadmin" }),
      ]);
      if (!_a.data && !_s.data) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { product_id, batch_size = 10, reviews_per_product = 5 } = await req.json();

    // If specific product, generate for just that one
    let products: any[] = [];
    if (product_id) {
      const { data } = await supabase
        .from("products")
        .select("id, name, category_id, avg_rating")
        .eq("id", product_id)
        .single();
      if (data) products = [data];
    } else {
      // Get products with 0 reviews, limited by batch_size
      const { data } = await supabase
        .from("products")
        .select("id, name, category_id, avg_rating, total_reviews")
        .eq("is_active", true)
        .or("total_reviews.is.null,total_reviews.eq.0")
        .limit(batch_size);
      products = data || [];
    }

    if (products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No products need reviews", inserted: 0, remaining: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get category names
    const categoryIds = [...new Set(products.map((p: any) => p.category_id).filter(Boolean))];
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", categoryIds);
    const catMap = new Map((categories || []).map((c: any) => [c.id, c.name]));

    // Count remaining products needing reviews
    const { count: remaining } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .or("total_reviews.is.null,total_reviews.eq.0");

    let totalInserted = 0;
    let errors = 0;

    for (const product of products) {
      const categoryName = catMap.get(product.category_id) || "Software";
      const avgRating = product.avg_rating || 4.2;

      try {
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
                content: "Generate ONLY valid JSON arrays. No markdown, no explanation.",
              },
              {
                role: "user",
                content: `Generate ${reviews_per_product} realistic user reviews for "${product.name}" (${categoryName} software).
Average rating should be around ${avgRating}/5.
Return a JSON array where each item has:
- overall_rating: 1-5 integer
- ease_of_use: 1-5 integer
- customer_support: 1-5 integer
- value_for_money: 1-5 integer
- features_rating: 1-5 integer
- title: specific review title (max 80 chars)
- pros: 2-4 specific pros as paragraph
- cons: 1-3 specific cons as paragraph
- body: 80-150 word review
- reviewer_role: realistic job title
- company_size: one of "1-10","11-50","51-200","201-500","501-1000","1001-5000","5000+"
- industry: realistic industry
- usage_duration: one of "Less than 6 months","6-12 months","1-2 years","2+ years"
- recommendation_likelihood: 1-10 integer
Vary sentiments. Not all positive. Make them sound human.`,
              },
            ],
            temperature: 0.8,
          }),
        });

        if (!aiRes.ok) {
          console.error(`AI error for ${product.name}: ${aiRes.status}`);
          errors++;
          continue;
        }

        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "";

        let reviews: any[] = [];
        try {
          const cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
          reviews = JSON.parse(cleaned);
          if (!Array.isArray(reviews)) reviews = [];
        } catch {
          // Try to repair truncated JSON
          let cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
          const lastComplete = cleaned.lastIndexOf("},");
          if (lastComplete > 0) {
            cleaned = cleaned.substring(0, lastComplete + 1) + "]";
            try { reviews = JSON.parse(cleaned); } catch { reviews = []; }
          }
          if (reviews.length === 0) {
            console.error(`Failed to parse reviews for ${product.name}`);
            errors++;
            continue;
          }
        }

        // Insert reviews
        for (const r of reviews) {
          const record = {
            product_id: product.id,
            user_id: SYSTEM_USER_ID,
            overall_rating: Math.min(5, Math.max(1, r.overall_rating || 4)),
            ease_of_use: r.ease_of_use || null,
            customer_support: r.customer_support || null,
            value_for_money: r.value_for_money || null,
            features_rating: r.features_rating || null,
            title: r.title || null,
            pros: r.pros || null,
            cons: r.cons || null,
            body: r.body || null,
            reviewer_role: r.reviewer_role || null,
            company_size: r.company_size || null,
            industry: r.industry || null,
            usage_duration: r.usage_duration || null,
            recommendation_likelihood: r.recommendation_likelihood || null,
            status: "approved",
            source: "imported",
            verified_reviewer: true,
          };

          const { error } = await supabase.from("reviews").insert(record);
          if (error) {
            console.error(`Insert error for ${product.name}:`, error.message);
          } else {
            totalInserted++;
          }
        }

        // Update product's total_reviews count
        const { count: reviewCount } = await supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("product_id", product.id)
          .eq("status", "approved");

        await supabase
          .from("products")
          .update({ total_reviews: reviewCount || 0 })
          .eq("id", product.id);

        console.log(`Generated ${reviews.length} reviews for ${product.name}`);
      } catch (e) {
        console.error(`Error for ${product.name}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalInserted,
        products_processed: products.length,
        errors,
        remaining: (remaining || 0) - products.length,
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
