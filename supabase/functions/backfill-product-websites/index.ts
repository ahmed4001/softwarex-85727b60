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

function pickBestUrl(name: string, results: any[]): string | null {
  const slug = slugify(name);
  if (slug.length < 3) return null;
  for (const r of results || []) {
    const url: string = r?.url || "";
    if (!url) continue;
    let host = "";
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
    catch { continue; }
    if (BLOCKED_HOSTS.some((b) => host === b || host.endsWith("." + b))) continue;
    const rootSlug = slugify(host.split(".")[0]);
    // Confidence: host root contains slugified product name, or vice versa.
    if (rootSlug.includes(slug) || slug.includes(rootSlug)) {
      return `https://${host}`;
    }
  }
  return null;
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
    const { data: rows, error } = await q;
    if (error) throw error;

    const results: any[] = [];

    for (const p of rows || []) {
      const name = String(p.name || "").trim();
      const lower = name.toLowerCase();
      if (!name || name.length < 2 || JUNK_NAMES.has(lower)) {
        results.push({ id: p.id, name, status: "skipped", reason: "junk/short name" });
        continue;
      }

      try {
        const res = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: `${name} official website software`, limit: 5 }),
        });
        const data = await res.json();
        if (!res.ok) {
          results.push({ id: p.id, name, status: "error", reason: data?.error || res.statusText });
          continue;
        }
        const list = data?.data?.web || data?.web || data?.data || [];
        const url = pickBestUrl(name, Array.isArray(list) ? list : []);
        if (!url) {
          results.push({ id: p.id, name, status: "no_match" });
          continue;
        }
        if (!dryRun) {
          const { error: upErr } = await supabase
            .from("products").update({ website_url: url }).eq("id", p.id);
          if (upErr) {
            results.push({ id: p.id, name, status: "error", reason: upErr.message });
            continue;
          }
        }
        results.push({ id: p.id, name, status: "updated", website_url: url });
      } catch (e) {
        results.push({ id: p.id, name, status: "error", reason: String(e) });
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
