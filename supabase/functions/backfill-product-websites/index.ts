// Backfills products.website_url by searching the official website via Firecrawl.
// POST body: { limit?: number, dry_run?: boolean, ids?: string[] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_HOSTS = [
  "wikipedia.org", "youtube.com", "youtu.be", "linkedin.com", "facebook.com",
  "twitter.com", "x.com", "instagram.com", "reddit.com", "medium.com",
  "g2.com", "capterra.com", "trustpilot.com", "getapp.com", "producthunt.com",
  "softwareadvice.com", "crozdesk.com", "saasworthy.com", "gartner.com",
  "github.com", "play.google.com", "apps.apple.com", "amazon.com",
  "pinterest.com", "quora.com", "slideshare.net", "glassdoor.com",
  "crunchbase.com", "bloomberg.com", "forbes.com", "techcrunch.com",
];

const GENERIC_ROOTS = new Set([
  "app", "apps", "software", "platform", "tool", "tools", "suite", "solution",
  "solutions", "service", "services", "cloud", "web", "online", "digital",
  "tech", "system", "systems", "pro", "hq", "inc", "corp", "co", "company",
  "io", "ai", "dev", "net", "org", "info", "hub", "center", "portal",
]);

const JUNK_NAMES = new Set([
  "pros", "cons", "first", "affordable", "real", "must", "key", "support",
  "sales", "integration", "scalable", "hospitality", "conclusion", "gdpr",
  "cloud-based", "highly customizable", "api integrations", "time tracking",
  "expense tracking", "real-time collaboration", "tax compliance",
  "automatic tax calculation", "customizable invoices", "ai-driven analytics",
  "payment provider support", "automated financial reporting",
  "multi-tier commissions", "agentless scanning", "ad trackers",
  "affiliate marketing", "key strength", "summary", "overview", "features",
  "pricing", "free", "freemium", "enterprise", "starter", "basic", "premium",
]);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  // One contains the other (e.g. "Stripe" vs "Stripe Payments")
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // Same first 4 chars + length within 40%
  if (na.slice(0, 4) === nb.slice(0, 4)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    if (ratio >= 0.6) return 0.6;
  }
  return 0;
}

function isGenericRoot(root: string): boolean {
  return GENERIC_ROOTS.has(root) || root.length <= 2;
}

function domainConfidence(productSlug: string, host: string): number {
  const rootSlug = slugify(host.split(".")[0]);
  if (!rootSlug || rootSlug.length < 3 || productSlug.length < 3) return 0;
  if (isGenericRoot(rootSlug)) return 0; // generic roots are untrustworthy
  if (rootSlug === productSlug) return 1.0;
  if (rootSlug.includes(productSlug) || productSlug.includes(rootSlug)) return 0.75;
  if (rootSlug.startsWith(productSlug.slice(0, 4)) || productSlug.startsWith(rootSlug.slice(0, 4))) return 0.35;
  return 0;
}

function pickBestUrl(
  name: string,
  results: any[],
): { url: string | null; host: string | null; confidence: number; candidates: any[] } {
  const slug = slugify(name);
  const candidates: any[] = [];
  let best: { url: string; host: string; confidence: number } | null = null;

  for (const r of results || []) {
    const url: string = r?.url || "";
    if (!url) continue;
    let host = "";
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
    catch { continue; }
    const blocked = BLOCKED_HOSTS.some((b) => host === b || host.endsWith("." + b));
    if (blocked) {
      candidates.push({ url, host, blocked: true, confidence: 0 });
      continue;
    }
    const confidence = domainConfidence(slug, host);
    candidates.push({ url, host, blocked: false, confidence });
    if (confidence >= 0.75 && (!best || confidence > best.confidence)) {
      best = { url: `https://${host}`, host, confidence };
    }
  }
  return best
    ? { url: best.url, host: best.host, confidence: best.confidence, candidates }
    : { url: null, host: null, confidence: 0, candidates };
}

function scoreClearbitMatch(productName: string, clearbitName: string, domain: string): number {
  const nameConf = nameSimilarity(productName, clearbitName);
  const domConf = domainConfidence(slugify(productName), domain);
  // Both name AND domain must look right; weight name similarity heavily
  // to avoid "Salesforce" matching some unrelated "sales-" domain.
  if (nameConf >= 0.85 && domConf >= 0.75) return 1.0;
  if (nameConf >= 0.85 && domConf >= 0.35) return 0.9;
  if (nameConf >= 0.6 && domConf >= 0.75) return 0.85;
  if (nameConf >= 0.6 && domConf >= 0.35) return 0.5;
  return Math.max(0, nameConf * 0.3 + domConf * 0.3); // low unless both decent
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit ?? body.batch_size) || 25, 200));
    const dryRun = Boolean(body.dry_run);
    const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;
    // Tunables — tighter waste controls.
    const multiplier = Math.max(1, Math.min(Number(body.oversample_multiplier) || 30, 100));
    const concurrency = Math.max(1, Math.min(Number(body.concurrency) || 1, 10));
    const minConfidence = Math.max(0, Math.min(Number(body.min_confidence) || 0, 1));
    const maxMissRate = Math.max(0, Math.min(Number(body.max_miss_rate) || 1, 1));
    const minSample = Math.max(1, Math.min(Number(body.miss_rate_min_sample) || 10, 200));
    const rateLimitMs = Math.max(0, Math.min(Number(body.rate_limit_ms) ?? 400, 5000));

    // Oversample so post-filter (already-tried) still yields `limit` rows.
    const oversample = ids?.length ? limit : Math.min(limit * multiplier, 2000);
    let q = supabase
      .from("products")
      .select("id, name, slug")
      .or("website_url.is.null,website_url.eq.")
      .limit(oversample);
    if (ids?.length) q = q.in("id", ids);
    const { data: rowsRaw, error } = await q;
    if (error) throw error;

    // Skip products we've already attempted in a prior run (any status).
    let rows = rowsRaw || [];
    if (rows.length && !ids?.length) {
      const triedSet = new Set<string>();
      let from = 0;
      const page = 1000;
      while (true) {
        const { data: tried, error: tErr } = await supabase
          .from("backfill_match_log")
          .select("product_id")
          .range(from, from + page - 1);
        if (tErr || !tried || tried.length === 0) break;
        for (const t of tried) triedSet.add(t.product_id);
        if (tried.length < page) break;
        from += page;
      }
      rows = rows.filter((r: any) => !triedSet.has(r.id)).slice(0, limit);
    }

    const results: any[] = [];
    let aborted = false;
    let abortReason: string | null = null;

    async function processOne(p: any) {
      const name = String(p.name || "").trim();
      const lower = name.toLowerCase();
      const query = `${name} official website software`;
      const logEntry: Record<string, any> = {
        product_id: p.id,
        product_name: name,
        source_query: query,
        previous_url: null,
      };

      if (!name || name.length < 2 || JUNK_NAMES.has(lower)) {
        results.push({ id: p.id, name, status: "skipped", reason: "junk/short name" });
        await supabase.from("backfill_match_log").insert({
          ...logEntry, status: "skipped", reason: "junk/short name",
        });
        return;
      }

      try {
        // Step 1: Clearbit Autocomplete (free, fast, high-precision for real SaaS brands).
        let pick = { url: null as string | null, host: null as string | null, confidence: 0, candidates: [] as any[] };
        let source = "clearbit";
        try {
          const cbRes = await fetch(
            `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
          );
          if (cbRes.ok) {
            const cbData = await cbRes.json();
            if (Array.isArray(cbData) && cbData.length) {
              let bestClearbit: { url: string; host: string; confidence: number; name: string } | null = null;
              const candidates: any[] = [];
              for (const c of cbData.slice(0, 5)) {
                const domain: string = c?.domain || "";
                if (!domain) continue;
                const host = domain.toLowerCase().replace(/^www\./, "");
                const blocked = BLOCKED_HOSTS.some((b) => host === b || host.endsWith("." + b));
                const clearbitName: string = c?.name || "";
                const confidence = scoreClearbitMatch(name, clearbitName, host);
                candidates.push({ url: `https://${host}`, host, blocked, confidence, clearbit_name: clearbitName });
                if (!blocked && confidence >= 0.85 && (!bestClearbit || confidence > bestClearbit.confidence)) {
                  bestClearbit = { url: `https://${host}`, host, confidence, name: clearbitName };
                }
              }
              pick = bestClearbit
                ? { url: bestClearbit.url, host: bestClearbit.host, confidence: bestClearbit.confidence, candidates }
                : { url: null, host: null, confidence: 0, candidates };
            }
          }
        } catch (_) { /* fall through to Firecrawl */ }

        // Step 2: Fallback to Firecrawl search if Clearbit didn't yield a confident match.
        if (!pick.url || pick.confidence < Math.max(minConfidence, 0.85)) {
          source = "firecrawl";
          const res = await fetch("https://api.firecrawl.dev/v2/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query, limit: 5 }),
          });
          const data = await res.json();
          if (!res.ok) {
            results.push({ id: p.id, name, status: "error", reason: data?.error || res.statusText });
            await supabase.from("backfill_match_log").insert({
              ...logEntry, status: "error", reason: data?.error || res.statusText,
            });
            return;
          }
          const list = data?.data?.web || data?.web || data?.data || [];
          pick = pickBestUrl(name, Array.isArray(list) ? list : []);
        }

        if (!pick.url || pick.confidence < minConfidence) {
          const reason = pick.url ? `confidence ${pick.confidence} < ${minConfidence}` : undefined;
          results.push({ id: p.id, name, status: "no_match", reason });
          await supabase.from("backfill_match_log").insert({
            ...logEntry, status: "no_match", reason,
            confidence: pick.confidence, candidates: pick.candidates,
          });
          return;
        }

        // Auto-accept threshold: Clearbit needs 0.85, Firecrawl needs 0.9.
        // Below that but above minConfidence → queue for admin review instead of writing.
        const autoAccept = source === "clearbit" ? 0.85 : 0.9;
        const needsReview = pick.confidence < autoAccept;

        if (needsReview && !dryRun) {
          await supabase.from("website_url_review_queue").insert({
            product_id: p.id,
            product_name: name,
            candidate_url: pick.url,
            candidate_domain: pick.host,
            confidence: pick.confidence,
            source,
            candidates: pick.candidates,
            status: "pending",
          });
          results.push({ id: p.id, name, status: "queued_review", website_url: pick.url, confidence: pick.confidence, source });
          await supabase.from("backfill_match_log").insert({
            ...logEntry,
            status: "queued_review",
            matched_url: pick.url,
            matched_domain: pick.host,
            confidence: pick.confidence,
            candidates: pick.candidates,
            reason: `source:${source} below auto-accept ${autoAccept}`,
          });
          return;
        }

        if (!dryRun) {
          const { error: upErr } = await supabase
            .from("products").update({ website_url: pick.url }).eq("id", p.id);
          if (upErr) {
            results.push({ id: p.id, name, status: "error", reason: upErr.message });
            await supabase.from("backfill_match_log").insert({
              ...logEntry, status: "error", reason: upErr.message,
              matched_url: pick.url, matched_domain: pick.host,
              confidence: pick.confidence, candidates: pick.candidates,
            });
            return;
          }
        }
        results.push({ id: p.id, name, status: dryRun ? "match" : "updated", website_url: pick.url, confidence: pick.confidence, source });
        await supabase.from("backfill_match_log").insert({
          ...logEntry,
          status: dryRun ? "match" : "updated",
          matched_url: pick.url,
          matched_domain: pick.host,
          confidence: pick.confidence,
          candidates: pick.candidates,
          reason: `source:${source}`,
        });

      } catch (e) {
        results.push({ id: p.id, name, status: "error", reason: String(e) });
        await supabase.from("backfill_match_log").insert({
          ...logEntry, status: "error", reason: String(e),
        });
      }
    }

    // Worker pool with bounded concurrency + mid-batch miss-rate abort.
    let cursor = 0;
    async function worker() {
      while (!aborted) {
        const i = cursor++;
        if (i >= rows.length) return;
        await processOne(rows[i]);
        // Check miss rate among non-skipped attempts; abort if too high.
        const attempted = results.filter((r) => r.status !== "skipped");
        if (attempted.length >= minSample) {
          const misses = attempted.filter((r) => r.status === "no_match" || r.status === "error").length;
          const missRate = misses / attempted.length;
          if (missRate > maxMissRate) {
            aborted = true;
            abortReason = `miss rate ${(missRate * 100).toFixed(0)}% > ${(maxMissRate * 100).toFixed(0)}%`;
            return;
          }
        }
        if (rateLimitMs) await new Promise((r) => setTimeout(r, rateLimitMs));
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));

    const summary = {
      total: results.length,
      updated: results.filter((r) => r.status === "updated").length,
      queued_review: results.filter((r) => r.status === "queued_review").length,
      no_match: results.filter((r) => r.status === "no_match").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      aborted, abort_reason: abortReason,
      settings: { limit, multiplier, concurrency, minConfidence, maxMissRate, rateLimitMs },
    };

    return new Response(JSON.stringify({ success: true, dry_run: dryRun, summary, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
