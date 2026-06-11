import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function plainFetchScrape(url: string): Promise<{ markdown: string; links: string[]; url: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DealImporter/1.0; +https://softwarex.lovable.app)",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Plain fetch failed (${res.status})`);
  const html = await res.text();
  // Collect links
  const linkSet = new Set<string>();
  const linkRe = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    try { linkSet.add(new URL(m[1], url).toString()); } catch { /* ignore */ }
  }
  // Strip to text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return { markdown: text.slice(0, 20000), links: [...linkSet], url };

async function firecrawlScrape(apiKey: string, url: string) {
  const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: true }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Firecrawl scrape failed (${res.status})`);
  const doc = json.data ?? json;
  return { markdown: doc?.markdown ?? "", links: doc?.links ?? [], url };
}

async function firecrawlCrawl(apiKey: string, url: string, limit: number) {
  // Start crawl
  const startRes = await fetch(`${FIRECRAWL_V2}/crawl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      limit,
      maxDiscoveryDepth: 2,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  const startJson = await startRes.json();
  if (!startRes.ok) throw new Error(startJson?.error || `Firecrawl crawl start failed`);
  const jobId = startJson.id || startJson.jobId;
  if (!jobId) throw new Error("Crawl job id missing");

  // Poll
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    await new Promise((r) => setTimeout(r, 3000));
    const sRes = await fetch(`${FIRECRAWL_V2}/crawl/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const sJson = await sRes.json();
    if (sJson?.status === "completed") {
      const docs = sJson?.data ?? [];
      return docs.map((d: any) => ({
        markdown: d?.markdown ?? "",
        url: d?.metadata?.sourceURL ?? d?.metadata?.url ?? url,
        links: [],
      }));
    }
    if (sJson?.status === "failed") throw new Error("Crawl failed");
  }
  throw new Error("Crawl timeout");
}

async function extractDealsWithAI(apiKey: string, markdown: string, sourceUrl: string) {
  const truncated = markdown.slice(0, 18000);
  const systemPrompt = `You extract software / SaaS deals from web pages AND write SEO meta + Schema.org JSON-LD for each. Output ONLY JSON.
Return: { "deals": [ { "product_name", "description" (1-2 sentences plain text), "discount_amount" (e.g. "30%" or "$50"), "discount_type" ("percent" or "fixed"), "coupon_code" (null if none), "deal_url" (absolute URL the user clicks to redeem), "merchant_domain" (e.g. "notion.so"), "end_date" (ISO date or null), "category" (short label), "meta_title" (<=60 chars, includes product + discount), "meta_description" (<=155 chars, compelling, includes discount and CTA), "seo_keywords" (array of 4-7 short lowercase keyword phrases), "structured_data" (a JSON object representing a Schema.org Offer with @context, @type, priceCurrency "USD", availability "https://schema.org/InStock", validThrough if end_date known, and seller as an Organization with the product_name) } ] }
Only include real deals with a clear discount or promo. Skip generic blog text. If deal_url is relative, prefix with source URL origin.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Source URL: ${sourceUrl}\n\n${truncated}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.deals) ? parsed.deals : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, urls = [], mode = "scrape", crawl_limit = 20 } = body;

    if (action === "extract") {
      const all: any[] = [];
      const sourcePages: Array<{ markdown: string; url: string }> = [];

      if (mode === "crawl" && urls[0]) {
        const docs = await firecrawlCrawl(FIRECRAWL_API_KEY, urls[0], crawl_limit);
        sourcePages.push(...docs);
      } else {
        for (const u of urls.slice(0, 10)) {
          try {
            const doc = await firecrawlScrape(FIRECRAWL_API_KEY, u);
            sourcePages.push(doc);
          } catch (e) {
            console.warn("Scrape error", u, e);
          }
        }
      }

      for (const page of sourcePages) {
        if (!page.markdown) continue;
        try {
          const deals = await extractDealsWithAI(LOVABLE_API_KEY, page.markdown, page.url);
          for (const d of deals) all.push({ ...d, source_url: page.url });
        } catch (e) {
          console.warn("AI extract error", e);
        }
      }

      // Auto-link to products by domain
      const domains = [...new Set(all.map((d) => extractDomain(d.merchant_domain) || extractDomain(d.deal_url)).filter(Boolean))];
      const productMap = new Map<string, { id: string; name: string; slug: string; logo_url: string | null }>();
      if (domains.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, name, slug, logo_url, website_url");
        for (const p of (prods || [])) {
          const d = extractDomain((p as any).website_url);
          if (d && !productMap.has(d)) productMap.set(d, p as any);
        }
      }

      // Dedupe vs existing deals by deal_url
      const dealUrls = all.map((d) => d.deal_url).filter(Boolean);
      const existingUrls = new Set<string>();
      if (dealUrls.length) {
        const { data: ex } = await supabase.from("deals").select("deal_url").in("deal_url", dealUrls);
        (ex || []).forEach((r: any) => existingUrls.add(r.deal_url));
      }

      const enriched = all.map((d) => {
        const domain = extractDomain(d.merchant_domain) || extractDomain(d.deal_url);
        const matched = domain ? productMap.get(domain) : null;
        return {
          ...d,
          domain,
          matched_product_id: matched?.id ?? null,
          matched_product_name: matched?.name ?? null,
          matched_logo_url: matched?.logo_url ?? null,
          already_exists: existingUrls.has(d.deal_url),
        };
      });

      return new Response(JSON.stringify({ success: true, deals: enriched, pages_scraped: sourcePages.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import") {
      const { deals = [] } = body;
      let inserted = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const d of deals) {
        if (!d.product_name || !d.deal_url) {
          skipped++;
          continue;
        }
        const baseSlug = slugify(`${d.product_name}-${d.discount_amount || "deal"}`);
        let slug = baseSlug || `deal-${Date.now()}`;

        const record: any = {
          product_name: d.product_name,
          slug,
          logo_url: d.logo_url || d.matched_logo_url || null,
          description: d.description || null,
          deal_url: d.deal_url,
          discount_amount: d.discount_amount || null,
          discount_type: d.discount_type || "percent",
          coupon_code: d.coupon_code || null,
          category: d.category || null,
          end_date: d.end_date || null,
          product_id: d.matched_product_id || d.product_id || null,
          is_visible: false,
          is_featured: !!d.is_featured,
          review_status: "pending_review",
          meta_title: d.meta_title || null,
          meta_description: d.meta_description || null,
          seo_keywords: Array.isArray(d.seo_keywords) ? d.seo_keywords.slice(0, 10) : null,
          structured_data: d.structured_data && typeof d.structured_data === "object" ? d.structured_data : null,
        };

        let { error } = await supabase.from("deals").insert(record);
        if (error?.code === "23505") {
          record.slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
          ({ error } = await supabase.from("deals").insert(record));
        }
        if (error) { errors.push(`${d.product_name}: ${error.message}`); }
        else inserted++;
      }

      return new Response(JSON.stringify({ success: true, inserted, skipped, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
