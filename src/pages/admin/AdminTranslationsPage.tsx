import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { languages } from "@/i18n/languages";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Globe, RefreshCw, CheckCircle2, Clock, AlertCircle, Loader2, Trash2, Search, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import en from "@/i18n/locales/en.json";

const TOP_LANGUAGES = ["zh", "es", "hi", "ar", "pt", "ru", "ja", "de", "ko", "fr"];

export default function AdminTranslationsPage() {
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [langSearch, setLangSearch] = useState("");

  const { data: cached, isLoading } = useQuery({
    queryKey: ["admin-translations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ui_translations")
        .select("lang_code, version, updated_at, translations")
        .order("lang_code");
      return data || [];
    },
  });

  const cachedMap = new Map(cached?.map((c) => [c.lang_code, c]));
  const totalKeys = countKeys(en);

  const regenerate = async (langCode: string) => {
    setRegenerating((prev) => new Set(prev).add(langCode));
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-translate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            languages: [langCode],
            force: true,
            sourceTranslations: en,
          }),
        }
      );
      if (!response.ok) throw new Error("Failed");
      toast.success(`${langCode.toUpperCase()} translations regenerated`);
      queryClient.invalidateQueries({ queryKey: ["admin-translations"] });
      // Clear localStorage cache
      localStorage.removeItem(`i18n_${langCode}`);
    } catch {
      toast.error(`Failed to regenerate ${langCode.toUpperCase()}`);
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(langCode);
        return next;
      });
    }
  };

  const regenerateAll = async () => {
    const missing = TOP_LANGUAGES.filter((l) => !cachedMap.has(l) || getKeyCount(cachedMap.get(l)) < totalKeys * 0.8);
    if (missing.length === 0) {
      // Regenerate all top languages
      for (const lang of TOP_LANGUAGES) {
        regenerate(lang);
      }
    } else {
      for (const lang of missing) {
        regenerate(lang);
      }
    }
  };

  const deleteTranslation = async (langCode: string) => {
    const { error } = await supabase.from("ui_translations").delete().eq("lang_code", langCode);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success(`${langCode.toUpperCase()} cache deleted`);
      localStorage.removeItem(`i18n_${langCode}`);
      queryClient.invalidateQueries({ queryKey: ["admin-translations"] });
    }
  };

  const allLanguages = languages.filter((l) => l.code !== "en");

  return (
    <>
      <SeoHead title="Translations - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Translation Cache</h1>
            <p className="text-muted-foreground">
              {cached?.length || 0} languages cached · {totalKeys} translation keys
            </p>
          </div>
          <Button onClick={regenerateAll} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Regenerate Top 10
          </Button>
        </div>

        {/* Top languages grid */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Priority Languages
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {TOP_LANGUAGES.map((code) => {
              const lang = languages.find((l) => l.code === code);
              const cache = cachedMap.get(code);
              const keyCount = getKeyCount(cache);
              const coverage = totalKeys > 0 ? Math.round((keyCount / totalKeys) * 100) : 0;
              const isRegen = regenerating.has(code);

              return (
                <div
                  key={code}
                  className="rounded-xl border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
                        {code}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {lang?.nativeName}
                      </span>
                    </div>
                      {cache ? (
                        coverage >= 90 ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )
                      ) : (
                      <Clock className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>

                  {cache ? (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{keyCount} / {totalKeys} keys</span>
                          <span>{coverage}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${coverage}%`,
                              backgroundColor: coverage >= 90
                                ? "hsl(var(--primary))"
                                : "hsl(var(--destructive))",
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground/60">
                        Updated {new Date(cache.updated_at).toLocaleDateString()}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/50">Not cached</p>
                  )}

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      disabled={isRegen}
                      onClick={() => regenerate(code)}
                    >
                      {isRegen ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      <span className="ml-1">{cache ? "Regen" : "Generate"}</span>
                    </Button>
                    {cache && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteTranslation(code)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Generate any language */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Generate Any Language
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              disabled={regenerating.size > 0}
              onClick={() => {
                const uncached = allLanguages.filter((l) => !cachedMap.has(l.code));
                if (uncached.length === 0) {
                  toast.info("All languages are already cached");
                  return;
                }
                uncached.forEach((l) => regenerate(l.code));
                toast.success(`Generating ${uncached.length} languages...`);
              }}
            >
              <Plus className="h-3 w-3" />
              Generate All Uncached ({allLanguages.filter((l) => !cachedMap.has(l.code)).length})
            </Button>
          </div>
          <div className="relative max-w-sm mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search languages..."
              value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {allLanguages
              .filter((l) =>
                l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
                l.nativeName.toLowerCase().includes(langSearch.toLowerCase()) ||
                l.code.toLowerCase().includes(langSearch.toLowerCase())
              )
              .map((lang) => {
                const cache = cachedMap.get(lang.code);
                const isRegen = regenerating.has(lang.code);
                const keyCount = getKeyCount(cache);
                const coverage = totalKeys > 0 ? Math.round((keyCount / totalKeys) * 100) : 0;

                return (
                  <div
                    key={lang.code}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase w-5 flex-shrink-0">
                        {lang.code}
                      </span>
                      <span className="text-xs font-medium text-foreground truncate">
                        {lang.nativeName}
                      </span>
                      {cache && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{coverage}%</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={cache ? "ghost" : "outline"}
                      className="h-6 w-6 p-0 flex-shrink-0"
                      disabled={isRegen}
                      onClick={() => regenerate(lang.code)}
                      title={cache ? "Regenerate" : "Generate"}
                    >
                      {isRegen ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : cache ? (
                        <RefreshCw className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* All cached languages table */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            All Cached Languages ({cached?.length || 0})
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Language</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Coverage</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Last Updated</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                )}
                {cached?.map((c) => {
                  const lang = languages.find((l) => l.code === c.lang_code);
                  const keyCount = getKeyCount(c);
                  const coverage = totalKeys > 0 ? Math.round((keyCount / totalKeys) * 100) : 0;
                  const isRegen = regenerating.has(c.lang_code);

                  return (
                    <tr key={c.lang_code} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground/40" />
                          <span className="text-xs font-mono text-muted-foreground uppercase w-6">
                            {c.lang_code}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {lang?.nativeName || c.lang_code}
                          </span>
                          {lang?.name && lang.name !== lang.nativeName && (
                            <span className="text-xs text-muted-foreground">({lang.name})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${coverage}%`,
                                backgroundColor: coverage >= 90
                                  ? "hsl(var(--primary))"
                                  : "hsl(var(--destructive))",
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{coverage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {coverage >= 90 ? (
                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                            Complete
                          </Badge>
                        ) : coverage > 0 ? (
                          <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive border-0">
                            Partial
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Empty</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(c.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={isRegen}
                            onClick={() => regenerate(c.lang_code)}
                          >
                            {isRegen ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Regenerate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteTranslation(c.lang_code)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && (!cached || cached.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No cached translations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function countKeys(obj: Record<string, any>, prefix = ""): number {
  let count = 0;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      count += countKeys(obj[key], `${prefix}${key}.`);
    } else {
      count++;
    }
  }
  return count;
}

function getKeyCount(cache: any): number {
  if (!cache?.translations) return 0;
  const translations = typeof cache.translations === "string"
    ? JSON.parse(cache.translations)
    : cache.translations;
  return countKeys(translations);
}
