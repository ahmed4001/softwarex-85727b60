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

// Strip deal-marketing noise from an extracted product name so it becomes the
// clean official brand name (used for both display and slug).
function cleanProductName(raw: string | null | undefined): string {
  if (!raw) return "";
  let name = String(raw).trim();
  // Cut at common separators that usually precede marketing copy
  name = name.split(/\s+[\-|–—:•]\s+/)[0];
  // Remove parenthetical extras: "Notion (50% off)" -> "Notion"
  name = name.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*/g, " ");
  // Remove discount tokens like "30%", "$50", "USD 20"
  name = name.replace(/\b(?:\$|usd\s*|€|£)?\d+(?:\.\d+)?\s*%?(?:\s*off)?\b/gi, " ");
  // Remove deal-y stop words
  name = name.replace(/\b(deal|deals|coupon|coupons|promo|promotion|discount|offer|offers|sale|savings?|black\s*friday|cyber\s*monday|lifetime|ltd|exclusive|review|reviews|pricing|price)\b/gi, " ");
  // Collapse whitespace and trim residual punctuation
  name = name.replace(/[\-|–—:•]+/g, " ").replace(/\s+/g, " ").trim();
  name = name.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  return name;
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
}

function validateScrapeBody(body: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(["url", "formats", "onlyMainContent", "waitFor", "location"]);
  const sanitized: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) sanitized[key] = body[key];
  }
  const stripped = Object.keys(body).filter((k) => !allowed.has(k));
  if (stripped.length) console.warn("Stripped unrecognized scrape keys:", stripped.join(", "));
  if (!sanitized.url || typeof sanitized.url !== "string") throw new Error("scrape body missing required 'url'");
  return sanitized;
}

function validateCrawlBody(body: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(["url", "limit", "includePaths", "excludePaths", "scrapeOptions"]);
  const sanitized: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) sanitized[key] = body[key];
  }
  if (body.scrapeOptions && typeof body.scrapeOptions === "object") {
    const so = body.scrapeOptions as Record<string, unknown>;
    const soAllowed = new Set(["formats"]);
    const soSanitized: Record<string, unknown> = {};
    for (const key of soAllowed) {
      if (key in so) soSanitized[key] = so[key];
    }
    const soStripped = Object.keys(so).filter((k) => !soAllowed.has(k));
    if (soStripped.length) console.warn("Stripped unrecognized scrapeOptions keys:", soStripped.join(", "));
    sanitized.scrapeOptions = soSanitized;
  }
  const stripped = Object.keys(body).filter((k) => !allowed.has(k));
  if (stripped.length) console.warn("Stripped unrecognized crawl keys:", stripped.join(", "));
  if (!sanitized.url || typeof sanitized.url !== "string") throw new Error("crawl body missing required 'url'");
  return sanitized;
}

async function firecrawlScrape(apiKey: string, url: string) {
  const body = validateScrapeBody({ url, formats: ["markdown", "links"] });
  const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Firecrawl scrape failed (${res.status})`);
  const doc = json.data ?? json;
  return { markdown: doc?.markdown ?? "", links: doc?.links ?? [], url };
}

async function firecrawlCrawl(apiKey: string, url: string, limit: number) {
  const body = validateCrawlBody({ url, limit, scrapeOptions: { formats: ["markdown"] } });
  // Start crawl
  const startRes = await fetch(`${FIRECRAWL_V2}/crawl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const startJson = await startRes.json();
  if (!startRes.ok) throw new Error(startJson?.error || `Firecrawl crawl start failed`);
  const jobId = startJson.id || startJson.jobId;
  if (!jobId) throw new Error("Crawl job id missing");

  // Poll — return partial results if the crawl hasn't finished within our budget
  // so we still leave time for AI extraction inside the 150s edge timeout.
  const start = Date.now();
  let lastDocs: any[] = [];
  while (Date.now() - start < 60_000) {
    await new Promise((r) => setTimeout(r, 1500));
    const sRes = await fetch(`${FIRECRAWL_V2}/crawl/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const sJson = await sRes.json();
    if (Array.isArray(sJson?.data)) lastDocs = sJson.data;
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
  // Crawl timed out — return whatever pages we have so the request still succeeds
  return lastDocs.map((d: any) => ({
    markdown: d?.markdown ?? "",
    url: d?.metadata?.sourceURL ?? d?.metadata?.url ?? url,
    links: [],
  }));
}

async function extractDealsWithAI(apiKey: string, markdown: string, sourceUrl: string) {
  const truncated = markdown.slice(0, 18000);
  const systemPrompt = `You extract software / SaaS deals from web pages AND write rich product info, SEO meta + Schema.org JSON-LD for each. Output ONLY JSON.
Return: { "deals": [ {
  "product_name" (EXACT official brand name of the product as it appears on its own website — e.g. "Notion", "Adobe Photoshop", "ClickUp". DO NOT include marketing words like "Deal", "Coupon", "Promo", "Discount", "Black Friday", percentages, prices, taglines, or vendor names. Just the product name. If a tool has a clear sub-product name like "Adobe Photoshop" keep the full official name; otherwise prefer the shortest canonical brand name),
  "tagline" (1 short sentence, <=90 chars),
  "description" (rich markdown: 2-3 paragraphs about what the product does + the deal terms; include a "**Key features**" bullet list of 4-7 items, a "**Best for**" line naming the target audience, and a "**Pricing**" line summarizing normal vs discounted price if known),
  "discount_amount" (e.g. "30%" or "$50"),
  "discount_type" ("percent" or "fixed"),
  "coupon_code" (null if none),
  "deal_url" (absolute URL the user clicks to redeem),
  "merchant_domain" (bare domain like "notion.so" — never include http),
  "official_website" (homepage URL of the product),
  "logo_url" (direct URL to product logo if visible in the page, else null),
  "end_date" (ISO date or null),
  "category" (short label),
  "meta_title" (<=60 chars, includes product + discount),
  "meta_description" (<=155 chars, compelling, includes discount and CTA),
  "seo_keywords" (array of 4-7 short lowercase keyword phrases),
  "structured_data" (Schema.org Offer object: @context, @type "Offer", priceCurrency "USD", availability "https://schema.org/InStock", validThrough if end_date known, seller as Organization with product_name, plus an "itemOffered" Product node containing name, description (short) and image (logo_url if set))
} ] }
Only include real deals with a clear discount or promo. Skip generic blog text. If deal_url is relative, prefix with source URL origin. Keep descriptions factual based on the page content; do not invent features that are not implied.`;

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

async function resolveLogoUrl(candidate: string | null | undefined, domain: string | null): Promise<string | null> {
  if (candidate && /^https?:\/\//i.test(candidate)) {
    try {
      const r = await fetch(candidate, { method: "HEAD" });
      if (r.ok) return candidate;
    } catch { /* ignore */ }
  }
  if (domain) {
    const clearbit = `https://logo.clearbit.com/${domain}`;
    try {
      const r = await fetch(clearbit, { method: "HEAD" });
      if (r.ok) return clearbit;
    } catch { /* ignore */ }
  }
  return null;
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
    const { action, urls = [], mode = "scrape", crawl_limit = 20, resolve_logos = true } = body;

    // ---- Async helpers (shared by `start` and legacy `extract`) ----------
    type PageProgress = { url: string; stage: "pending" | "crawling" | "extracting" | "done" | "failed"; deals_found?: number; error?: string };

    const updateJob = async (id: string, patch: Record<string, unknown>) => {
      try { await supabase.from("deals_import_jobs").update(patch).eq("id", id); } catch (e) { console.warn("updateJob failed", e); }
    };

    // Run the full crawl + extraction pipeline, updating the job row as we go.
    // Returns the enriched deals on completion. Errors are written to the job.
    const runImportPipeline = async (
      jobId: string | null,
      jobUrls: string[],
      jobMode: "scrape" | "crawl",
      jobCrawlLimit: number,
      jobResolveLogos = true,
    ): Promise<any[]> => {
      const all: any[] = [];
      const sourcePages: Array<{ markdown: string; url: string }> = [];
      let pageProgress: PageProgress[] = [];

      const pushProgress = async () => {
        if (!jobId) return;
        await updateJob(jobId, {
          page_progress: pageProgress,
          pages_total: pageProgress.length,
          pages_done: pageProgress.filter((p) => p.stage === "done" || p.stage === "failed").length,
          deals_found: all.length,
        });
      };

      // Stage 1: discover pages
      if (jobId) await updateJob(jobId, { status: "running", stage: "crawling" });

      if (jobMode === "crawl" && jobUrls[0]) {
        try {
          const docs = await firecrawlCrawl(FIRECRAWL_API_KEY, jobUrls[0], jobCrawlLimit);
          sourcePages.push(...docs);
        } catch (e) {
          console.warn("Firecrawl crawl failed, falling back to plain fetch", e);
          try {
            const seed = await plainFetchScrape(jobUrls[0]);
            sourcePages.push(seed);
            const origin = new URL(jobUrls[0]).origin;
            const sameHost = seed.links
              .filter((l) => { try { return new URL(l).origin === origin; } catch { return false; } })
              .slice(0, Math.min(jobCrawlLimit - 1, 9));
            for (const u of sameHost) {
              try { sourcePages.push(await plainFetchScrape(u)); } catch (err) { console.warn("Fallback scrape error", u, err); }
            }
          } catch (err2) {
            console.warn("Plain fetch fallback also failed", err2);
            if (jobId) await updateJob(jobId, { error: `Crawl failed: ${(err2 as Error).message}` });
          }
        }
      } else {
        for (const u of jobUrls.slice(0, 10)) {
          try {
            const doc = await firecrawlScrape(FIRECRAWL_API_KEY, u);
            sourcePages.push(doc);
          } catch (e) {
            console.warn("Firecrawl scrape error, trying plain fetch", u, e);
            try {
              sourcePages.push(await plainFetchScrape(u));
            } catch (err2) {
              console.warn("Plain fetch fallback failed", u, err2);
            }
          }
        }
      }

      // Stage 2: extract
      const pages = sourcePages.filter((p) => p.markdown).slice(0, 25);
      pageProgress = pages.map((p) => ({ url: p.url, stage: "pending" as const }));
      if (jobId) await updateJob(jobId, { stage: "extracting", page_progress: pageProgress, pages_total: pages.length });

      const CONCURRENCY = 5;
      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, pages.length) }, async () => {
          while (cursor < pages.length) {
            const idx = cursor++;
            const page = pages[idx];
            pageProgress[idx].stage = "extracting";
            await pushProgress();
            try {
              const deals = await extractDealsWithAI(LOVABLE_API_KEY, page.markdown, page.url);
              for (const d of deals) all.push({ ...d, source_url: page.url });
              pageProgress[idx].stage = "done";
              pageProgress[idx].deals_found = deals.length;
            } catch (e) {
              console.warn("AI extract error", page.url, e);
              pageProgress[idx].stage = "failed";
              pageProgress[idx].error = (e as Error).message?.slice(0, 200);
            }
            await pushProgress();
          }
        }),
      );

      // Stage 3: enrich (link to products + dedupe)
      if (jobId) await updateJob(jobId, { stage: "enriching" });

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

      const dealUrls = all.map((d) => d.deal_url).filter(Boolean);
      const existingUrls = new Set<string>();
      if (dealUrls.length) {
        const { data: ex } = await supabase.from("deals").select("deal_url").in("deal_url", dealUrls);
        (ex || []).forEach((r: any) => existingUrls.add(r.deal_url));
      }

      const enriched = await Promise.all(all.map(async (d) => {
        const domain = extractDomain(d.merchant_domain) || extractDomain(d.deal_url) || extractDomain(d.official_website);
        const matched = domain ? productMap.get(domain) : null;
        const resolvedLogo = jobResolveLogos
          ? (matched?.logo_url || await resolveLogoUrl(d.logo_url, domain))
          : (matched?.logo_url || d.logo_url || null);
        const cleaned = cleanProductName(d.product_name);
        const finalName = matched?.name || cleaned || d.product_name;
        return {
          ...d,
          product_name: finalName,
          domain,
          logo_url: resolvedLogo,
          matched_product_id: matched?.id ?? null,
          matched_product_name: matched?.name ?? null,
          matched_logo_url: matched?.logo_url ?? null,
          already_exists: existingUrls.has(d.deal_url),
        };
      }));

      if (jobId) {
        await updateJob(jobId, {
          status: "completed",
          stage: "done",
          deals: enriched,
          deals_found: enriched.length,
          page_progress: pageProgress,
          pages_done: pageProgress.length,
        });
      }

      return enriched;
    };

    // ---- Action: start (async, returns job id immediately) -----------------
    if (action === "start") {
      let userId: string | null = null;
      try {
        const authHeader = req.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
          const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
          userId = data?.user?.id ?? null;
        }
      } catch { /* ignore */ }

      const { data: job, error: jobErr } = await supabase
        .from("deals_import_jobs")
        .insert({
          user_id: userId,
          mode,
          urls,
          crawl_limit,
          status: "queued",
          stage: "queued",
        })
        .select("id")
        .single();

      if (jobErr || !job) {
        return new Response(JSON.stringify({ success: false, error: jobErr?.message || "Failed to queue job" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fire and forget — keep the worker alive until the pipeline finishes.
      // @ts-ignore EdgeRuntime is provided at runtime
      EdgeRuntime.waitUntil((async () => {
        try {
          await runImportPipeline(job.id, urls, mode, crawl_limit);
        } catch (e) {
          console.error("pipeline error", e);
          await updateJob(job.id, { status: "failed", stage: "failed", error: (e as Error).message?.slice(0, 500) });
        }
      })());

      return new Response(JSON.stringify({ success: true, job_id: job.id }), {
        status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Legacy synchronous extract (kept for compatibility) ---------------
    if (action === "extract") {
      const enriched = await runImportPipeline(null, urls, mode, crawl_limit);
      return new Response(JSON.stringify({ success: true, deals: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "import") {
      const { deals = [] } = body;
      let inserted = 0;
      let skipped = 0;
      let productsCreated = 0;
      const errors: string[] = [];

      // Helper: ensure a unique product slug derived from the product name
      const ensureUniqueProductSlug = async (name: string): Promise<string> => {
        const base = slugify(name) || `product-${Date.now()}`;
        let candidate = base;
        let attempt = 0;
        while (attempt < 5) {
          const { data: existing } = await supabase
            .from("products")
            .select("id")
            .eq("slug", candidate)
            .maybeSingle();
          if (!existing) return candidate;
          attempt++;
          candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        }
        return `${base}-${Date.now().toString(36)}`;
      };

      for (const d of deals) {
        if (!d.product_name || !d.deal_url) {
          skipped++;
          continue;
        }

        // Always store the clean official brand name (used for display + slug)
        const cleanName = cleanProductName(d.product_name) || d.product_name;

        // Auto-create the product when the deal isn't linked to one — slug is
        // derived from the clean product name so URLs look like /product/<product-name>
        let productId: string | null = d.matched_product_id || d.product_id || null;
        if (!productId) {
          try {
            const productSlug = await ensureUniqueProductSlug(cleanName);
            const websiteUrl = d.official_website || (d.domain ? `https://${d.domain}` : null);
            const { data: created, error: pErr } = await supabase
              .from("products")
              .insert({
                name: cleanName,
                slug: productSlug,
                tagline: d.description ? String(d.description).slice(0, 160) : null,
                description: d.description || null,
                logo_url: d.logo_url || d.matched_logo_url || null,
                website_url: websiteUrl,
                status: "pending",
                is_published: false,
              })
              .select("id, slug")
              .single();
            if (pErr) {
              errors.push(`${d.product_name} (product): ${pErr.message}`);
            } else if (created) {
              productId = created.id;
              productsCreated++;
            }
          } catch (e: any) {
            errors.push(`${d.product_name} (product): ${e?.message || "create failed"}`);
          }
        }

        const baseSlug = slugify(`${cleanName}-${d.discount_amount || "deal"}`);
        let slug = baseSlug || `deal-${Date.now()}`;

        const record: any = {
          product_name: cleanName,
          slug,
          logo_url: d.logo_url || d.matched_logo_url || null,
          description: d.description || null,
          deal_url: d.deal_url,
          discount_amount: d.discount_amount || null,
          discount_type: d.discount_type || "percent",
          coupon_code: d.coupon_code || null,
          category: d.category || null,
          end_date: d.end_date || null,
          product_id: productId,
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

      return new Response(JSON.stringify({ success: true, inserted, skipped, products_created: productsCreated, errors }), {
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
