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
    if (!user) {
      return jsonResponse({ error: "Please sign in before starting checkout." }, 401);
    }

    const { plan } = await req.json();
    if (!Object.prototype.hasOwnProperty.call(PRICE_MAP, plan)) {
      return jsonResponse({ error: "Invalid checkout plan selected." }, 400);
    }

    if (!PADDLE_API_KEY) {
      return jsonResponse({ error: "Paddle API key is not configured." }, 500);
    }

    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return jsonResponse({
        error: `Paddle price ID for the ${plan} plan is not configured. Add PADDLE_PRICE_${plan?.toUpperCase()} with a Price ID that starts with pri_.`,
      }, 500);
    }

    if (!PADDLE_PRICE_ID_PATTERN.test(priceId)) {
      return jsonResponse({
        error: `The saved Paddle price for the ${plan} plan is invalid. Use a Paddle Price ID that starts with pri_ and looks like pri_01..., not a product ID or checkout URL.`,
      }, 500);
    }

    const origin = req.headers.get("origin") || "";
    const successUrl = `${origin}/dashboard?paid=1&plan=${plan}`;

    const res = await fetch(`${PADDLE_BASE}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        customer: { email: user.email },
        collection_mode: "automatic",
        custom_data: { user_id: user.id, plan },
        checkout: { url: successUrl },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("Paddle error", json);
      return jsonResponse({ error: json?.error?.detail || "Paddle request failed", details: json }, 502);
    }

    const checkoutUrl: string | undefined = json?.data?.checkout?.url;
    if (!checkoutUrl) {
      return jsonResponse({ error: "No checkout URL returned", details: json }, 502);
    }

    return jsonResponse({ checkoutUrl, transactionId: json.data.id });
  } catch (err: any) {
    console.error(err);
    return jsonResponse({ error: err.message || "Checkout failed" }, 500);
  }
});
