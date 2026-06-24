import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BASE = 'https://reviewhunts.com'

/**
 * AIO: clean machine-readable JSON for any entity, served at
 *   /functions/v1/entity-json?type=product&slug=notion
 * Returns extractable facts without the JS shell — what AI crawlers want.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const slug = url.searchParams.get('slug')

  if (!type || !slug) return json({ error: 'type and slug required' }, 400)

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    switch (type) {
      case 'product': return json(await loadProduct(sb, slug))
      case 'comparison': return json(await loadComparison(sb, slug))
      case 'category': return json(await loadCategory(sb, slug))
      case 'guide': return json(await loadGuide(sb, slug))
      case 'glossary': return json(await loadGlossary(sb, slug))
      case 'blog': return json(await loadBlog(sb, slug))
      default: return json({ error: 'unknown type' }, 400)
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

async function loadProduct(sb: any, slug: string) {
  const { data: p } = await sb
    .from('products')
    .select('id,name,slug,tagline,description,website_url,logo_url,avg_rating,total_reviews,founded_year,category_id,updated_at,pricing_model,starting_price')
    .eq('slug', slug)
    .maybeSingle()
  if (!p) return { error: 'not found' }
  const { data: cat } = p.category_id
    ? await sb.from('categories').select('name,slug').eq('id', p.category_id).maybeSingle()
    : { data: null }
  const { data: faq } = await sb
    .from('faq_cache').select('items')
    .eq('entity_type', 'product').eq('entity_slug', slug).maybeSingle()
  return {
    type: 'product',
    url: `${BASE}/product/${p.slug}`,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    website: p.website_url,
    logo: p.logo_url,
    category: cat?.name,
    category_url: cat ? `${BASE}/category/${cat.slug}` : null,
    rating: p.avg_rating,
    review_count: p.total_reviews,
    founded_year: p.founded_year,
    pricing_model: p.pricing_model,
    starting_price: p.starting_price,
    last_updated: p.updated_at,
    faqs: (faq?.items as any[]) ?? [],
    cite_as: `${p.name} on ReviewHunts — ${BASE}/product/${p.slug}`,
  }
}

async function loadComparison(sb: any, slug: string) {
  const { data: c } = await sb
    .from('comparisons')
    .select('title,slug,meta_description,content,updated_at')
    .eq('slug', slug).maybeSingle()
  if (!c) return { error: 'not found' }
  const { data: faq } = await sb
    .from('faq_cache').select('items')
    .eq('entity_type', 'comparison').eq('entity_slug', slug).maybeSingle()
  return {
    type: 'comparison',
    url: `${BASE}/compare/${c.slug}`,
    title: c.title,
    summary: c.meta_description,
    last_updated: c.updated_at,
    faqs: (faq?.items as any[]) ?? [],
  }
}

async function loadCategory(sb: any, slug: string) {
  const { data: c } = await sb
    .from('categories').select('name,slug,description,product_count').eq('slug', slug).maybeSingle()
  if (!c) return { error: 'not found' }
  const { data: top } = await sb
    .from('products').select('name,slug,tagline,avg_rating,total_reviews')
    .eq('category_id', (await sb.from('categories').select('id').eq('slug', slug).maybeSingle()).data?.id)
    .eq('status', 'active').order('avg_rating', { ascending: false }).limit(20)
  return {
    type: 'category',
    url: `${BASE}/category/${c.slug}`,
    name: c.name,
    description: c.description,
    product_count: c.product_count,
    top_products: (top ?? []).map((p: any) => ({
      name: p.name,
      url: `${BASE}/product/${p.slug}`,
      tagline: p.tagline,
      rating: p.avg_rating,
      review_count: p.total_reviews,
    })),
  }
}

async function loadGuide(sb: any, slug: string) {
  const { data: g } = await sb
    .from('buyer_guides').select('title,slug,summary,content,updated_at').eq('slug', slug).maybeSingle()
  if (!g) return { error: 'not found' }
  return { type: 'guide', url: `${BASE}/guides/${g.slug}`, title: g.title, summary: g.summary, last_updated: g.updated_at }
}

async function loadGlossary(sb: any, slug: string) {
  const { data: t } = await sb
    .from('glossary_terms').select('term,slug,definition,updated_at').eq('slug', slug).maybeSingle()
  if (!t) return { error: 'not found' }
  return { type: 'glossary', url: `${BASE}/glossary/${t.slug}`, term: t.term, definition: t.definition, last_updated: t.updated_at }
}

async function loadBlog(sb: any, slug: string) {
  const { data: b } = await sb
    .from('blog_posts').select('title,slug,excerpt,author_name,published_at,updated_at,view_count')
    .eq('slug', slug).maybeSingle()
  if (!b) return { error: 'not found' }
  return {
    type: 'blog',
    url: `${BASE}/blog/${b.slug}`,
    title: b.title,
    excerpt: b.excerpt,
    author: b.author_name,
    published_at: b.published_at,
    last_updated: b.updated_at,
    views: b.view_count,
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  })
}
