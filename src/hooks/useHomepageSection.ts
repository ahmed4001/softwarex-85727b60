import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HomepageSectionConfig {
  enabled: boolean;
  curatedIds: string[];
  loaded: boolean;
}

export function useHomepageSection(key: string): HomepageSectionConfig {
  const { data } = useQuery({
    queryKey: ["homepage-section", key],
    queryFn: async () => {
      const [sec, items] = await Promise.all([
        supabase.from("homepage_sections" as any).select("is_enabled").eq("key", key).maybeSingle(),
        supabase.from("homepage_section_products" as any).select("product_id, position").eq("section_key", key).order("position", { ascending: true }),
      ]);
      const enabled = (sec.data as any)?.is_enabled ?? true;
      const curatedIds = ((items.data as any[]) || []).map((r) => r.product_id as string);
      return { enabled, curatedIds };
    },
    staleTime: 60_000,
  });
  return { enabled: data?.enabled ?? true, curatedIds: data?.curatedIds ?? [], loaded: !!data };
}
