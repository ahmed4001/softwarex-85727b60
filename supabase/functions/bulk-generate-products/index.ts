import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

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

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { category_id, category_name, batch_size = 50, offset = 0 } = await req.json();

    if (!category_id || !category_name) {
      return new Response(
        JSON.stringify({ success: false, error: "category_id and category_name required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing product names/slugs to avoid duplicates
    const { data: existingProducts } = await supabase
      .from("products")
      .select("name, slug")
      .eq("category_id", category_id);

    const existingNames = new Set((existingProducts || []).map((p: any) => p.name.toLowerCase()));
    const existingSlugs = new Set((existingProducts || []).map((p: any) => p.slug));

    console.log(`Discovering real ${category_name} products via Firecrawl (${existingNames.size} existing)`);

    // Search multiple queries to get diverse results
    const searchQueries = [
      `best ${category_name} software tools 2025 2026`,
      `top ${category_name} apps alternatives`,
      `${category_name} software reviews ratings`,
    ];

    const allProducts: Array<{
      name: string;
      slug: string;
      website_url: string | null;
      description: string;
    }> = [];
    const seenSlugs = new Set<string>();

    for (const query of searchQueries) {
      try {
        const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 10,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        const searchData = await searchRes.json();
        const results = searchData?.data || [];

        for (const result of results) {
          const markdown = result.markdown || result.description || "";
          const title = result.title || "";

          // Extract product names from search results using common patterns
          // Look for numbered lists, bold names, H2/H3 headings with product names
          const patterns = [
            /(?:^|\n)\d+[\.\)]\s*\*?\*?([A-Z][A-Za-z0-9\s\.\-&+!]+?)(?:\*?\*?)\s*[-–—:|]/gm,
            /(?:^|\n)#{2,3}\s*\d*\.?\s*([A-Z][A-Za-z0-9\s\.\-&+!]+?)(?:\s*[-–—:])/gm,
            /\*\*([A-Z][A-Za-z0-9\s\.\-&+!]{2,30})\*\*/g,
            /(?:^|\n)\d+[\.\)]\s*\[?([A-Z][A-Za-z0-9\s\.\-&+!]+?)\]?\s*(?:\(|–|-|:)/gm,
          ];

          for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(markdown)) !== null) {
              let name = match[1].trim();
              // Clean up common suffixes
              name = name
                .replace(/\s*(Review|Pricing|Features|Overview|Best|Top|Software|Platform|Tool)s?\s*$/i, "")
                .replace(/\s+$/, "")
                .trim();

              if (name.length < 2 || name.length > 40) continue;
              if (/^(the|a|an|best|top|free|why|how|what|our|this|these|those|some|many|most|more|other|each|every)\b/i.test(name)) continue;
              if (/\d{4}/.test(name)) continue; // Skip names with years

              const slug = slugify(name);
              if (slug.length < 2 || seenSlugs.has(slug) || existingSlugs.has(slug) || existingNames.has(name.toLowerCase())) continue;

              seenSlugs.add(slug);

              // Try to find a website URL for this product from the links
              let websiteUrl: string | null = null;
              const nameLower = name.toLowerCase().replace(/\s+/g, "");
              // Check if the result URL might be the product's site
              const resultUrl = result.url || "";
              if (resultUrl && !resultUrl.includes("g2.com") && !resultUrl.includes("capterra.com") && !resultUrl.includes("trustradius")) {
                // It might be a listicle, not the product site itself
              }

              allProducts.push({
                name,
                slug,
                website_url: websiteUrl,
                description: `${name} is a ${category_name.toLowerCase()} solution.`,
              });
            }
          }
        }
      } catch (e) {
        console.warn(`Search error for query "${query}":`, e);
      }
    }

    // Also try G2 search for this category
    try {
      const g2Res = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `site:g2.com/products ${category_name} software`,
          limit: 20,
        }),
      });

      const g2Data = await g2Res.json();
      for (const result of (g2Data?.data || [])) {
        const url = result.url || "";
        const g2Match = url.match(/g2\.com\/products\/([^\/]+)/);
        if (!g2Match) continue;

        let name = result.title || g2Match[1];
        name = name
          .replace(/\s*\|?\s*G2\s*$/i, "")
          .replace(/\s*-\s*G2\s*$/i, "")
          .replace(/\s+Reviews?\s*\d*\s*$/i, "")
          .replace(/\s+Alternatives?\s*.*$/i, "")
          .replace(/\s+Competitors?\s*.*$/i, "")
          .trim();

        if (!name || name.length < 2 || name.length > 40) continue;

        const slug = slugify(name);
        if (seenSlugs.has(slug) || existingSlugs.has(slug) || existingNames.has(name.toLowerCase())) continue;
        seenSlugs.add(slug);

        allProducts.push({
          name,
          slug,
          website_url: null,
          description: result.description || `${name} is a ${category_name.toLowerCase()} tool.`,
        });
      }
    } catch (e) {
      console.warn("G2 search error:", e);
    }

    // Also try Capterra search
    try {
      const capRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `site:capterra.com ${category_name} software reviews`,
          limit: 20,
        }),
      });

      const capData = await capRes.json();
      for (const result of (capData?.data || [])) {
        const url = result.url || "";
        // Capterra product URLs: capterra.com/p/XXXXX/ProductName or capterra.com/reviews/XXXXX/ProductName
        const capMatch = url.match(/capterra\.com\/(?:p|reviews)\/\d+\/([^\/\?]+)/);
        if (!capMatch) continue;

        let name = capMatch[1].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        // Also try title
        if (result.title) {
          const titleName = result.title
            .replace(/\s*[-|]\s*Capterra\s*$/i, "")
            .replace(/\s*Reviews?\s*\d*\s*$/i, "")
            .replace(/\s*Pricing.*$/i, "")
            .trim();
          if (titleName.length > 1 && titleName.length < 40) name = titleName;
        }

        const slug = slugify(name);
        if (slug.length < 2 || seenSlugs.has(slug) || existingSlugs.has(slug) || existingNames.has(name.toLowerCase())) continue;
        seenSlugs.add(slug);

        allProducts.push({
          name,
          slug,
          website_url: null,
          description: result.description || `${name} is a ${category_name.toLowerCase()} solution.`,
        });
      }
    } catch (e) {
      console.warn("Capterra search error:", e);
    }

    // Limit to batch_size
    const productsToInsert = allProducts.slice(0, batch_size);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const p of productsToInsert) {
      // Try to get logo from Clearbit if we know a likely domain
      let logoUrl: string | null = null;
      const possibleDomain = `${p.slug.replace(/-/g, "")}.com`;
      logoUrl = `https://logo.clearbit.com/${possibleDomain}`;

      const record = {
        name: p.name,
        slug: p.slug,
        category_id,
        tagline: `${p.name} - ${category_name} solution`,
        description: p.description,
        website_url: p.website_url,
        logo_url: logoUrl,
        pricing_model: "freemium",
        features: [],
        is_active: true,
        published_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("products").insert(record);
      if (error) {
        if (error.message?.includes("duplicate") || error.code === "23505") {
          record.slug = `${p.slug}-${Math.random().toString(36).substring(2, 6)}`;
          const { error: retryError } = await supabase.from("products").insert(record);
          if (retryError) { errors++; } else { inserted++; }
        } else {
          errors++;
        }
      } else {
        inserted++;
      }

      existingSlugs.add(record.slug);
      existingNames.add(p.name.toLowerCase());
    }

    console.log(`Done: ${inserted} inserted, ${skipped} skipped, ${errors} errors from ${allProducts.length} discovered`);

    return new Response(
      JSON.stringify({ success: true, inserted, skipped, errors, total_discovered: allProducts.length }),
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
