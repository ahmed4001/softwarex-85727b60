import { supabase } from "@/integrations/supabase/client";

export type ThemeColors = {
  primary?: string; // HSL triplet "H S% L%"
  secondary?: string;
  background?: string;
  button?: string;
};

const STYLE_ID = "admin-theme-overrides";

function hexToHsl(hex: string): string | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Accepts either a hex (#aabbcc) or an HSL triplet ("210 50% 50%"). */
export function normalizeColor(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) return hexToHsl(trimmed);
  if (/^\d+\s+\d+%\s+\d+%$/.test(trimmed)) return trimmed;
  return null;
}

export function applyTheme(colors: ThemeColors) {
  const root = document.documentElement;
  const map: Array<[keyof ThemeColors, string]> = [
    ["primary", "--primary"],
    ["secondary", "--secondary"],
    ["background", "--background"],
  ];
  for (const [key, cssVar] of map) {
    const v = normalizeColor(colors[key]);
    if (v) root.style.setProperty(cssVar, v);
    else root.style.removeProperty(cssVar);
  }
  const btn = normalizeColor(colors.button);
  if (btn) root.style.setProperty("--button", btn);
  else root.style.removeProperty("--button");

  // Inject override so any element using --primary as button background swaps to --button when set
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = btn
    ? `.bg-primary{background-color:hsl(var(--button)) !important;} .hover\:bg-primary\/90:hover{background-color:hsl(var(--button) / 0.9) !important;} .border-primary{border-color:hsl(var(--button)) !important;}`
    : "";
}

export async function loadThemeConfig() {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", ["primary_color", "secondary_color", "background_color", "button_color"]);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = typeof r.value === "string" ? r.value : r.value?.toString?.() ?? ""; });
    applyTheme({
      primary: map.primary_color,
      secondary: map.secondary_color,
      background: map.background_color,
      button: map.button_color,
    });
  } catch {
    // ignore — keep defaults
  }
}
