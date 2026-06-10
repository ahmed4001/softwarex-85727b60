// Backfills products.website_url by searching the official website via Firecrawl.
// POST body: { limit?: number, dry_run?: boolean, ids?: string[] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_HOSTS = [
  "wikipedia.org", "youtube.com", "youtu.be", "linkedin.com", "facebook.com",
  "twitter.com", "x.com", "instagram.com", "reddit.com", "medium.com",
  "g2.com", "capterra.com", "trustpilot.com", "getapp.com", "producthunt.com",
  "softwareadvice.com", "crozdesk.com", "saasworthy.com", "gartner.com",
  "github.com", "play.google.com", "apps.apple.com", "amazon.com",
  "pinterest.com", "quora.com", "slideshare.net", "glassdoor.com",
  "crunchbase.com", "bloomberg.com", "forbes.com", "techcrunch.com",
];

// Generic English words that are clearly NOT product names — skip outright.
const JUNK_NAMES = new Set([
  "pros", "cons", "first", "affordable", "real", "must", "key", "support",
  "sales", "integration", "scalable", "hospitality", "conclusion", "gdpr",
  "cloud-based", "highly customizable", "api integrations", "time tracking",
  "expense tracking", "real-time collaboration", "tax compliance",
  "automatic tax calculation", "customizable invoices", "ai-driven analytics",
  "payment provider support", "automated financial reporting",
  "multi-tier commissions", "agentless scanning", "ad trackers",
  "affiliate marketing", "key strength", "summary", "overview", "features",
  "pricing", "free", "freemium", "enterprise", "starter", "basic", "premium",
]);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickBestUrl(
  name: string,
  results: any[],
): { url: string | null; host: string | null; confidence: number; candidates: any[] } {
  const slug = slugify(name);
  const candidates: any[] = [];
  let best: { url: string; host: string; confidence: number } | null = null;

  for (const r of results || []) {
    const url: string = r?.url || "";
    if (!url) continue;
    let host = "";
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
    catch { continue; }
    const blocked = BLOCKED_HOSTS.some((b) => host === b || host.endsWith("." + b));
    const rootSlug = slugify(host.split(".")[0]);
    let confidence = 0;
    if (!blocked && slug.length >= 3 && rootSlug.length >= 3) {
      if (rootSlug === slug) confidence = 1;
      else if (rootSlug.includes(slug) || slug.includes(rootSlug)) confidence = 0.7;
      else if (rootSlug.startsWith(slug.slice(0, 4)) || slug.startsWith(rootSlug.slice(0, 4))) confidence = 0.4;
    }
    candidates.push({ url, host, blocked, confidence });
    if (!blocked && confidence >= 0.7 && (!best || confidence > best.confidence)) {
      best = { url: `https://${host}`, host, confidence };
    }
  }
  return best
    ? { url: best.url, host: best.host, confidence: best.confidence, candidates }
    : { url: null, host: null, confidence: 0, candidates };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 25, 100);
    const dryRun = Boolean(body.dry_run);
    const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;

    let q = supabase
      .from("products")
      .select("id, name, slug")
      .or("website_url.is.null,website_url.eq.")
      .limit(limit);
    if (ids?.length) q = q.in("id", ids);
    const { data: rowsRaw, error } = await q;
    if (error) throw error;

    // Skip products we've already attempted in a prior run (any status).
    let rows = rowsRaw || [];
    if (rows.length && !ids?.length) {
      const idList = rows.map((r: any) => r.id);
      const { data: tried } = await supabase
        .from("backfill_match_log")
        .select("product_id")
        .in("product_id", idList);
      const triedSet = new Set((tried || []).map((t: any) => t.product_id));
      rows = rows.filter((r: any) => !triedSet.has(r.id));
    }


    const results: any[] = [];

    for (const p of rows || []) {
      const name = String(p.name || "").trim();
      const lower = name.toLowerCase();
      const query = `${name} official website software`;

      const logEntry: Record<string, any> = {
        product_id: p.id,
        product_name: name,
        source_query: query,
        previous_url: null,
      };

      if (!name || name.length < 2 || JUNK_NAMES.has(lower)) {
        results.push({ id: p.id, name, status: "skipped", reason: "junk/short name" });
        await supabase.from("backfill_match_log").insert({
          ...logEntry, status: "skipped", reason: "junk/short name",
        });
        continue;
      }

      try {
        const res = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, limit: 5 }),
        });
        const data = await res.json();
        if (!res.ok) {
          results.push({ id: p.id, name, status: "error", reason: data?.error || res.statusText });
          await supabase.from("backfill_match_log").insert({
            ...logEntry, status: "error", reason: data?.error || res.statusText,
          });
          continue;
        }
        const list = data?.data?.web || data?.web || data?.data || [];
        const pick = pickBestUrl(name, Array.isArray(list) ? list : []);

        if (!pick.url) {
          results.push({ id: p.id, name, status: "no_match" });
          await supabase.from("backfill_match_log").insert({
            ...logEntry, status: "no_match", confidence: 0, candidates: pick.candidates,
          });
          continue;
        }

        if (!dryRun) {
          const { error: upErr } = await supabase
            .from("products").update({ website_url: pick.url }).eq("id", p.id);
          if (upErr) {
            results.push({ id: p.id, name, status: "error", reason: upErr.message });
            await supabase.from("backfill_match_log").insert({
              ...logEntry, status: "error", reason: upErr.message,
              matched_url: pick.url, matched_domain: pick.host,
              confidence: pick.confidence, candidates: pick.candidates,
            });
            continue;
          }
        }
        results.push({ id: p.id, name, status: dryRun ? "match" : "updated", website_url: pick.url, confidence: pick.confidence });
        await supabase.from("backfill_match_log").insert({
          ...logEntry,
          status: dryRun ? "match" : "updated",
          matched_url: pick.url,
          matched_domain: pick.host,
          confidence: pick.confidence,
          candidates: pick.candidates,
        });
      } catch (e) {
        results.push({ id: p.id, name, status: "error", reason: String(e) });
        await supabase.from("backfill_match_log").insert({
          ...logEntry, status: "error", reason: String(e),
        });
      }
      // gentle rate limit
      await new Promise((r) => setTimeout(r, 400));
    }


    const summary = {
      total: results.length,
      updated: results.filter((r) => r.status === "updated").length,
      no_match: results.filter((r) => r.status === "no_match").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
    };
    return new Response(JSON.stringify({ success: true, dry_run: dryRun, summary, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
