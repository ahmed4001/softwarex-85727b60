import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!

interface Body {
  entity_type: 'product' | 'comparison' | 'category' | 'guide' | 'glossary' | 'blog'
  entity_slug: string
  context: {
    name: string
    description?: string
    category?: string
    extra?: Record<string, unknown>
  }
  force?: boolean
}

interface FAQItem { q: string; a: string }

const SYSTEM = `You are an SEO expert writing FAQs that get cited by AI search engines (ChatGPT, Perplexity, Google AI Overviews, Bing Copilot).

Rules:
- Write 6 questions a real buyer would ask BEFORE adopting this product/page topic.
- Mix intents: what-is, how-much, vs-alternative, free-plan, integrations, use-cases, common objections.
- Answers: 2-4 sentences, factual, no marketing fluff, no "we", written in third person about the product/topic.
- Never invent specific prices, dates, or numbers you weren't given. If unknown, speak in general terms.
- Plain text only — no markdown, no lists, no links.

Return ONLY valid JSON: {"items":[{"q":"...","a":"..."}, ...]} with exactly 6 items.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = (await req.json()) as Body
    if (!body?.entity_type || !body?.entity_slug || !body?.context?.name) {
      return json({ error: 'entity_type, entity_slug, context.name required' }, 400)
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1. Check cache
    if (!body.force) {
      const { data: existing } = await sb
        .from('faq_cache')
        .select('items, source, is_edited, generated_at')
        .eq('entity_type', body.entity_type)
        .eq('entity_slug', body.entity_slug)
        .maybeSingle()
      if (existing && Array.isArray((existing as any).items) && (existing as any).items.length > 0) {
        return json({ items: (existing as any).items, cached: true, source: (existing as any).source })
      }
    }

    // 2. Generate via Lovable AI Gateway
    const prompt = buildPrompt(body)
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (aiRes.status === 429) return json({ error: 'AI rate limit, retry later' }, 429)
    if (aiRes.status === 402) return json({ error: 'AI credits exhausted' }, 402)
    if (!aiRes.ok) {
      const t = await aiRes.text()
      return json({ error: `AI gateway ${aiRes.status}: ${t.slice(0, 200)}` }, 502)
    }

    const aiJson = await aiRes.json()
    const raw = aiJson?.choices?.[0]?.message?.content ?? '{}'
    let parsed: { items?: FAQItem[] } = {}
    try { parsed = JSON.parse(raw) } catch { parsed = {} }
    const items: FAQItem[] = Array.isArray(parsed.items)
      ? parsed.items.filter((i) => i?.q && i?.a).slice(0, 8)
      : []

    if (items.length === 0) {
      return json({ error: 'AI returned no FAQs', raw: raw.slice(0, 300) }, 502)
    }

    // 3. Upsert into cache
    await sb.from('faq_cache').upsert(
      {
        entity_type: body.entity_type,
        entity_slug: body.entity_slug,
        items,
        model: 'google/gemini-3-flash-preview',
        source: 'ai',
        is_edited: false,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'entity_type,entity_slug' }
    )

    return json({ items, cached: false, source: 'ai' })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

function buildPrompt(b: Body): string {
  const c = b.context
  const lines = [
    `Entity type: ${b.entity_type}`,
    `Name / Topic: ${c.name}`,
    c.category ? `Category: ${c.category}` : null,
    c.description ? `Description: ${c.description.slice(0, 600)}` : null,
  ].filter(Boolean)
  if (c.extra) lines.push(`Additional facts: ${JSON.stringify(c.extra).slice(0, 400)}`)
  return lines.join('\n')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
