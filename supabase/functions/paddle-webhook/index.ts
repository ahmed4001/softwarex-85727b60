import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const eventType: string = payload?.event_type || "";
    const data = payload?.data || {};
    const custom = data?.custom_data || {};
    const userId: string | undefined = custom.user_id;
    const plan: string | undefined = custom.plan;

    if (!userId || !plan) {
      return new Response(JSON.stringify({ ok: true, skipped: "no custom_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (
      eventType === "transaction.completed" ||
      eventType === "subscription.activated" ||
      eventType === "subscription.created"
    ) {
      const { data: existing } = await supabase
        .from("vendor_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        await supabase.from("vendor_subscriptions").update({ plan }).eq("id", existing.id);
      } else {
        await supabase.from("vendor_subscriptions").insert({ user_id: userId, plan, status: "active" });
      }
    } else if (eventType === "subscription.canceled") {
      await supabase
        .from("vendor_subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", userId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("paddle-webhook error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
