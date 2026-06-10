// Daily reconciliation: pull subscription state from Paddle for every local
// active/past_due row that has a paddle_subscription_id, patch drift, log it,
// and raise an alert if a customer has 3+ drift events in the past 14 days.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PADDLE_API_KEY = (Deno.env.get("PADDLE_API_KEY") || "").trim();
const PADDLE_ENV = (Deno.env.get("PADDLE_ENVIRONMENT") || "sandbox").trim().toLowerCase();
const PADDLE_BASE =
  PADDLE_ENV === "live" || PADDLE_ENV === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

const PRICE_TO_PLAN: Record<string, string> = {};
for (const [plan, env] of [
  ["featured", "PADDLE_PRICE_FEATURED"],
  ["promotion", "PADDLE_PRICE_PROMOTION"],
  ["premium", "PADDLE_PRICE_PREMIUM"],
] as const) {
  const v = Deno.env.get(env)?.trim();
  if (v) PRICE_TO_PLAN[v] = plan;
}

function mapStatus(s: string): "active" | "past_due" | "canceled" {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "paused":
      return "past_due";
    case "canceled":
    default:
      return "canceled";
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!PADDLE_API_KEY) return json({ error: "PADDLE_API_KEY not configured" }, 500);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const summary = { checked: 0, patched: 0, errors: 0, alerts: 0, details: [] as unknown[] };

  try {
    const { data: rows, error } = await supabase
      .from("vendor_subscriptions")
      .select("id, user_id, plan, status, paddle_subscription_id, current_period_end")
      .not("paddle_subscription_id", "is", null)
      .in("status", ["active", "past_due"]);
    if (error) throw error;

    for (const row of rows ?? []) {
      summary.checked++;
      try {
        const resp = await fetch(`${PADDLE_BASE}/subscriptions/${row.paddle_subscription_id}`, {
          headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
        });
        if (!resp.ok) {
          summary.errors++;
          summary.details.push({ sub: row.paddle_subscription_id, error: `HTTP ${resp.status}` });
          await resp.text();
          continue;
        }
        const body = await resp.json();
        const remote = body?.data;
        if (!remote) continue;

        const remoteStatus = mapStatus(remote.status || "");
        const remotePeriodEnd: string | null = remote?.current_billing_period?.ends_at || remote?.next_billed_at || null;
        const remotePriceId: string | null = remote?.items?.[0]?.price?.id || remote?.items?.[0]?.price_id || null;
        const remotePlan = remotePriceId ? PRICE_TO_PLAN[remotePriceId] : undefined;

        const patch: Record<string, unknown> = {};
        const changed: string[] = [];
        if (remoteStatus !== row.status) { patch.status = remoteStatus; changed.push("status"); }
        if (remoteStatus === "canceled") patch.canceled_at = new Date().toISOString();
        if (remotePlan && remotePlan !== row.plan) { patch.plan = remotePlan; changed.push("plan"); }
        if (remotePeriodEnd && remotePeriodEnd !== (row.current_period_end as string | null)) {
          patch.current_period_end = remotePeriodEnd;
          patch.expires_at = remotePeriodEnd;
          changed.push("current_period_end");
        }

        if (changed.length > 0) {
          patch.last_event_at = new Date().toISOString();
          const { error: upErr } = await supabase.from("vendor_subscriptions").update(patch).eq("id", row.id);
          if (upErr) {
            summary.errors++;
            summary.details.push({ sub: row.paddle_subscription_id, error: upErr.message });
            continue;
          }
          summary.patched++;
          summary.details.push({ sub: row.paddle_subscription_id, patched: changed });

          // Log the drift event
          await supabase.from("paddle_drift_events").insert({
            user_id: row.user_id,
            paddle_subscription_id: row.paddle_subscription_id,
            fields_changed: changed,
            details: {
              before: { status: row.status, plan: row.plan, current_period_end: row.current_period_end },
              after: { status: remoteStatus, plan: remotePlan ?? row.plan, current_period_end: remotePeriodEnd },
            },
          });

          // Repeated-drift alert: 3+ drift events in past 14 days for this sub
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const { count } = await supabase
            .from("paddle_drift_events")
            .select("id", { count: "exact", head: true })
            .eq("paddle_subscription_id", row.paddle_subscription_id)
            .gte("created_at", fourteenDaysAgo);
          if ((count ?? 0) >= 3) {
            // Don't spam — only alert if no unresolved alert exists for this sub already.
            const { data: existing } = await supabase
              .from("paddle_alerts")
              .select("id")
              .eq("kind", "repeated_drift")
              .eq("paddle_subscription_id", row.paddle_subscription_id)
              .is("resolved_at", null)
              .maybeSingle();
            if (!existing) {
              await supabase.from("paddle_alerts").insert({
                kind: "repeated_drift",
                severity: "warning",
                user_id: row.user_id,
                paddle_subscription_id: row.paddle_subscription_id,
                message: `Subscription ${row.paddle_subscription_id} drifted ${count} times in 14 days — webhooks may be failing.`,
                details: { drift_count: count, last_changed: changed },
              });
              summary.alerts++;
            }
          }
        }
      } catch (e: any) {
        summary.errors++;
        summary.details.push({ sub: row.paddle_subscription_id, error: e.message });
      }
    }

    // Prune old webhook dedupe rows (30 days)
    await supabase
      .from("paddle_webhook_events")
      .delete()
      .lt("received_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    return json({ ok: true, ...summary });
  } catch (err: any) {
    console.error("paddle-reconcile-subscriptions error", err);
    await supabase.from("paddle_alerts").insert({
      kind: "reconcile_error",
      severity: "critical",
      message: `Reconciliation job failed: ${err.message}`,
      details: { ...summary },
    });
    return json({ error: err.message, ...summary }, 500);
  }
});
