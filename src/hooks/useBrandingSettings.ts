import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEYS = [
  "logo_height_mobile",
  "logo_height_desktop",
  "logo_max_width_mobile",
  "logo_max_width_desktop",
];

export const DEFAULT_BRANDING = {
  logoHeightMobile: 112,
  logoHeightDesktop: 160,
  logoMaxWidthMobile: 200,
  logoMaxWidthDesktop: 320,
};

const toNum = (v: any, fallback: number) => {
  if (v == null) return fallback;
  const s = String(v).replace(/^"|"$/g, "").trim();
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function useBrandingSettings() {
  const { data } = useQuery({
    queryKey: ["branding-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", KEYS);
      const map: Record<string, any> = {};
      (data || []).forEach((r) => { map[r.key] = r.value; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    logoHeightMobile: toNum(data?.logo_height_mobile, DEFAULT_BRANDING.logoHeightMobile),
    logoHeightDesktop: toNum(data?.logo_height_desktop, DEFAULT_BRANDING.logoHeightDesktop),
    logoMaxWidthMobile: toNum(data?.logo_max_width_mobile, DEFAULT_BRANDING.logoMaxWidthMobile),
    logoMaxWidthDesktop: toNum(data?.logo_max_width_desktop, DEFAULT_BRANDING.logoMaxWidthDesktop),
  };
}
