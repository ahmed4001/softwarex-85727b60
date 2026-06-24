import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const KEY = 'bf930d85f823af7365774ca8006a6bae'
const HOST = 'reviewhunts.com'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`

interface Body {
  urls?: string[]
  url?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: Body = await req.json().catch(() => ({}))
    const raw = body.urls ?? (body.url ? [body.url] : [])
    const urlList = raw
      .filter((u) => typeof u === 'string' && u.length > 0)
      .map((u) => (u.startsWith('http') ? u : `https://${HOST}${u.startsWith('/') ? u : `/${u}`}`))
      .filter((u) => {
        try {
          return new URL(u).host === HOST
        } catch {
          return false
        }
      })

    if (urlList.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid urls' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Submit to IndexNow (Bing aggregator pings Yandex, Seznam, etc.)
    const endpoints = [
      'https://api.indexnow.org/IndexNow',
      'https://www.bing.com/IndexNow',
    ]

    const results = await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              host: HOST,
              key: KEY,
              keyLocation: KEY_LOCATION,
              urlList,
            }),
          })
          return { endpoint, status: res.status, ok: res.ok }
        } catch (e) {
          return { endpoint, error: (e as Error).message, ok: false }
        }
      })
    )

    return new Response(
      JSON.stringify({ submitted: urlList.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
