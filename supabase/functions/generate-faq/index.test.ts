// Integration tests for the generate-faq edge function.
// Verifies: cold vs warm path (model invoked only on cache miss),
// schema validity, idempotent upsert, content-hash invalidation, and `force` refresh.
//
// Run via: supabase test edge functions

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/generate-faq`;

const SLUG = `__test_faq_${crypto.randomUUID().slice(0, 8)}`;
const BASE_CONTEXT = {
  name: "Acme Test Product",
  description: "An automated-test product used to validate the FAQ cache pipeline.",
  category: "Testing",
};

async function call(body: unknown) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function fetchRow() {
  const sb = createClient(SUPABASE_URL, ANON_KEY);
  const { data } = await sb
    .from("faq_cache")
    .select("id, items, source, model, is_edited, content_hash, generated_at")
    .eq("entity_type", "glossary")
    .eq("entity_slug", SLUG);
  return data ?? [];
}

async function cleanup() {
  // Cleanup requires admin/service role; the anon client cannot delete here.
  // Tests use a unique slug so leftover rows are harmless, but we try anyway.
  try {
    const sb = createClient(SUPABASE_URL, ANON_KEY);
    await sb.from("faq_cache").delete().eq("entity_type", "glossary").eq("entity_slug", SLUG);
  } catch { /* ignore */ }
}

Deno.test({
  name: "generate-faq: cold path generates and persists 6 valid FAQ items",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    await cleanup();
    const { status, json } = await call({
      entity_type: "glossary",
      entity_slug: SLUG,
      context: BASE_CONTEXT,
    });

    assertEquals(status, 200, `unexpected status: ${JSON.stringify(json)}`);
    assertEquals(json.cached, false, "first call must be a cache miss");
    assertEquals(json.source, "ai");
    assert(Array.isArray(json.items), "items must be an array");
    assert(json.items.length >= 4 && json.items.length <= 8, `items length out of range: ${json.items.length}`);
    for (const it of json.items) {
      assertEquals(typeof it.q, "string");
      assertEquals(typeof it.a, "string");
      assert(it.q.trim().length > 0, "q must be non-empty");
      assert(it.a.trim().length > 0, "a must be non-empty");
    }

    const rows = await fetchRow();
    assertEquals(rows.length, 1, "exactly one row persisted");
    assertEquals(rows[0].source, "ai");
    assertEquals(rows[0].is_edited, false);
    assert(typeof rows[0].content_hash === "string" && rows[0].content_hash.length === 64, "sha-256 hex stored");
  },
});

Deno.test({
  name: "generate-faq: warm path returns cached items without invoking the model",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const before = await fetchRow();
    assertEquals(before.length, 1, "cold-path test must have run first");
    const generatedAtBefore = before[0].generated_at;

    const { status, json } = await call({
      entity_type: "glossary",
      entity_slug: SLUG,
      context: BASE_CONTEXT,
    });

    assertEquals(status, 200);
    assertEquals(json.cached, true, "second call must be a cache hit");
    assertEquals(json.items.length, before[0].items.length, "cached items returned verbatim");

    const after = await fetchRow();
    assertEquals(after.length, 1, "upsert is idempotent — still exactly one row");
    assertEquals(after[0].id, before[0].id, "row id unchanged");
    assertEquals(after[0].generated_at, generatedAtBefore, "generated_at unchanged on cache hit (no model call)");
  },
});

Deno.test({
  name: "generate-faq: content-hash drift invalidates cache and regenerates",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const before = await fetchRow();
    assertEquals(before.length, 1);
    const idBefore = before[0].id;
    const hashBefore = before[0].content_hash;

    const { status, json } = await call({
      entity_type: "glossary",
      entity_slug: SLUG,
      context: {
        ...BASE_CONTEXT,
        description: BASE_CONTEXT.description + " Updated copy with new facts.",
      },
    });

    assertEquals(status, 200);
    assertEquals(json.cached, false, "drifted content must miss the cache");

    const after = await fetchRow();
    assertEquals(after.length, 1, "still exactly one row (idempotent upsert)");
    assertEquals(after[0].id, idBefore, "row id stable across regeneration");
    assert(after[0].content_hash !== hashBefore, "content_hash must update on regeneration");
  },
});

Deno.test({
  name: "generate-faq: force=true bypasses the cache",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const before = await fetchRow();
    const idBefore = before[0].id;

    const { status, json } = await call({
      entity_type: "glossary",
      entity_slug: SLUG,
      context: BASE_CONTEXT,
      force: true,
    });

    assertEquals(status, 200);
    assertEquals(json.cached, false, "force=true must always regenerate");

    const after = await fetchRow();
    assertEquals(after.length, 1, "still exactly one row after force refresh");
    assertEquals(after[0].id, idBefore, "row id stable — onConflict upsert, not insert");

    await cleanup();
  },
});

Deno.test({
  name: "generate-faq: invalid input returns 400",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { status, json } = await call({ entity_type: "glossary" });
    assertEquals(status, 400);
    assert(typeof json.error === "string");
  },
});
