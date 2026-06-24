import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FAQItem {
  q: string;
  a: string;
}

interface UseFAQOptions {
  entityType: "product" | "comparison" | "category" | "guide" | "glossary" | "blog";
  entitySlug: string | undefined;
  context: {
    name: string;
    description?: string;
    category?: string;
    extra?: Record<string, unknown>;
  };
  /** Only fetch when enabled (default true). Useful to wait for context to load. */
  enabled?: boolean;
}

interface UseFAQResult {
  items: FAQItem[];
  loading: boolean;
  error: string | null;
  cached: boolean;
}

/**
 * Loads cached AI-generated FAQs from `faq_cache`, generating on first miss
 * via the `generate-faq` edge function. Safe to call from any public page.
 */
export function useFAQ({ entityType, entitySlug, context, enabled = true }: UseFAQOptions): UseFAQResult {
  const [items, setItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    if (!enabled || !entitySlug || !context?.name) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Cheap direct cache read
        const { data: row } = await (supabase
          .from("faq_cache" as any)
          .select("items, source")
          .eq("entity_type", entityType)
          .eq("entity_slug", entitySlug)
          .maybeSingle() as any);

        if (!cancelled && row?.items && Array.isArray(row.items) && row.items.length > 0) {
          setItems(row.items as FAQItem[]);
          setCached(true);
          setLoading(false);
          return;
        }

        // 2. Miss → trigger generation
        const { data, error: fnErr } = await supabase.functions.invoke("generate-faq", {
          body: {
            entity_type: entityType,
            entity_slug: entitySlug,
            context,
          },
        });

        if (cancelled) return;
        if (fnErr) throw new Error(fnErr.message);
        if (data?.error) throw new Error(data.error);

        const generated = (data?.items ?? []) as FAQItem[];
        setItems(generated);
        setCached(Boolean(data?.cached));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, entityType, entitySlug, context?.name]);

  return { items, loading, error, cached };
}
