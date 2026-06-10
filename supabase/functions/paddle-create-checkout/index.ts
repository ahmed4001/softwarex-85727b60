import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PADDLE_CLIENT_TOKEN = (Deno.env.get("PADDLE_CLIENT_TOKEN") || "").trim();
const PADDLE_ENV = (Deno.env.get("PADDLE_ENVIRONMENT") || "sandbox").trim().toLowerCase();
const ENVIRONMENT = PADDLE_ENV === "live" || PADDLE_ENV === "production" ? "production" : "sandbox";

// 2-minute in-flight lock — long enough for the user to click "Pay" in the
// Paddle overlay, short enough to recover if they abandon.
const CHECKOUT_LOCK_TTL_MS = 2 * 60 * 1000;

function validatePaddlePriceId(priceId: string | undefined): { valid: boolean; error?: string } {
  const trimmed = (priceId || "").trim();
  if (!trimmed) return { valid: false, error: "Paddle Price ID is empty" };
  if (!/^pri_[a-z0-9]{10,}$/i.test(trimmed)) {
    if (trimmed.startsWith("pro_")) return { valid: false, error: "This is a Paddle Product ID (pro_). You need a Price ID (pri_)." };
    if (trimmed.startsWith("https://")) return { valid: false, error: "This appears to be a checkout URL. You need a Price ID (pri_)." };
    return { valid: false, error: `Invalid Paddle Price ID format. Expected like 'pri_xxxxxxxxxx', got: ${trimmed.substring(0, 20)}...` };
  }
  return { valid: true };
}

const PRICE_MAP: Record<string, string | undefined> = {
  featured: Deno.env.get("PADDLE_PRICE_FEATURED")?.trim(),
  promotion: Deno.env.get("PADDLE_PRICE_PROMOTION")?.trim(),
  premium: Deno.env.get("PADDLE_PRICE_PREMIUM")?.trim(),
};

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
    if (!user) return json({ error: "Please sign in before starting checkout." }, 401);

    const { plan } = await req.json();
    if (!Object.prototype.hasOwnProperty.call(PRICE_MAP, plan)) {
      return json({ error: "Invalid checkout plan selected." }, 400);
    }
    if (!PADDLE_CLIENT_TOKEN) return json({ error: "Paddle client token is not configured." }, 500);

    const priceId = PRICE_MAP[plan];
    const validation = validatePaddlePriceId(priceId);
    if (!validation.valid) {
      return json({ error: `The saved Paddle price for the ${plan} plan is invalid. ${validation.error}` }, 500);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // === Idempotency gate #1: existing paid subscription =============
    const { data: existingSub } = await admin
      .from("vendor_subscriptions")
      .select("plan, status, paddle_subscription_id")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due"])
      .not("paddle_subscription_id", "is", null)
      .maybeSingle();

    if (existingSub) {
      return json({
        error: existingSub.plan === plan
          ? `You already have an active ${plan} subscription.`
          : `You already have an active ${existingSub.plan} subscription. Manage or cancel it in Paddle before switching to ${plan}.`,
        code: "subscription_exists",
      }, 409);
    }

    // === Idempotency gate #2: in-flight checkout lock ================
    // Best-effort cleanup of expired locks for this user.
    await admin
      .from("paddle_checkout_attempts")
      .delete()
      .eq("user_id", user.id)
      .lt("expires_at", new Date().toISOString());

    const expiresAt = new Date(Date.now() + CHECKOUT_LOCK_TTL_MS).toISOString();
    const { error: lockErr } = await admin
      .from("paddle_checkout_attempts")
      .insert({ user_id: user.id, plan, expires_at: expiresAt });

    if (lockErr) {
      if ((lockErr as any).code === "23505") {
        return json({
          error: "You already have a checkout in progress for this plan. Finish it or wait a couple of minutes.",
          code: "checkout_in_progress",
        }, 409);
      }
      throw lockErr;
    }

    return json({
      clientToken: PADDLE_CLIENT_TOKEN,
      environment: ENVIRONMENT,
      priceId,
      email: user.email,
      userId: user.id,
      plan,
    });
  } catch (err: any) {
    console.error(err);
    return json({ error: err.message || "Checkout failed" }, 500);
  }
});
