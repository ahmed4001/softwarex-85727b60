import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, paddle-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY");
    if (!PADDLE_API_KEY) {
      throw new Error("PADDLE_API_KEY is not configured");
    }

    const body = await req.text();
    const signature = req.headers.get("paddle-signature");

    // Log the event for debugging
    console.log("Paddle webhook received, signature present:", !!signature);

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = event?.event_type;
    const data = event?.data;

    console.log(`Paddle event: ${eventType}, ID: ${data?.id}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (eventType) {
      case "subscription.created": {
        console.log("Subscription created:", {
          subscriptionId: data?.id,
          status: data?.status,
          customerId: data?.customer_id,
          items: data?.items?.map((i: any) => i.price?.id),
        });
        // TODO: Store subscription in your database
        // await supabase.from('subscriptions').insert({ ... });
        break;
      }

      case "subscription.updated": {
        console.log("Subscription updated:", {
          subscriptionId: data?.id,
          status: data?.status,
        });
        // TODO: Update subscription status
        break;
      }

      case "subscription.canceled": {
        console.log("Subscription canceled:", {
          subscriptionId: data?.id,
          effectiveFrom: data?.scheduled_change?.effective_at,
        });
        // TODO: Handle cancellation
        break;
      }

      case "transaction.completed": {
        console.log("Transaction completed:", {
          transactionId: data?.id,
          status: data?.status,
          customerId: data?.customer_id,
          total: data?.details?.totals?.total,
          currency: data?.currency_code,
        });
        // TODO: Record payment / grant access
        break;
      }

      case "transaction.payment_failed": {
        console.log("Payment failed:", {
          transactionId: data?.id,
          customerId: data?.customer_id,
        });
        // TODO: Handle failed payment
        break;
      }

      default: {
        console.log(`Unhandled Paddle event: ${eventType}`);
      }
    }

    return new Response(JSON.stringify({ received: true, event_type: eventType }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Paddle webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
