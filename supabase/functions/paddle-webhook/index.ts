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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const rawBody = await req.text();
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
