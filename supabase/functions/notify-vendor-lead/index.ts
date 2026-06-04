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
    const { leadId } = await req.json();
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the lead
    const { data: lead, error: leadErr } = await supabase
      .from("vendor_leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get vendor email from profiles
    const { data: vendorProfile } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("user_id", lead.vendor_user_id)
      .single();

    if (!vendorProfile?.email) {
      return new Response(JSON.stringify({ error: "Vendor email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get product name
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", lead.product_id)
      .single();

    const productName = product?.name || "your product";
    const vendorName = vendorProfile.name || "Vendor";

    // Get best Brevo account
    const { data: bestAccountId } = await supabase.rpc("get_best_brevo_account" as never);

    if (!bestAccountId) {
      console.error("No active Brevo account available for sending notification");
      return new Response(JSON.stringify({ error: "No email account available" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: brevoAccount } = await supabase
      .from("brevo_accounts")
      .select("api_key")
      .eq("id", bestAccountId)
      .single();

    if (!brevoAccount?.api_key) {
      return new Response(JSON.stringify({ error: "Brevo account not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#18181b;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">🎯 New Lead for ${escapeHtml(productName)}</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.5;">
        Hi ${escapeHtml(vendorName)}, you have a new inquiry!
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;width:100px;">Name</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;color:#18181b;font-size:14px;font-weight:500;">${escapeHtml(lead.name)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;">Email</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;color:#18181b;font-size:14px;">
            <a href="mailto:${escapeHtml(lead.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(lead.email)}</a>
          </td>
        </tr>
        ${lead.company ? `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;">Company</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;color:#18181b;font-size:14px;">${escapeHtml(lead.company)}</td>
        </tr>` : ""}
        ${lead.message ? `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;vertical-align:top;">Message</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;color:#18181b;font-size:14px;line-height:1.5;">${escapeHtml(lead.message)}</td>
        </tr>` : ""}
      </table>
      <p style="margin:0;color:#71717a;font-size:12px;">
        View and manage your leads in the <a href="#" style="color:#2563eb;text-decoration:none;">Vendor Dashboard</a>.
      </p>
    </div>
  </div>
</body>
</html>`;

    // Send via Brevo transactional email
    const res = await fetch(`${BREVO_API_BASE}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": brevoAccount.api_key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "ReviewHunts", email: "noreply@reviewhunts.com" },
        to: [{ email: vendorProfile.email, name: vendorName }],
        subject: `🎯 New lead for ${productName}: ${lead.name}`,
        htmlContent,
      }),
    });

    const emailResult = await res.json();
    if (!res.ok) {
      console.error("Brevo send failed:", emailResult);
      throw new Error(`Brevo error [${res.status}]: ${JSON.stringify(emailResult)}`);
    }

    // Increment credit usage
    await supabase
      .from("brevo_accounts")
      .update({
        credits_used_today: (await supabase
          .from("brevo_accounts")
          .select("credits_used_today")
          .eq("id", bestAccountId)
          .single()
          .then(r => r.data?.credits_used_today || 0)) + 1,
      })
      .eq("id", bestAccountId);

    return new Response(JSON.stringify({ success: true, messageId: emailResult.messageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Vendor lead notification error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
