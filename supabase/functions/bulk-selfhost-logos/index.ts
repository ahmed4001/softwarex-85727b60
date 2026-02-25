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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batchSize = 25, offset = 0 } = await req.json().catch(() => ({}));

    // Get products that still use clearbit or have no logo
    const { data: products, error: fetchErr } = await supabase
      .from("products")
      .select("id, slug, website_url, logo_url")
      .eq("is_active", true)
      .not("website_url", "is", null)
      .neq("website_url", "")
      .or("logo_url.ilike.%clearbit%,logo_url.is.null,logo_url.eq.")
      .range(offset, offset + batchSize - 1);

    if (fetchErr) throw fetchErr;
    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more products to process", processed: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; slug: string; status: string; logoUrl?: string }[] = [];

    for (const product of products) {
      try {
        let formattedUrl = product.website_url!.trim();
        if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

        const domain = new URL(formattedUrl).hostname.replace("www.", "");
        const slug = product.slug || product.id;

        // Try multiple logo sources in order
        const logoCandidates = [
          `https://logo.clearbit.com/${domain}`,
          `https://${domain}/favicon.ico`,
          `https://${domain}/apple-touch-icon.png`,
          `https://${domain}/favicon-32x32.png`,
        ];

        let logoBytes: Uint8Array | null = null;
        let contentType = "image/png";

        for (const candidate of logoCandidates) {
          try {
            const res = await fetch(candidate, { redirect: "follow" });
            if (res.ok) {
              const ct = res.headers.get("content-type") || "";
              if (ct.includes("image") || candidate.includes("clearbit")) {
                logoBytes = new Uint8Array(await res.arrayBuffer());
                contentType = ct.includes("image") ? ct.split(";")[0] : "image/png";
                // Skip tiny broken favicons (< 100 bytes)
                if (logoBytes.length >= 100) break;
                logoBytes = null;
              } else {
                await res.body?.cancel();
              }
            } else {
              await res.body?.cancel();
            }
          } catch {
            // Skip failed candidate
          }
        }

        if (logoBytes && logoBytes.length >= 100) {
          const ext = contentType.includes("svg") ? "svg" : contentType.includes("ico") ? "ico" : "png";
          const logoPath = `logos/${slug}-${Date.now()}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from("product-images")
            .upload(logoPath, logoBytes, { contentType, upsert: true });

          if (!upErr) {
            const { data: urlData } = supabase.storage
              .from("product-images")
              .getPublicUrl(logoPath);

            await supabase
              .from("products")
              .update({ logo_url: urlData.publicUrl })
              .eq("id", product.id);

            results.push({ id: product.id, slug: product.slug, status: "ok", logoUrl: urlData.publicUrl });
          } else {
            results.push({ id: product.id, slug: product.slug, status: "upload_error" });
          }
        } else {
          results.push({ id: product.id, slug: product.slug, status: "no_logo_found" });
        }
      } catch (e) {
        results.push({ id: product.id, slug: product.slug, status: `error: ${e instanceof Error ? e.message : "unknown"}` });
      }
    }

    const succeeded = results.filter(r => r.status === "ok").length;

    return new Response(
      JSON.stringify({
        success: true,
        processed: products.length,
        succeeded,
        failed: products.length - succeeded,
        nextOffset: offset + batchSize,
        done: products.length < batchSize,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("bulk-selfhost-logos error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
