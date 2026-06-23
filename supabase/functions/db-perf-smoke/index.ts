import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const QueryRule = z.object({
  match: z.string().min(1),
  mean_ms: z.number().positive().optional(),
  max_ms: z.number().positive().optional(),
  label: z.string().min(1).optional(),
});

const BodySchema = z.object({
  mean_ms: z.number().positive().optional(),
  max_ms: z.number().positive().optional(),
  queries: z.array(QueryRule).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let mean_ms: number | undefined;
    let max_ms: number | undefined;
    let queries: unknown[] = [];

    if (req.method === "POST") {
      const raw = await req.json().catch(() => ({}));
      const parsed = BodySchema.safeParse(raw);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: "invalid body", details: parsed.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      mean_ms = parsed.data.mean_ms;
      max_ms = parsed.data.max_ms;
      queries = parsed.data.queries ?? [];
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("db_perf_smoke", {
      _mean_ms: mean_ms ?? 200,
      _max_ms: max_ms ?? 800,
      _queries: queries,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const passed = (data as { pass?: boolean })?.pass === true;
    return new Response(JSON.stringify(data), {
      status: passed ? 200 : 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
