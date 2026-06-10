import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paddle-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Verify Paddle webhook signature: header format "ts=...;h1=..."
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
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // constant-time compare
    if (computed.length !== h1.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ h1.charCodeAt(i);
    return diff === 0;
  } catch (_e) {
    return false;
  }
}

// Events we actually act on — everything else is acknowledged without DB work.
const ACTIVATE_EVENTS = new Set([
  "transaction.completed",
  "subscription.activated",
  "subscription.created",
]);
const CANCEL_EVENTS = new Set(["subscription.canceled"]);

const ackOk = () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const rawBody = await req.text();

    // Cheap pre-parse filter: skip events we don't care about before doing
    // signature verification or spinning up a Supabase client.
    const peekType = rawBody.match(/"event_type"\s*:\s*"([^"]+)"/)?.[1] || "";
    if (peekType && !ACTIVATE_EVENTS.has(peekType) && !CANCEL_EVENTS.has(peekType)) {
      return ackOk();
    }

    const signature = req.headers.get("paddle-signature") || "";
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");

    if (webhookSecret) {
      const ok = await verifyPaddleSignature(rawBody, signature, webhookSecret);
      if (!ok) {
        console.warn("paddle-webhook: invalid signature");
        return new Response(JSON.stringify({ error: "invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("paddle-webhook: PADDLE_WEBHOOK_SECRET not set — skipping verification");
    }

    const payload = JSON.parse(rawBody);
    const eventType: string = payload?.event_type || "";
    const eventId: string | undefined =
      payload?.event_id || payload?.notification_id || payload?.data?.id;
    const data = payload?.data || {};
    const custom = data?.custom_data || {};
    const userId: string | undefined = custom.user_id;
    const plan: string | undefined = custom.plan;

    if (!userId || !plan) return ackOk();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // === Idempotency gate ===========================================
    // Paddle retries webhook deliveries on any non-2xx response and can
    // also re-fire events during incidents. Insert the event id into a
    // dedupe table FIRST; if the insert is a primary-key conflict we
    // know we've already processed this exact delivery and bail out.
    if (eventId) {
      const { error: dedupeErr } = await supabase
        .from("paddle_webhook_events")
        .insert({ event_id: eventId, event_type: eventType, user_id: userId, plan });
      if (dedupeErr) {
        // 23505 = unique_violation → already processed, safe to ack.
        if ((dedupeErr as any).code === "23505") {
          console.log(`paddle-webhook: duplicate event ${eventId} ignored`);
          return ackOk();
        }
        // Any other error: fail loud so Paddle retries.
        throw dedupeErr;
      }
    } else {
      console.warn("paddle-webhook: no event_id on payload — idempotency skipped");
    }

    try {
      if (ACTIVATE_EVENTS.has(eventType)) {
        // Single round-trip: try update first, insert only if no active row exists.
        const { data: updated, error: updErr } = await supabase
          .from("vendor_subscriptions")
          .update({ plan })
          .eq("user_id", userId)
          .eq("status", "active")
          .select("id")
          .maybeSingle();

        if (updErr) throw updErr;
        if (!updated) {
          await supabase
            .from("vendor_subscriptions")
            .insert({ user_id: userId, plan, status: "active" });
        }
      } else if (CANCEL_EVENTS.has(eventType)) {
        await supabase
          .from("vendor_subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", userId)
          .eq("status", "active");
      }
    } catch (mutErr) {
      // Roll back the dedupe row so Paddle's retry can actually re-process.
      if (eventId) {
        await supabase.from("paddle_webhook_events").delete().eq("event_id", eventId);
      }
      throw mutErr;
    }

    return ackOk();
  } catch (err: any) {
    console.error("paddle-webhook error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
