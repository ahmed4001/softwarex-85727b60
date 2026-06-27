// Resubmits blog/guides/glossary sitemaps to Google Search Console.
// Triggered by DB triggers on content change, a daily cron job, and an
// admin "Resubmit now" button. Idempotent — safe to call repeatedly.
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
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gscKey,
    },
  });
  const body = res.ok ? "" : await res.text().catch(() => "");
  return { sitemapUrl, ok: res.ok, status: res.status, error: body || undefined };
}

async function pingIndexNow(slugUrl: string) {
  // Best-effort, non-blocking. IndexNow accepts anonymous pings for known hosts.
  try {
    await fetch(`https://www.bing.com/indexnow?url=${encodeURIComponent(slugUrl)}`);
  } catch (_) { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: { type?: string; slug?: string } = {};
  try { body = await req.json(); } catch (_) { /* allow empty */ }
  const type = (body.type ?? "all").toLowerCase();

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

  const results = [];
  for (const u of targets) {
    results.push(await submitOne(u));
  }

  if (body.slug && type !== "all" && SITEMAPS[type]) {
    const route = type === "guides" ? "guides" : type === "glossary" ? "glossary" : "blog";
    await pingIndexNow(`${BASE}/${route}/${body.slug}`);
  }

  // Log to digest_logs (reuse existing table to avoid schema churn)
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("digest_logs").insert({
      // @ts-ignore — schema may vary; only metadata field matters here
      metadata: { kind: "sitemap_resubmit", type, slug: body.slug ?? null, results },
    } as any);
  } catch (_) { /* logging is best-effort */ }

  return new Response(JSON.stringify({ ok: true, type, results }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
