import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY")!;
const PADDLE_ENV = (Deno.env.get("PADDLE_ENVIRONMENT") || "sandbox").toLowerCase();
const PADDLE_BASE =
  PADDLE_ENV === "live" || PADDLE_ENV === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

const PRICE_MAP: Record<string, string | undefined> = {
  featured: Deno.env.get("PADDLE_PRICE_FEATURED"),
  promotion: Deno.env.get("PADDLE_PRICE_PROMOTION"),
  premium: Deno.env.get("PADDLE_PRICE_PREMIUM"),
};

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan } = await req.json();
    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return new Response(
        JSON.stringify({
          error: `Paddle price ID for plan "${plan}" is not configured. Add PADDLE_PRICE_${plan?.toUpperCase()} secret.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      return new Response(JSON.stringify({ error: json?.error?.detail || "Paddle request failed", details: json }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutUrl: string | undefined = json?.data?.checkout?.url;
    if (!checkoutUrl) {
      return new Response(JSON.stringify({ error: "No checkout URL returned", details: json }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ checkoutUrl, transactionId: json.data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
