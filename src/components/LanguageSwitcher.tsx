import { useState } from "react";
import { useTranslation } from "react-i18next";
import { languages, getLanguage } from "@/i18n/languages";
import { loadLanguage } from "@/i18n";
import { Globe, Loader2, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const currentLang = getLanguage(i18n.language) || languages[0];

  const filtered = languages.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (code: string) => {
    if (code === i18n.language) {
      setOpen(false);
      return;
    }
    setLoading(true);
    await loadLanguage(code);
    // Set document direction for RTL languages
    const lang = getLanguage(code);
    document.documentElement.dir = lang?.dir || "ltr";
    document.documentElement.lang = code;
    setLoading(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-sm font-medium px-2"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{currentLang.code.toUpperCase()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search language..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="h-72">
          <div className="p-1">
            {filtered.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                  lang.code === i18n.language
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 uppercase font-mono">
                    {lang.code}
                  </span>
                  <span>{lang.nativeName}</span>
                  {lang.nativeName !== lang.name && (
                    <span className="text-xs text-muted-foreground">({lang.name})</span>
                  )}
                </div>
                {lang.code === i18n.language && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6">
                No languages found
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
