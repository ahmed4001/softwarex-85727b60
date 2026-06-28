// Resubmits blog/guides/glossary sitemaps to Google Search Console.
// Triggered by DB triggers on content change, a daily cron job, and an
// admin "Resubmit now" button. Idempotent — safe to call repeatedly.
// Every attempt is logged to public.sitemap_resubmission_log so admins
// can see when each sitemap was last regenerated and whether the push
// to Google succeeded or failed.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*, authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "sc-domain:reviewhunts.com";
const BASE = "https://reviewhunts.com";
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

const SITEMAPS: Record<string, string> = {
  blog: `${BASE}/sitemap-blog.xml`,
  guides: `${BASE}/sitemap-guides.xml`,
  glossary: `${BASE}/sitemap-glossary.xml`,
};

async function submitOne(sitemapUrl: string) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gscKey = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");
  if (!lovableKey || !gscKey) {
    return { sitemapUrl, ok: false, status: 0, error: "missing connector secrets" };
  }
  const path = `/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  try {
    const res = await fetch(`${GATEWAY}${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gscKey,
      },
    });
    const body = res.ok ? "" : await res.text().catch(() => "");
    return { sitemapUrl, ok: res.ok, status: res.status, error: body || undefined };
  } catch (e) {
    return { sitemapUrl, ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function pingIndexNow(slugUrl: string) {
  try {
    await fetch(`https://www.bing.com/indexnow?url=${encodeURIComponent(slugUrl)}`);
  } catch (_) { /* ignore */ }
}

function typeFromUrl(url: string): string {
  for (const [k, v] of Object.entries(SITEMAPS)) if (v === url) return k;
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: { type?: string; slug?: string; source?: string } = {};
  try { body = await req.json(); } catch (_) { /* allow empty */ }
  const type = (body.type ?? "all").toLowerCase();
  const source = (body.source ?? "manual").toLowerCase();

  const targets =
    type === "all"
      ? Object.values(SITEMAPS)
      : SITEMAPS[type]
        ? [SITEMAPS[type]]
        : [];

  if (!targets.length) {
    return new Response(JSON.stringify({ error: `unknown type: ${type}` }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ sitemapUrl: string; ok: boolean; status: number; error?: string }> = [];
  for (const u of targets) {
    results.push(await submitOne(u));
  }

  if (body.slug && type !== "all" && SITEMAPS[type]) {
    const route = type === "guides" ? "guides" : type === "glossary" ? "glossary" : "blog";
    await pingIndexNow(`${BASE}/${route}/${body.slug}`);
  }

  // Log each sitemap attempt to public.sitemap_resubmission_log
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rows = results.map((r) => ({
      sitemap_type: typeFromUrl(r.sitemapUrl),
      source,
      target_url: r.sitemapUrl,
      status_code: r.status,
      success: r.ok,
      error: r.error ?? null,
      trigger_slug: body.slug ?? null,
      results: r as any,
    }));
    if (rows.length) {
      await supabase.from("sitemap_resubmission_log").insert(rows as any);
    }
  } catch (e) {
    console.error("sitemap log insert failed", e);
  }

  return new Response(JSON.stringify({ ok: true, type, source, results }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
