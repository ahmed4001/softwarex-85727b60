import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Get users who want weekly digest
    const { data: prefs } = await sb
      .from("notification_preferences")
      .select("user_id")
      .eq("weekly_digest", true);

    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = prefs.map((p: any) => p.user_id);
    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, email, name")
      .in("user_id", userIds);

    // Get trending products (last 7 days by view_count)
    const { data: trending } = await sb
      .from("products")
      .select("name, slug, avg_rating, total_reviews")
      .eq("is_active", true)
      .order("view_count", { ascending: false })
      .limit(5);

    // Get recent reviews
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentReviews } = await sb
      .from("reviews")
      .select("title, overall_rating, products!reviews_product_id_fkey(name)")
      .eq("status", "approved")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    // Get best brevo account
    const { data: brevoId } = await sb.rpc("get_best_brevo_account");
    if (!brevoId) {
      return new Response(JSON.stringify({ error: "No available Brevo account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: brevoAccount } = await sb
      .from("brevo_accounts")
      .select("api_key")
      .eq("id", brevoId)
      .single();

    if (!brevoAccount?.api_key) {
      return new Response(JSON.stringify({ error: "Brevo API key not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email HTML
    const trendingHtml = (trending || [])
      .map((p: any) => `<li><strong>${p.name}</strong> — ★${Number(p.avg_rating).toFixed(1)} (${p.total_reviews} reviews)</li>`)
      .join("");

    const reviewsHtml = (recentReviews || [])
      .map((r: any) => `<li>"${r.title || "Untitled"}" — ${r.products?.name} (${r.overall_rating}/5)</li>`)
      .join("");

    const htmlContent = `
      <html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h1 style="color:#0d9488;">📊 Weekly Software Digest</h1>
        <h2>🔥 Trending Products</h2>
        <ul>${trendingHtml || "<li>No trending products this week</li>"}</ul>
        <h2>⭐ Recent Reviews</h2>
        <ul>${reviewsHtml || "<li>No new reviews this week</li>"}</ul>
        <p style="color:#666;font-size:12px;margin-top:30px;">You're receiving this because you opted in to weekly digests.</p>
      </body></html>
    `;

    // Send via Brevo
    const recipients = (profiles || [])
      .filter((p: any) => p.email)
      .map((p: any) => ({ email: p.email, name: p.name || "User" }));

    if (recipients.length > 0) {
      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoAccount.api_key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "ReviewHunts", email: "digest@reviewhunts.com" },
          subject: "Your Weekly Software Digest 📊",
          htmlContent,
          messageVersions: recipients.map((r: any) => ({
            to: [r],
          })),
        }),
      });

      if (!brevoRes.ok) {
        const errText = await brevoRes.text();
        console.error("Brevo error:", errText);
      }

      // Update credits
      await sb
        .from("brevo_accounts")
        .update({
          credits_used_today: (await sb.from("brevo_accounts").select("credits_used_today").eq("id", brevoId).single()).data?.credits_used_today + recipients.length,
          total_emails_sent: (await sb.from("brevo_accounts").select("total_emails_sent").eq("id", brevoId).single()).data?.total_emails_sent + recipients.length,
        })
        .eq("id", brevoId);
    }

    // Log
    await sb.from("digest_logs").insert({
      recipient_count: recipients.length,
      status: "sent",
    });

    return new Response(JSON.stringify({ sent: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
