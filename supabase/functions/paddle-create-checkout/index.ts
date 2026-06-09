import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PADDLE_CLIENT_TOKEN = (Deno.env.get("PADDLE_CLIENT_TOKEN") || "").trim();
const PADDLE_ENV = (Deno.env.get("PADDLE_ENVIRONMENT") || "sandbox").trim().toLowerCase();
const ENVIRONMENT = PADDLE_ENV === "live" || PADDLE_ENV === "production" ? "production" : "sandbox";
// redeploy marker v2

function validatePaddlePriceId(priceId: string | undefined): { valid: boolean; error?: string } {
  const trimmed = (priceId || "").trim();

  if (!trimmed) {
    return { valid: false, error: "Paddle Price ID is empty" };
  }

  if (!/^pri_[a-z0-9]{10,}$/i.test(trimmed)) {
    if (trimmed.startsWith("pro_")) {
      return {
        valid: false,
        error: "This is a Paddle Product ID (pro_). You need a Price ID (pri_).",
      };
    }
    if (trimmed.startsWith("https://")) {
      return {
        valid: false,
        error: "This appears to be a checkout URL. You need a Price ID (pri_).",
      };
    }
    return {
      valid: false,
      error: `Invalid Paddle Price ID format. Expected format like 'pri_xxxxxxxxxx', got: ${trimmed.substring(0, 20)}...`,
    };
  }

  return { valid: true };
}

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
    const validation = validatePaddlePriceId(priceId);
    if (!validation.valid) {
      return jsonResponse({
        error: `The saved Paddle price for the ${plan} plan is invalid. ${validation.error}`,
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
