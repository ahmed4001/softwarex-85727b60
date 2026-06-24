/**
 * Micro-benchmark for the products listing/sorting/filtering queries that
 * benefit from the new composite indexes:
 *   - idx_products_active_avg_rating       (is_active, avg_rating DESC NULLS LAST)
 *   - idx_products_active_total_reviews    (is_active, total_reviews DESC NULLS LAST)
 *
 * Strategy: run each query N times against the live REST API, record per-call
 * latency, and report p50/p95/avg + a representative response size. Run once
 * BEFORE applying the migration and once AFTER, then diff the two JSON files.
 *
 * Usage:
 *   # before applying the migration
 *   PERF_LABEL=before bun run scripts/bench-products-indexes.ts
 *
 *   # after applying the migration
 *   PERF_LABEL=after  bun run scripts/bench-products-indexes.ts
 *
 *   # compare
 *   bun run scripts/bench-products-indexes.ts --compare
 *
 * Env:
 *   VITE_SUPABASE_URL              (required)
 *   VITE_SUPABASE_PUBLISHABLE_KEY  (required)
 *   PERF_LABEL                     ("before" | "after", default "run")
 *   PERF_ITERATIONS                (default 20)
 *   PERF_WARMUP                    (default 3)
 *   PERF_OUT_DIR                   (default ./perf-bench)
 */

import fs from "node:fs";
import path from "node:path";

function loadDotEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const LABEL = process.env.PERF_LABEL ?? "run";
const ITER = Number(process.env.PERF_ITERATIONS ?? 20);
const WARMUP = Number(process.env.PERF_WARMUP ?? 3);
const OUT_DIR = process.env.PERF_OUT_DIR ?? "perf-bench";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(2);
}

type Query = {
  id: string;
  description: string;
  path: string; // PostgREST path with query string
};

const QUERIES: Query[] = [
  {
    id: "list_active_by_rating",
    description: "Active products sorted by avg_rating DESC (homepage / top-rated)",
    path: "/rest/v1/products?select=id,slug,name,avg_rating,total_reviews&is_active=eq.true&order=avg_rating.desc.nullslast&limit=24",
  },
  {
    id: "list_active_by_reviews",
    description: "Active products sorted by total_reviews DESC (most reviewed)",
    path: "/rest/v1/products?select=id,slug,name,avg_rating,total_reviews&is_active=eq.true&order=total_reviews.desc.nullslast&limit=24",
  },
  {
    id: "list_active_min_rating",
    description: "Active products filtered by avg_rating >= 4 then sorted",
    path: "/rest/v1/products?select=id,slug,name,avg_rating&is_active=eq.true&avg_rating=gte.4&order=avg_rating.desc.nullslast&limit=48",
  },
  {
    id: "list_active_min_reviews",
    description: "Active products with at least 10 reviews, sorted by rating",
    path: "/rest/v1/products?select=id,slug,name,avg_rating,total_reviews&is_active=eq.true&total_reviews=gte.10&order=avg_rating.desc.nullslast&limit=48",
  },
  {
    id: "count_active",
    description: "Exact count of active products (HEAD with Prefer:count=exact)",
    path: "/rest/v1/products?select=id&is_active=eq.true&limit=1",
  },
];

type Sample = { ms: number; status: number; bytes: number };
type Result = {
  id: string;
  description: string;
  path: string;
  samples: Sample[];
  stats: { count: number; avg: number; p50: number; p95: number; min: number; max: number; bytes: number };
};

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function timeOnce(q: Query): Promise<Sample> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY!,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
  if (q.id === "count_active") headers["Prefer"] = "count=exact";

  const t0 = performance.now();
  const res = await fetch(SUPABASE_URL + q.path, { headers });
  const body = await res.text();
  const ms = performance.now() - t0;
  return { ms, status: res.status, bytes: body.length };
}

async function runQuery(q: Query): Promise<Result> {
  for (let i = 0; i < WARMUP; i++) await timeOnce(q);
  const samples: Sample[] = [];
  for (let i = 0; i < ITER; i++) samples.push(await timeOnce(q));
  const ok = samples.filter((s) => s.status < 400);
  const ms = ok.map((s) => s.ms).sort((a, b) => a - b);
  const avg = ms.reduce((a, b) => a + b, 0) / (ms.length || 1);
  return {
    id: q.id,
    description: q.description,
    path: q.path,
    samples,
    stats: {
      count: ok.length,
      avg: round(avg),
      p50: round(pct(ms, 50)),
      p95: round(pct(ms, 95)),
      min: round(ms[0] ?? 0),
      max: round(ms[ms.length - 1] ?? 0),
      bytes: ok[0]?.bytes ?? 0,
    },
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtMs(n: number) {
  return `${n.toFixed(2)}ms`.padStart(10);
}

async function runAll() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`▶ benchmark "${LABEL}" — ${QUERIES.length} queries × ${ITER} iterations (warmup ${WARMUP})`);
  const results: Result[] = [];
  for (const q of QUERIES) {
    process.stdout.write(`  • ${q.id} ... `);
    const r = await runQuery(q);
    results.push(r);
    console.log(`avg ${fmtMs(r.stats.avg)}  p50 ${fmtMs(r.stats.p50)}  p95 ${fmtMs(r.stats.p95)}  (${r.stats.count}/${ITER} ok)`);
  }
  const outFile = path.join(OUT_DIR, `${LABEL}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ label: LABEL, iterations: ITER, warmup: WARMUP, ranAt: new Date().toISOString(), results }, null, 2),
  );
  console.log(`\n✓ wrote ${outFile}`);
}

function compare() {
  const beforeFile = path.join(OUT_DIR, "before.json");
  const afterFile = path.join(OUT_DIR, "after.json");
  if (!fs.existsSync(beforeFile) || !fs.existsSync(afterFile)) {
    console.error(`Need both ${beforeFile} and ${afterFile}. Run with PERF_LABEL=before and PERF_LABEL=after first.`);
    process.exit(2);
  }
  const before = JSON.parse(fs.readFileSync(beforeFile, "utf8"));
  const after = JSON.parse(fs.readFileSync(afterFile, "utf8"));
  const byId = new Map<string, Result>(before.results.map((r: Result) => [r.id, r]));

  console.log("\nQuery                          before p50 / p95      after p50 / p95      Δp50       Δp95");
  console.log("─".repeat(96));
  for (const a of after.results as Result[]) {
    const b = byId.get(a.id);
    if (!b) continue;
    const d50 = a.stats.p50 - b.stats.p50;
    const d95 = a.stats.p95 - b.stats.p95;
    const pct50 = b.stats.p50 ? ((d50 / b.stats.p50) * 100).toFixed(1) : "—";
    const pct95 = b.stats.p95 ? ((d95 / b.stats.p95) * 100).toFixed(1) : "—";
    console.log(
      `${a.id.padEnd(30)} ${fmtMs(b.stats.p50)} / ${fmtMs(b.stats.p95)}   ${fmtMs(a.stats.p50)} / ${fmtMs(a.stats.p95)}   ${pct50.padStart(6)}%   ${pct95.padStart(6)}%`,
    );
  }
  console.log("");
}

if (process.argv.includes("--compare")) {
  compare();
} else {
  runAll().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
