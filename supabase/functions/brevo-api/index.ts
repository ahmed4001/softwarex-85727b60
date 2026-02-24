import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BREVO_API_BASE = "https://api.brevo.com/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { action, accountId, ...params } = await req.json();

    // Helper to get API key for an account
    async function getApiKey(id: string) {
      const { data, error } = await supabase
        .from("brevo_accounts")
        .select("api_key, name, is_active")
        .eq("id", id)
        .single();
      if (error || !data) throw new Error("Account not found");
      if (!data.is_active) throw new Error("Account is inactive");
      return data;
    }

    async function brevoFetch(apiKey: string, path: string, method = "GET", body?: unknown) {
      const res = await fetch(`${BREVO_API_BASE}${path}`, {
        method,
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Brevo API error [${res.status}]: ${JSON.stringify(data)}`);
      return data;
    }

    let result: unknown;

    switch (action) {
      case "get-account-info": {
        const account = await getApiKey(accountId);
        const info = await brevoFetch(account.api_key, "/account");
        result = { name: account.name, ...info };
        break;
      }

      case "sync-contacts": {
        const account = await getApiKey(accountId);
        // Get newsletter subscribers
        const { data: subscribers } = await supabase
          .from("newsletter_subscribers")
          .select("email")
          .eq("is_active", true);

        if (subscribers && subscribers.length > 0) {
          // Import contacts to Brevo
          await brevoFetch(account.api_key, "/contacts/import", "POST", {
            emailBlacklist: false,
            updateExistingContacts: true,
            jsonBody: subscribers.map((s) => ({ email: s.email })),
          });

          await supabase
            .from("brevo_accounts")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", accountId);
        }

        result = { synced: subscribers?.length || 0 };
        break;
      }

      case "get-contacts": {
        const account = await getApiKey(accountId);
        const contacts = await brevoFetch(account.api_key, `/contacts?limit=${params.limit || 50}&offset=${params.offset || 0}`);
        result = contacts;
        break;
      }

      case "send-campaign": {
        const account = await getApiKey(accountId);
        // Create campaign in Brevo
        const campaign = await brevoFetch(account.api_key, "/emailCampaigns", "POST", {
          name: params.subject,
          subject: params.subject,
          sender: { name: params.senderName || "SoftwareHub", email: params.senderEmail },
          htmlContent: params.htmlContent,
          recipients: { listIds: params.listIds || [2] },
        });

        // Send immediately
        await brevoFetch(account.api_key, `/emailCampaigns/${campaign.id}/sendNow`, "POST");

        // Log campaign
        await supabase.from("brevo_campaigns").insert({
          brevo_account_id: accountId,
          brevo_campaign_id: String(campaign.id),
          subject: params.subject,
          sender_name: params.senderName || "SoftwareHub",
          sender_email: params.senderEmail,
          html_content: params.htmlContent,
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        // Update credits
        await supabase.rpc("increment_brevo_credits" as never, { account_id: accountId } as never);

        result = { campaignId: campaign.id, status: "sent" };
        break;
      }

      case "send-transactional": {
        const account = await getApiKey(accountId);
        const email = await brevoFetch(account.api_key, "/smtp/email", "POST", {
          sender: { name: params.senderName || "SoftwareHub", email: params.senderEmail },
          to: [{ email: params.to }],
          subject: params.subject,
          htmlContent: params.htmlContent,
        });
        result = email;
        break;
      }

      case "get-lists": {
        const account = await getApiKey(accountId);
        const lists = await brevoFetch(account.api_key, "/contacts/lists?limit=50&offset=0");
        result = lists;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Brevo API error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
