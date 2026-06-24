import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, ArrowRight, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MobileFilterDrawer,
  FilterSection,
  FilterOptionList,
} from "@/components/MobileFilterDrawer";
import { cn } from "@/lib/utils";

type Sort = "popular" | "completed" | "alpha";
const SORT_VALUES: Sort[] = ["popular", "completed", "alpha"];

export default function BuyerGuidesListPage() {
  // URL is the source of truth so back/forward restores filter + sort.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSort = searchParams.get("sort");
  const sort: Sort = (SORT_VALUES as string[]).includes(rawSort || "")
    ? (rawSort as Sort)
    : "popular";
  const category = searchParams.get("category") || "all";

  const setParam = (key: string, value: string | null, defaultValue?: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };
  const setSort = (next: Sort) => setParam("sort", next, "popular");
  const setCategory = (next: string) => setParam("category", next, "all");


  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["buyer-guides-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("buyer_guides")
        .select("id, title, slug, description, view_count, completion_count, category_id, categories(name)")
        .eq("is_published", true)
        .order("view_count", { ascending: false });
      return data || [];
    },
  });

  const allCategories = useMemo(() => {
    const set = new Map<string, number>();
    guides.forEach((g: any) => {
      const name = g.categories?.name;
      if (name) set.set(name, (set.get(name) || 0) + 1);
    });
    return Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
  }, [guides]);

  const filtered = useMemo(() => {
    let list = guides as any[];
    if (category !== "all") {
      list = list.filter((g) => g.categories?.name === category);
    }
    switch (sort) {
      case "completed":
        list = [...list].sort((a, b) => (b.completion_count || 0) - (a.completion_count || 0));
        break;
      case "alpha":
        list = [...list].sort((a, b) => String(a.title).localeCompare(String(b.title)));
        break;
      case "popular":
      default:
        list = [...list].sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    }
    return list;
  }, [guides, sort, category]);

  const activeCount = (sort !== "popular" ? 1 : 0) + (category !== "all" ? 1 : 0);
  const clearAll = () => {
    setSort("popular");
    setCategory("all");
  };

  const sortOptions: { value: Sort; label: string }[] = [
    { value: "popular", label: "Most popular" },
    { value: "completed", label: "Most completed" },
    { value: "alpha", label: "A → Z" },
  ];

  return (
    <>
      <SeoHead title="Buyer Guides — ReviewHunts" description="Interactive guides to help you find the perfect software." />
      <main className="container py-8 md:py-12 max-w-4xl">
        <div className="text-center mb-8 md:mb-10">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Compass className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Buyer Guides</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">Answer a few questions and get personalized software recommendations.</p>
        </div>

        {/* Desktop sort + filter row */}
        <div className="hidden md:flex items-center justify-end gap-2 mb-5">
          {allCategories.length > 0 && (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44 rounded-xl h-9 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {allCategories.map(([c, n]) => (
                  <SelectItem key={c} value={c}>{c} ({n})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-44 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile filter & sort drawer */}
        <MobileFilterDrawer
          activeCount={activeCount}
          resultCount={filtered.length}
          resultLabel="guides"
          onClear={clearAll}
          className="mb-4"
        >
          <FilterSection title="Sort by">
            <FilterOptionList<Sort>
              value={sort}
              onChange={setSort}
              options={sortOptions}
            />
          </FilterSection>
          {allCategories.length > 0 && (
            <FilterSection title="Category">
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategory("all")}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between min-h-11",
                    category === "all"
                      ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                      : "bg-muted/50 text-foreground hover:bg-muted",
                  )}
                >
                  <span>All categories</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{guides.length}</span>
                </button>
                {allCategories.map(([c, n]) => {
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between min-h-11",
                        active
                          ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                          : "bg-muted/50 text-foreground hover:bg-muted",
                      )}
                    >
                      <span className="truncate">{c}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
                    </button>
                  );
                })}
              </div>
            </FilterSection>
          )}
        </MobileFilterDrawer>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Compass className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No guides match your filters.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((g: any, i: number) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to={`/guides/${g.slug}`}>
                  <Card className="border-border/50 hover:border-primary/30 transition-all group cursor-pointer h-full">
                    <CardContent className="p-5 flex flex-col h-full">
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">{g.title}</h3>
                      {g.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{g.description}</p>}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{g.view_count}</span>
                          <span>{g.completion_count} completed</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
