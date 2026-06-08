import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PADDLE_CLIENT_TOKEN = (Deno.env.get("PADDLE_CLIENT_TOKEN") || "").trim();
const PADDLE_ENV = (Deno.env.get("PADDLE_ENVIRONMENT") || "sandbox").trim().toLowerCase();
const ENVIRONMENT = PADDLE_ENV === "live" || PADDLE_ENV === "production" ? "production" : "sandbox";

const PADDLE_PRICE_ID_PATTERN = /^pri_[a-z\d]{26}$/;
const PRICE_MAP: Record<string, string | undefined> = {
  featured: Deno.env.get("PADDLE_PRICE_FEATURED")?.trim(),
  promotion: Deno.env.get("PADDLE_PRICE_PROMOTION")?.trim(),
  premium: Deno.env.get("PADDLE_PRICE_PREMIUM")?.trim(),
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return jsonResponse({ error: "Please sign in before starting checkout." }, 401);

    const { plan } = await req.json();
    if (!Object.prototype.hasOwnProperty.call(PRICE_MAP, plan)) {
      return jsonResponse({ error: "Invalid checkout plan selected." }, 400);
    }

    if (!PADDLE_CLIENT_TOKEN) {
      return jsonResponse({ error: "Paddle client token is not configured." }, 500);
    }

    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return jsonResponse({
        error: `Paddle price ID for the ${plan} plan is not configured. Add PADDLE_PRICE_${plan?.toUpperCase()} with a Price ID that starts with pri_.`,
      }, 500);
    }

    if (!PADDLE_PRICE_ID_PATTERN.test(priceId)) {
      return jsonResponse({
        error: `The saved Paddle price for the ${plan} plan is invalid. Use a Paddle Price ID that starts with pri_ and looks like pri_01...`,
      }, 500);
    }

    return jsonResponse({
      clientToken: PADDLE_CLIENT_TOKEN,
      environment: ENVIRONMENT,
      priceId,
      email: user.email,
      userId: user.id,
      plan,
    });
  } catch (err: any) {
    console.error(err);
    return jsonResponse({ error: err.message || "Checkout failed" }, 500);
  }
});
