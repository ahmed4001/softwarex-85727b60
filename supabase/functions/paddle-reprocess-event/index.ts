// Admin-only: re-runs the subscription mutation logic for a stored webhook event.
// Looks up the event in paddle_webhook_events, deletes the dedupe row, then
// reprocesses using the stored payload.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACTIVATE_EVENTS = new Set([
  "transaction.completed",
  "subscription.activated",
  "subscription.created",
  "subscription.updated",
  "subscription.resumed",
]);
const CANCEL_EVENTS = new Set(["subscription.canceled"]);
const PAST_DUE_EVENTS = new Set(["subscription.past_due", "subscription.paused"]);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const { data: userData } = await authed.auth.getUser();
    const user = userData.user;
    if (!user) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isSuper } = await admin.rpc("has_role", { _user_id: user.id, _role: "superadmin" });
    if (!isAdmin && !isSuper) return json({ error: "forbidden" }, 403);

    const { event_id } = await req.json();
    if (!event_id || typeof event_id !== "string") return json({ error: "event_id required" }, 400);

    const { data: evt, error: evtErr } = await admin
      .from("paddle_webhook_events")
      .select("*")
      .eq("event_id", event_id)
      .maybeSingle();
    if (evtErr) throw evtErr;
    if (!evt) return json({ error: "event not found" }, 404);
    if (!evt.payload) return json({ error: "event has no stored payload — cannot reprocess" }, 400);

    const payload: any = evt.payload;
    const eventType: string = payload?.event_type || evt.event_type || "";
    const data = payload?.data || {};
    const custom = data?.custom_data || {};
    const userId: string | undefined = custom.user_id || evt.user_id;
    const plan: string | undefined = custom.plan || evt.plan;
    if (!userId || !plan) return json({ error: "payload missing user_id/plan" }, 400);

    const periodEnd: string | null =
      data?.current_billing_period?.ends_at || data?.billing_period?.ends_at || data?.next_billed_at || null;
    const paddleSubId: string | null = data?.subscription_id || (data?.id?.toString().startsWith("sub_") ? data.id : null);
    const paddleCustomerId: string | null = data?.customer_id || null;
    const paddlePriceId: string | null = data?.items?.[0]?.price?.id || data?.items?.[0]?.price_id || null;

    const now = new Date().toISOString();
    const actions: string[] = [];

    if (ACTIVATE_EVENTS.has(eventType)) {
      const patch: Record<string, unknown> = {
        plan, status: "active", last_event_at: now, canceled_at: null,
      };
      if (periodEnd) { patch.current_period_end = periodEnd; patch.expires_at = periodEnd; }
      if (paddleSubId) patch.paddle_subscription_id = paddleSubId;
      if (paddleCustomerId) patch.paddle_customer_id = paddleCustomerId;
      if (paddlePriceId) patch.paddle_price_id = paddlePriceId;

      let updatedId: string | null = null;
      if (paddleSubId) {
        const { data: row } = await admin
          .from("vendor_subscriptions").update(patch)
          .eq("paddle_subscription_id", paddleSubId).select("id").maybeSingle();
        updatedId = row?.id ?? null;
      }
      if (!updatedId) {
        const { data: row } = await admin
          .from("vendor_subscriptions").update(patch)
          .eq("user_id", userId).in("status", ["active", "past_due"]).select("id").maybeSingle();
        updatedId = row?.id ?? null;
      }
      if (!updatedId) {
        await admin.from("vendor_subscriptions").insert({ user_id: userId, ...patch });
        actions.push("inserted");
      } else {
        actions.push("updated");
      }
    } else if (PAST_DUE_EVENTS.has(eventType)) {
      await admin.from("vendor_subscriptions")
        .update({ status: "past_due", last_event_at: now })
        .eq("user_id", userId).eq("status", "active");
      actions.push("past_due");
    } else if (CANCEL_EVENTS.has(eventType)) {
      await admin.from("vendor_subscriptions")
        .update({ status: "canceled", canceled_at: now, last_event_at: now })
        .eq("user_id", userId).in("status", ["active", "past_due"]);
      actions.push("canceled");
    } else {
      return json({ ok: true, note: `event_type ${eventType} has no action` });
    }

    return json({ ok: true, event_id, event_type: eventType, user_id: userId, plan, actions });
  } catch (err: any) {
    console.error("paddle-reprocess-event error", err);
    return json({ error: err.message }, 500);
  }
});
