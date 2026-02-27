import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function tryFetchLogo(formattedUrl: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const domain = new URL(formattedUrl).hostname.replace("www.", "");
  const candidates = [
    `https://logo.clearbit.com/${domain}`,
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/favicon-32x32.png`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
    `https://${domain}/favicon.ico`,
  ];

  for (const candidate of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(candidate, { redirect: "follow", signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("image") || candidate.includes("clearbit")) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          const contentType = ct.includes("image") ? ct.split(";")[0] : "image/png";
          if (bytes.length >= 100) return { bytes, contentType };
        } else {
          await res.body?.cancel();
        }
      } else {
        await res.body?.cancel();
      }
    } catch { /* skip */ }
  }
  return null;
}

async function tryFetchScreenshot(formattedUrl: string, apiKey: string): Promise<Uint8Array | null> {
  try {
    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["screenshot"],
        waitFor: 3000,
        onlyMainContent: false,
      }),
    });

    if (!scrapeRes.ok) {
      await scrapeRes.body?.cancel();
      return null;
    }

    const scrapeData = await scrapeRes.json();
    const screenshot = scrapeData.data?.screenshot || scrapeData.screenshot;
    if (!screenshot) return null;

    if (screenshot.startsWith("http")) {
      const imgRes = await fetch(screenshot);
      if (!imgRes.ok) { await imgRes.body?.cancel(); return null; }
      return new Uint8Array(await imgRes.arrayBuffer());
    }

    // base64
    const base64 = screenshot.replace(/^data:image\/\w+;base64,/, "");
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return bytes;
  } catch (e) {
    console.error("Screenshot fetch error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batchSize = 20, offset = 0, mode = "logo" } = await req.json().catch(() => ({}));
    // mode: "logo" | "screenshot" | "both"

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
    const canScreenshot = !!FIRECRAWL_API_KEY && (mode === "screenshot" || mode === "both");

    // Build query based on mode
    let query = supabase
      .from("products")
      .select("id, slug, website_url, logo_url, screenshots")
      .eq("is_active", true)
      .not("website_url", "is", null)
      .neq("website_url", "");

    if (mode === "logo" || mode === "both") {
      query = query.or("logo_url.ilike.%clearbit%,logo_url.is.null,logo_url.eq.");
    } else if (mode === "screenshot") {
      // Products with empty screenshots array
      query = query.or("screenshots.is.null,screenshots.eq.[]");
    }

    const { data: products, error: fetchErr } = await query.range(offset, offset + batchSize - 1);

    if (fetchErr) throw fetchErr;
    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more products to process", processed: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; slug: string; logo?: string; screenshot?: string; status: string }[] = [];

    for (const product of products) {
      try {
        let formattedUrl = product.website_url!.trim();
        if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;
        const slug = product.slug || product.id;
        let logoStatus = "";
        let screenshotStatus = "";

        // Logo
        if (mode === "logo" || mode === "both") {
          const needsLogo = !product.logo_url || product.logo_url.includes("clearbit");
          if (needsLogo) {
            const logo = await tryFetchLogo(formattedUrl);
            if (logo) {
              const ext = logo.contentType.includes("svg") ? "svg" : logo.contentType.includes("ico") ? "ico" : "png";
              const logoPath = `logos/${slug}-${Date.now()}.${ext}`;
              const { error: upErr } = await supabase.storage
                .from("product-images")
                .upload(logoPath, logo.bytes, { contentType: logo.contentType, upsert: true });
              if (!upErr) {
                const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(logoPath);
                await supabase.from("products").update({ logo_url: urlData.publicUrl }).eq("id", product.id);
                logoStatus = "ok";
              } else {
                logoStatus = "upload_error";
              }
            } else {
              logoStatus = "not_found";
            }
          } else {
            logoStatus = "already_hosted";
          }
        }

        // Screenshot
        if (canScreenshot) {
          const currentScreenshots = Array.isArray(product.screenshots) ? product.screenshots : [];
          if (currentScreenshots.length === 0) {
            const screenshotBytes = await tryFetchScreenshot(formattedUrl, FIRECRAWL_API_KEY);
            if (screenshotBytes && screenshotBytes.length > 500) {
              const screenshotPath = `screenshots/${slug}-${Date.now()}.png`;
              const { error: upErr } = await supabase.storage
                .from("product-images")
                .upload(screenshotPath, screenshotBytes, { contentType: "image/png", upsert: true });
              if (!upErr) {
                const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(screenshotPath);
                await supabase
                  .from("products")
                  .update({ screenshots: [urlData.publicUrl] })
                  .eq("id", product.id);
                screenshotStatus = "ok";
              } else {
                screenshotStatus = "upload_error";
              }
            } else {
              screenshotStatus = "not_found";
            }
          } else {
            screenshotStatus = "already_exists";
          }
        }

        const status = [
          logoStatus ? `logo:${logoStatus}` : "",
          screenshotStatus ? `screenshot:${screenshotStatus}` : "",
        ].filter(Boolean).join(", ") || "skipped";

        results.push({ id: product.id, slug: product.slug, status });
      } catch (e) {
        results.push({ id: product.id, slug: product.slug, status: `error: ${e instanceof Error ? e.message : "unknown"}` });
      }
    }

    const succeeded = results.filter(r => r.status.includes("ok")).length;

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
