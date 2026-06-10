import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paddle-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifyPaddleSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(";").map((p) => {
        const [k, v] = p.split("=");
        return [k.trim(), v?.trim() ?? ""];
      }),
    );
    const ts = parts["ts"];
    const h1 = parts["h1"];
    if (!ts || !h1) return false;
    const signedPayload = `${ts}:${rawBody}`;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const computed = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (computed.length !== h1.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ h1.charCodeAt(i);
    return diff === 0;
  } catch (_e) {
    return false;
  }
}

const ACTIVATE_EVENTS = new Set([
  "transaction.completed",
  "subscription.activated",
  "subscription.created",
  "subscription.updated",
  "subscription.resumed",
]);
const CANCEL_EVENTS = new Set(["subscription.canceled"]);
const PAST_DUE_EVENTS = new Set(["subscription.past_due", "subscription.paused"]);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const ackOk = () => jsonResponse({ ok: true });

async function logSignatureFailure(reason: string, peekType: string, headers: Record<string, string>) {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("paddle_alerts").insert({
      kind: "signature_failure",
      severity: "critical",
      message: `Paddle webhook signature failure: ${reason}`,
      details: { event_type: peekType || null, headers, at: new Date().toISOString() },
    });
  } catch (e) {
    console.error("paddle-webhook: failed to log signature alert", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("paddle-webhook: PADDLE_WEBHOOK_SECRET is not configured — rejecting request");
      return jsonResponse({ error: "webhook secret not configured" }, 500);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature") || "";
    const peekType = rawBody.match(/"event_type"\s*:\s*"([^"]+)"/)?.[1] || "";
    const safeHeaders = {
      "paddle-signature": signature ? "present" : "missing",
      "user-agent": req.headers.get("user-agent") || "",
    };

    if (!signature) {
      await logSignatureFailure("missing signature header", peekType, safeHeaders);
      return jsonResponse({ error: "missing signature" }, 401);
    }
    const sigOk = await verifyPaddleSignature(rawBody, signature, webhookSecret);
    if (!sigOk) {
      await logSignatureFailure("HMAC mismatch", peekType, safeHeaders);
      return jsonResponse({ error: "invalid signature" }, 401);
    }

    if (peekType && !ACTIVATE_EVENTS.has(peekType) && !CANCEL_EVENTS.has(peekType) && !PAST_DUE_EVENTS.has(peekType)) {
      return ackOk();
    }

    const payload = JSON.parse(rawBody);
    const eventType: string = payload?.event_type || "";
    const eventId: string | undefined = payload?.event_id || payload?.notification_id || payload?.data?.id;
    const data = payload?.data || {};
    const custom = data?.custom_data || {};
    const userId: string | undefined = custom.user_id;
    const plan: string | undefined = custom.plan;

    if (!userId || !plan) return ackOk();

    const periodEnd: string | null =
      data?.current_billing_period?.ends_at || data?.billing_period?.ends_at || data?.next_billed_at || null;
    const paddleSubId: string | null = data?.subscription_id || (data?.id?.toString().startsWith("sub_") ? data.id : null);
    const paddleCustomerId: string | null = data?.customer_id || null;
    const paddlePriceId: string | null = data?.items?.[0]?.price?.id || data?.items?.[0]?.price_id || null;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (eventId) {
      const { error: dedupeErr } = await supabase
        .from("paddle_webhook_events")
        .insert({ event_id: eventId, event_type: eventType, user_id: userId, plan, payload, signature_valid: true });
      if (dedupeErr) {
        if ((dedupeErr as any).code === "23505") {
          console.log(`paddle-webhook: duplicate event ${eventId} ignored`);
          return ackOk();
        }
        throw dedupeErr;
      }
    } else {
      console.warn("paddle-webhook: no event_id on payload — idempotency skipped");
    }

    try {
      const now = new Date().toISOString();

      if (ACTIVATE_EVENTS.has(eventType)) {
        const patch: Record<string, unknown> = {
          plan,
          status: "active",
          last_event_at: now,
          canceled_at: null,
        };
        if (periodEnd) {
          patch.current_period_end = periodEnd;
          patch.expires_at = periodEnd;
        }
        if (paddleSubId) patch.paddle_subscription_id = paddleSubId;
        if (paddleCustomerId) patch.paddle_customer_id = paddleCustomerId;
        if (paddlePriceId) patch.paddle_price_id = paddlePriceId;

        let updatedId: string | null = null;
        if (paddleSubId) {
          const { data: row } = await supabase
            .from("vendor_subscriptions")
            .update(patch)
            .eq("paddle_subscription_id", paddleSubId)
            .select("id")
            .maybeSingle();
          updatedId = row?.id ?? null;
        }
        if (!updatedId) {
          const { data: row } = await supabase
            .from("vendor_subscriptions")
            .update(patch)
            .eq("user_id", userId)
            .in("status", ["active", "past_due"])
            .select("id")
            .maybeSingle();
          updatedId = row?.id ?? null;
        }
        if (!updatedId) {
          await supabase.from("vendor_subscriptions").insert({ user_id: userId, ...patch });
        }

        // Release any in-flight checkout lock for this user+plan.
        await supabase
          .from("paddle_checkout_attempts")
          .delete()
          .eq("user_id", userId)
          .eq("plan", plan);
      } else if (PAST_DUE_EVENTS.has(eventType)) {
        await supabase
          .from("vendor_subscriptions")
          .update({ status: "past_due", last_event_at: now })
          .eq("user_id", userId)
          .eq("status", "active");
      } else if (CANCEL_EVENTS.has(eventType)) {
        await supabase
          .from("vendor_subscriptions")
          .update({ status: "canceled", canceled_at: now, last_event_at: now })
          .eq("user_id", userId)
          .in("status", ["active", "past_due"]);
      }
    } catch (mutErr) {
      if (eventId) {
        await supabase.from("paddle_webhook_events").delete().eq("event_id", eventId);
      }
      throw mutErr;
    }

    return ackOk();
  } catch (err: any) {
    console.error("paddle-webhook error", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
