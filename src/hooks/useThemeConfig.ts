import { useEffect } from "react";
import { loadThemeConfig } from "@/lib/theme-config";

/** Loads admin-configured theme colors once on app mount. */
export function useThemeConfig() {
  useEffect(() => {
    loadThemeConfig();
  }, []);
}
