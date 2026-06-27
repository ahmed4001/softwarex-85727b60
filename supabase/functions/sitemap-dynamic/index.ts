// Dynamic sitemap for blog, guides, and glossary.
// Serves fresh XML from the DB so newly created/updated content shows up
// without redeploying. Pair with `resubmit-sitemaps` to ping Google.
import { createClient } from "npm:@supabase/supabase-js@2";

const BASE_URL = "https://reviewhunts.com";

type Type = "blog" | "guides" | "glossary";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const XML = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
  "X-Robots-Tag": "noindex",
  ...CORS,
};

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildUrlset(entries: { loc: string; lastmod?: string; priority?: string }[]) {
  const body = entries
    .map((e) =>
      [
        "  <url>",
        `    <loc>${xmlEscape(e.loc)}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
        e.priority ? `    <priority>${e.priority}</priority>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function loadEntries(supabase: ReturnType<typeof createClient>, type: Type) {
  const today = new Date().toISOString().split("T")[0];
  if (type === "blog") {
    const { data } = await supabase
      .from("blog_posts")
      .select("slug,updated_at")
      .eq("status", "published")
      .limit(5000);
    return (data ?? []).map((r: any) => ({
      loc: `${BASE_URL}/blog/${r.slug}`,
      lastmod: (r.updated_at ?? "").split("T")[0] || today,
      priority: "0.7",
    }));
  }
  if (type === "guides") {
    const { data } = await supabase.from("buyer_guides").select("slug,updated_at").limit(5000);
    return (data ?? []).map((r: any) => ({
      loc: `${BASE_URL}/guides/${r.slug}`,
      lastmod: (r.updated_at ?? "").split("T")[0] || today,
      priority: "0.7",
    }));
  }
  const { data } = await supabase.from("glossary_terms").select("slug,updated_at").limit(5000);
  return (data ?? []).map((r: any) => ({
    loc: `${BASE_URL}/glossary/${r.slug}`,
    lastmod: (r.updated_at ?? "").split("T")[0] || today,
    priority: "0.5",
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const rawType = (url.searchParams.get("type") ?? "").toLowerCase();
  const type = (["blog", "guides", "glossary"].includes(rawType) ? rawType : null) as Type | null;
  if (!type) {
    return new Response("invalid type", { status: 400, headers: CORS });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const entries = await loadEntries(supabase, type);
    return new Response(buildUrlset(entries), { headers: XML });
  } catch (e) {
    console.error("[sitemap-dynamic] error", e);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>`, {
      headers: XML,
      status: 200,
    });
  }
});
