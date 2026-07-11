import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find all scheduled posts whose scheduled_at is in the past
    const now = new Date().toISOString();
    const { data: posts, error: fetchError } = await supabase
      .from("blog_posts")
      .select("id, title")
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now);

    if (fetchError) throw fetchError;

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = posts.map((p) => p.id);
    const { error: updateError } = await supabase
      .from("blog_posts")
      .update({ status: "published", published_at: now })
      .in("id", ids);

    if (updateError) throw updateError;

    console.log(`Published ${ids.length} scheduled post(s):`, posts.map(p => p.title));

    return new Response(JSON.stringify({ published: ids.length, posts: posts.map(p => p.title) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Publish scheduled posts error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
