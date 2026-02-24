import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { loadLanguage } from "@/i18n";
import { getLanguage } from "@/i18n/languages";

/**
 * On login, loads the user's preferred language from their profile.
 * This ensures the language persists across devices and sessions.
 */
export function useLanguagePreference() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", user.id)
        .single();

      const lang = data?.preferred_language;
      if (lang && lang !== "en") {
        await loadLanguage(lang);
        const langInfo = getLanguage(lang);
        document.documentElement.dir = langInfo?.dir || "ltr";
        document.documentElement.lang = lang;
      }
    };

    load();
  }, [user, loading]);
}
