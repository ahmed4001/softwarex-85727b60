import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ALL 81 public tables to export (ordered by dependency)
const TABLES = [
  "categories",
  "products",
  "reviews",
  "comparisons",
  "alternatives",
  "alternative_pages",
  "advertisements",
  "activity_logs",
  "price_alerts",
  "alert_history",
  "award_categories",
  "award_nominations",
  "award_votes",
  "badges",
  "blog_posts",
  "brevo_accounts",
  "brevo_campaigns",
  "buyer_guides",
  "buyer_guide_completions",
  "category_trend_reports",
  "changelog_subscriptions",
  "competitive_battlecards",
  "digest_logs",
  "discussions",
  "discussion_replies",
  "discussion_votes",
  "email_templates",
  "glossary_terms",
  "list_items",
  "list_votes",
  "lists",
  "media_library",
  "moderation_queue",
  "newsletter_subscribers",
  "notification_preferences",
  "notifications",
  "pages",
  "point_transactions",
  "pricing_features",
  "pricing_tier_features",
  "product_changelogs",
  "product_pricing_tiers",
  "profiles",
  // New tables added for complete migration
  "affiliate_clicks",
  "partner_applications",
  "partner_links",
  "product_claims",
  "product_integrations",
  "product_watches",
  "referral_links",
  "referral_events",
  "referral_payouts",
  "referrals",
  "review_comments",
  "review_digests",
  "review_media",
  "review_qa",
  "review_qa_votes",
  "review_reactions",
  "review_votes",
  "reviewer_verifications",
  "saved_products",
  "seo_landing_pages",
  "site_settings",
  "sponsored_bids",
  "tech_stacks",
  "tech_stack_items",
  "tech_stack_votes",
  "ui_translations",
  "user_achievements",
  "user_badges",
  "user_follows",
  "user_recommendations",
  "user_roles",
  "vendor_deals",
  "vendor_leads",
  "vendor_responses",
  "vendor_sponsored_requests",
  "vendor_submissions",
  "vendor_subscriptions",
];

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function rowToInsert(table: string, row: Record<string, unknown>): string {
  const cols = Object.keys(row);
  const vals = cols.map((c) => escapeSQL(row[c]));
  return `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT DO NOTHING;`;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mode = "all", table: singleTable, offset = 0, limit = 5000 } = await req.json().catch(() => ({}));

    // MODE: list_storage — list all files in product-images bucket
    if (mode === "list_storage") {
      const buckets = ["product-images", "review-media", "email-assets"];
      const allFiles: { bucket: string; name: string; url: string }[] = [];

      for (const bucket of buckets) {
        let storageOffset = 0;
        const storageLimit = 1000;
        while (true) {
          const { data: files, error } = await supabase.storage
            .from(bucket)
            .list("", { limit: storageLimit, offset: storageOffset });
          if (error) { console.error(`Storage error for ${bucket}:`, error); break; }
          if (!files || files.length === 0) break;
          for (const f of files) {
            if (f.id) {
              const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(f.name);
              allFiles.push({ bucket, name: f.name, url: urlData.publicUrl });
            }
          }
          storageOffset += storageLimit;
          if (files.length < storageLimit) break;
        }
      }

      return new Response(JSON.stringify({ files: allFiles, count: allFiles.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MODE: single table export
    if (mode === "table" && singleTable) {
      const { data, error, count } = await supabase
        .from(singleTable)
        .select("*", { count: "exact" })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      const inserts = (data || []).map((row: Record<string, unknown>) => rowToInsert(singleTable, row));
      return new Response(
        JSON.stringify({
          table: singleTable,
          rows: data?.length || 0,
          total: count,
          has_more: (offset + limit) < (count || 0),
          next_offset: offset + limit,
          sql: inserts.join("\n"),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MODE: summary — show row counts for all tables
    if (mode === "summary") {
      const summary: { table: string; count: number }[] = [];
      for (const t of TABLES) {
        try {
          const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
          summary.push({ table: t, count: error ? -1 : (count || 0) });
        } catch {
          summary.push({ table: t, count: -1 });
        }
      }
      const total = summary.reduce((s, t) => s + Math.max(t.count, 0), 0);
      return new Response(
        JSON.stringify({ tables: summary, total_rows: total, table_count: summary.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MODE: all — export all tables (careful: can be large)
    const allSQL: string[] = [];
    const stats: { table: string; rows: number }[] = [];

    for (const t of TABLES) {
      try {
        let tableOffset = 0;
        let tableRows = 0;
        while (true) {
          const { data, error } = await supabase.from(t).select("*").range(tableOffset, tableOffset + 999);
          if (error) { console.error(`Error exporting ${t}:`, error.message); break; }
          if (!data || data.length === 0) break;
          for (const row of data) {
            allSQL.push(rowToInsert(t, row as Record<string, unknown>));
          }
          tableRows += data.length;
          tableOffset += 1000;
          if (data.length < 1000) break;
        }
        stats.push({ table: t, rows: tableRows });
      } catch (e) {
        console.error(`Failed on table ${t}:`, e);
        stats.push({ table: t, rows: -1 });
      }
    }

    return new Response(
      JSON.stringify({ stats, total_inserts: allSQL.length, sql: allSQL.join("\n") }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("export-database error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
