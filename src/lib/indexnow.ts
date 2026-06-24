import { supabase } from "@/integrations/supabase/client";

/**
 * Ping IndexNow (Bing/Yandex/Seznam) to instantly notify search engines of new/updated URLs.
 * Pass full URLs (https://reviewhunts.com/...) or paths (/product/foo).
 */
export async function pingIndexNow(urls: string | string[]) {
  const list = Array.isArray(urls) ? urls : [urls];
  if (list.length === 0) return { submitted: 0 };
  try {
    const { data, error } = await supabase.functions.invoke("indexnow-submit", {
      body: { urls: list },
    });
    if (error) {
      console.warn("[indexnow] failed:", error.message);
      return { submitted: 0, error: error.message };
    }
    return data;
  } catch (e) {
    console.warn("[indexnow] threw:", e);
    return { submitted: 0, error: (e as Error).message };
  }
}
