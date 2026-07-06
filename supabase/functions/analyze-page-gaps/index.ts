// Analyze page gaps: pulls Google Search Console (GSC) query data for a URL,
// diffs it against ranked terms, and asks Lovable AI for content-update recs
// (title/meta rewrites, H2/H3 topics, FAQ candidates, internal-link targets).
//
// Persists the result to public.content_recommendations for admin review.
//
// POST body: { url: string, days?: number }  (days defaults to 28)
// Requires: admin session, LOVABLE_API_KEY, GOOGLE_SEARCH_CONSOLE_API_KEY.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE_URL = 'https://reviewhunts.com/';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ---- Auth: require an admin session -------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userData.user.id, _role: 'admin',
    });
    const { data: isSuper } = await supabase.rpc('has_role', {
      _user_id: userData.user.id, _role: 'superadmin',
    });
    if (!isAdmin && !isSuper) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Validate input -----------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || '').trim();
    const days = Math.max(1, Math.min(90, Number(body?.days) || 28));
    if (!/^https?:\/\/.+/.test(url)) {
      return new Response(JSON.stringify({ error: 'url must be an absolute http(s) URL' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GSC_KEY = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!GSC_KEY) throw new Error('GOOGLE_SEARCH_CONSOLE_API_KEY not configured (connect Google Search Console)');

    // ---- 1. Pull GSC query data for this URL --------------------------------
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const gscResp = await fetch(
      `https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': GSC_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate, endDate,
          dimensions: ['query'],
          dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: url }] }],
          rowLimit: 50,
        }),
      },
    );
    if (!gscResp.ok) {
      const t = await gscResp.text();
      console.error('gsc error', gscResp.status, t);
      return new Response(JSON.stringify({ error: `GSC error ${gscResp.status}`, detail: t.slice(0, 400) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const gsc = await gscResp.json();
    const rows: any[] = gsc?.rows ?? [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No GSC data for this URL in the last ' + days + ' days' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Split ranked (pos ≤ 20) vs gap (>20 or 0 impressions with high volume potential).
    const ranked = rows.filter((r) => r.position <= 20).map((r) => r.keys?.[0]).filter(Boolean);
    const gap = rows.filter((r) => r.position > 20 && r.impressions >= 5).slice(0, 20)
      .map((r) => ({ query: r.keys?.[0], impressions: r.impressions, position: Math.round(r.position), ctr: r.ctr }));
    const totals = rows.reduce((acc, r) => ({
      impressions: acc.impressions + (r.impressions || 0),
      clicks: acc.clicks + (r.clicks || 0),
    }), { impressions: 0, clicks: 0 });
    const avgPos = rows.reduce((s, r) => s + (r.position || 0), 0) / rows.length;

    // ---- 2. Fetch page HTML for content context -----------------------------
    let pageText = '';
    try {
      const htmlResp = await fetch(url, { headers: { 'User-Agent': 'ReviewhuntsSEO/1.0' } });
      if (htmlResp.ok) {
        const html = await htmlResp.text();
        pageText = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000);
      }
    } catch (e) {
      console.warn('page fetch failed', e);
    }

    // ---- 3. Ask Lovable AI for structured recs ------------------------------
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are an SEO content strategist. Given a URL, the queries it already ranks for, and near-miss queries with impressions, produce concrete content-update recommendations. Be specific and actionable.' },
          { role: 'user', content: `URL: ${url}
Already ranking for (top 20): ${ranked.slice(0, 15).join(', ') || 'nothing significant'}
Near-miss queries with impressions (position > 20):
${gap.map((g) => `- "${g.query}" (${g.impressions} imps, pos ${g.position})`).join('\n')}

Page content excerpt:
${pageText || '(no content available)'}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'emit_recommendations',
            description: 'Return concrete SEO recommendations for this page.',
            parameters: {
              type: 'object',
              properties: {
                suggested_title: { type: 'string', description: '50-60 chars, includes primary gap keyword.' },
                suggested_meta_description: { type: 'string', description: '140-160 chars.' },
                missing_h2_topics: { type: 'array', items: { type: 'string' }, description: 'H2/H3 sections to add.' },
                faq_candidates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      answer_outline: { type: 'string' },
                    },
                    required: ['question', 'answer_outline'],
                  },
                },
                internal_link_targets: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Anchor phrases suitable for inbound internal links from related pages.',
                },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                rationale: { type: 'string' },
              },
              required: ['suggested_title', 'suggested_meta_description', 'missing_h2_topics', 'priority'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'emit_recommendations' } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: 'AI rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const t = await aiResp.text();
      console.error('ai error', aiResp.status, t);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const aiData = await aiResp.json();
    const call = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const recs = call ? JSON.parse(call.function.arguments) : {};

    // ---- 4. Persist ---------------------------------------------------------
    // Use service-role client for upsert so RLS doesn't block admins.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const row = {
      page_url: url,
      page_type: url.includes('/blog/') ? 'blog' : url.includes('/product/') ? 'product' : url.includes('/compare/') ? 'compare' : 'other',
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
      avg_position: avgPos,
      gap_keywords: gap,
      recommendations: recs,
      suggested_title: recs.suggested_title ?? null,
      suggested_meta_description: recs.suggested_meta_description ?? null,
      status: 'new',
    };
    const { error: upErr } = await admin
      .from('content_recommendations')
      .upsert(row, { onConflict: 'page_url' });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, row }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analyze-page-gaps', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
