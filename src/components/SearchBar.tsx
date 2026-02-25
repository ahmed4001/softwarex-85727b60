import { useState, useCallback, useEffect, useRef } from "react";
import { ProductLogo } from "@/components/ProductLogo";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  variant?: "hero" | "compact";
  className?: string;
}

export function SearchBar({ variant = "compact", className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, tagline, logo_url, avg_rating")
      .ilike("name", `%${q}%`)
      .limit(6);
    setResults(data || []);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { navigate(`/search?q=${encodeURIComponent(query)}`); setIsOpen(false); }
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
            variant === "hero" ? "h-5 w-5" : "h-4 w-4"
          )} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            placeholder="Search software, tools, categories..."
            className={cn(
              "border-border bg-card",
              variant === "hero" ? "h-14 pl-12 pr-12 text-lg rounded-2xl shadow-lg" : "h-10 pl-10 pr-10 rounded-lg"
            )}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </form>
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl shadow-xl border border-border z-50 overflow-hidden">
          {results.map((r) => (
            <Link
              key={r.id}
              to={`/product/${r.slug}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <ProductLogo name={r.name} logoUrl={r.logo_url} size="sm" />
              <div>
                <p className="text-sm font-medium text-foreground">{r.name}</p>
                {r.tagline && <p className="text-xs text-muted-foreground line-clamp-1">{r.tagline}</p>}
              </div>
            </Link>
          ))}
          <Link to={`/search?q=${encodeURIComponent(query)}`} onClick={() => setIsOpen(false)} className="block px-4 py-2.5 text-sm text-primary font-medium hover:bg-muted text-center border-t border-border">
            View all results →
          </Link>
        </div>
      )}
    </div>
  );
}
