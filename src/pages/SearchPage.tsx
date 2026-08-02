import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Search, SlidersHorizontal, X, Sparkles, Wand2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PaginationControls } from "@/components/PaginationControls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/useDebounce";
import { trackEvent } from "@/lib/analytics";

const PAGE_SIZE = 20;
const PRICING_MODELS = [
  { value: "all", label: "All Pricing" },
  { value: "free", label: "Free" },
  { value: "freemium", label: "Freemium" },
  { value: "paid", label: "Paid" },
  { value: "subscription", label: "Subscription" },
  { value: "one-time", label: "One-time" },
];

const QUICK_PRICING = ["all", "free", "freemium", "paid"] as const;

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const debouncedQ = useDebounce(q, 250);
  const [page, setPage] = useState(0);
  const [tierFilter, setTierFilter] = useState("all");
  const [pricingFilter, setPricingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ratingRange, setRatingRange] = useState([0]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const debouncedTier = useDebounce(tierFilter, 200);
  const debouncedPricing = useDebounce(pricingFilter, 200);
  const debouncedCategory = useDebounce(categoryFilter, 200);
  const debouncedRating = useDebounce(ratingRange[0], 200);

  const hasActiveFilters = pricingFilter !== "all" || categoryFilter !== "all" || ratingRange[0] > 0 || tierFilter !== "all";
  const activeFilterCount = [pricingFilter !== "all", categoryFilter !== "all", ratingRange[0] > 0, tierFilter !== "all"].filter(Boolean).length;

  useEffect(() => { setPage(0); }, [debouncedQ, debouncedTier, debouncedPricing, debouncedCategory, debouncedRating]);
  useEffect(() => {
    if (debouncedQ) trackEvent("search_query", { query: debouncedQ, ai_mode: aiMode, is_mobile: isMobile });
  }, [debouncedQ, aiMode, isMobile]);

  // AI-powered search
  const { data: aiResults, isLoading: aiLoading } = useQuery({
    queryKey: ["ai-search", q],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-smart-search", {
        body: { query: q },
      });
      if (error) throw error;
      return data as { results: any[]; interpretation: string; filters: any };
    },
    enabled: aiMode && q.length >= 3,
    staleTime: 60000,
  });

  const { data: categories } = useQuery({
    queryKey: ["search-categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .is("parent_id", null)
        .order("name");
      return data || [];
    },
  });

  const { data: totalCount } = useQuery({
    queryKey: ["search-count", debouncedQ, debouncedTier, debouncedPricing, debouncedCategory, debouncedRating],
    staleTime: 60_000,
    queryFn: async () => {
      if (!debouncedQ.trim()) return 0;
      let query = supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .ilike("name", `%${debouncedQ}%`);
      if (debouncedTier !== "all") query = query.eq("is_sponsored", true).eq("sponsor_tier", debouncedTier as any);
      if (debouncedPricing !== "all") query = query.eq("pricing_model", debouncedPricing as any);
      if (debouncedCategory !== "all") query = query.eq("category_id", debouncedCategory);
      if (debouncedRating > 0) query = query.gte("avg_rating", debouncedRating);
      const { count } = await query;
      return count ?? 0;
    },
    enabled: debouncedQ.length > 0,
  });

  const { data: products, isLoading, isFetching } = useQuery({
    queryKey: ["search", debouncedQ, page, debouncedTier, debouncedPricing, debouncedCategory, debouncedRating],
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!debouncedQ.trim()) return [];
      const { applyRealFirstOrder, realFirstComparator } = await import("@/lib/product-order");
      let query = supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name)")
        .eq("is_active", true)
        .ilike("name", `%${debouncedQ}%`);
      if (debouncedTier !== "all") query = query.eq("is_sponsored", true).eq("sponsor_tier", debouncedTier as any);
      if (debouncedPricing !== "all") query = query.eq("pricing_model", debouncedPricing as any);
      if (debouncedCategory !== "all") query = query.eq("category_id", debouncedCategory);
      if (debouncedRating > 0) query = query.gte("avg_rating", debouncedRating);
      query = query.order("is_sponsored", { ascending: false });
      query = applyRealFirstOrder(query, "rating");
      const { data } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const tierOrder: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
      return (data || []).sort((a: any, b: any) => {
        if (a.is_sponsored && !b.is_sponsored) return -1;
        if (!a.is_sponsored && b.is_sponsored) return 1;
        if (a.is_sponsored && b.is_sponsored) {
          return (tierOrder[a.sponsor_tier] ?? 3) - (tierOrder[b.sponsor_tier] ?? 3);
        }
        return realFirstComparator(a, b);
      });
    },
    enabled: debouncedQ.length > 0,
  });

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  const clearFilters = () => {
    setPricingFilter("all");
    setCategoryFilter("all");
    setRatingRange([0]);
    setTierFilter("all");
    trackEvent("search_filters_clear", { query: debouncedQ, is_mobile: isMobile });
  };

  const handlePricingChange = (v: string) => {
    setPricingFilter(v);
    trackEvent("search_filter_change", { type: "pricing", value: v, is_mobile: isMobile });
  };


  const displayProducts = aiMode ? (aiResults?.results || []) : products;
  const displayLoading = aiMode ? aiLoading : isLoading;

  return (
    <>
      <SeoHead
        title={q ? `${t("common.search")}: ${q}` : t("common.search")}
        description="Search 1000+ software products, reviews and comparisons on ReviewHunts."
        canonicalUrl="/search"
        robots={q ? "noindex, follow" : "index, follow"}
      />
      <div className="container py-8">
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            {aiMode ? (
              <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-pulse" />
            ) : (
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            )}
            <Input
              value={q}
              onChange={(e) => setParams({ q: e.target.value })}
              placeholder={aiMode ? "Try: 'best CRM for startups under $50/mo'" : t("searchPage.searchSoftware")}
              className={cn("h-14 pl-12 pr-32 text-lg rounded-2xl", aiMode && "ring-2 ring-primary/30")}
            />
            <Button
              variant={aiMode ? "default" : "outline"}
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 gap-1.5 rounded-xl"
              onClick={() => setAiMode(!aiMode)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              AI Search
            </Button>
          </div>
          {aiMode && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Ask in natural language — AI understands pricing, categories, ratings, and more
            </p>
          )}
        </div>

        {aiMode && aiResults?.interpretation && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">{aiResults.interpretation}</span>
            {aiResults.filters?.pricing_model && <Badge variant="secondary">{aiResults.filters.pricing_model}</Badge>}
            {aiResults.filters?.max_price && <Badge variant="secondary">≤${aiResults.filters.max_price}/mo</Badge>}
            {aiResults.filters?.min_rating && <Badge variant="secondary">{aiResults.filters.min_rating}+ ★</Badge>}
          </div>
        )}

        {!aiMode && q && <p className="text-muted-foreground mb-4">{t("searchPage.resultsFor", { count: totalCount ?? 0, query: q })}</p>}

        {!aiMode && q && (
          <>
            {/* Mobile: sticky pricing chips + filter sheet */}
            <div className="md:hidden sticky top-[56px] z-20 -mx-4 px-4 py-2.5 mb-4 bg-background/85 backdrop-blur-xl border-b border-border flex items-center gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 -mr-2 pr-2">
                {QUICK_PRICING.map((v) => {
                  const label = PRICING_MODELS.find((m) => m.value === v)?.label || v;
                  return (
                    <button
                      key={v}
                      onClick={() => handlePricingChange(v)}
                      className={cn(
                        "h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors border",
                        pricingFilter === v
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <Sheet open={mobileFiltersOpen} onOpenChange={(o) => { setMobileFiltersOpen(o); if (o) trackEvent("search_filter_open", { is_mobile: true }); }}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl h-9 px-3 gap-1.5 flex-shrink-0 relative">
                    <SlidersHorizontal className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="py-4 space-y-5">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing</label>
                      <Select value={pricingFilter} onValueChange={handlePricingChange}>
                        <SelectTrigger className="rounded-xl h-11 mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRICING_MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                      <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); trackEvent("search_filter_change", { type: "category", value: v, is_mobile: true }); }}>
                        <SelectTrigger className="rounded-xl h-11 mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sponsor Tier</label>
                      <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); trackEvent("search_filter_change", { type: "tier", value: v, is_mobile: true }); }}>
                        <SelectTrigger className="rounded-xl h-11 mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Products</SelectItem>
                          <SelectItem value="gold">🥇 Gold</SelectItem>
                          <SelectItem value="silver">🥈 Silver</SelectItem>
                          <SelectItem value="bronze">🥉 Bronze</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Min Rating: {ratingRange[0] > 0 ? `${ratingRange[0]}+ ★` : "Any"}
                      </label>
                      <div className="pt-3 px-1">
                        <Slider value={ratingRange} onValueChange={setRatingRange} min={0} max={5} step={0.5} />
                      </div>
                    </div>
                  </div>
                  <SheetFooter className="gap-2">
                    {hasActiveFilters && <Button variant="outline" onClick={clearFilters} className="flex-1 rounded-xl">Clear</Button>}
                    <Button onClick={() => setMobileFiltersOpen(false)} className="flex-1 rounded-xl">Show {totalCount ?? 0} results</Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop: existing filter panel */}
            <div className="hidden md:block mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Button variant={filtersOpen ? "secondary" : "outline"} size="sm" className="gap-2 rounded-xl" onClick={() => setFiltersOpen(!filtersOpen)}>
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
                  )}
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" /> Clear
                  </Button>
                )}
              </div>
              <div className={cn("grid gap-4 overflow-hidden transition-all duration-300", filtersOpen ? "grid-rows-[1fr] opacity-100 mb-4" : "grid-rows-[0fr] opacity-0 h-0")}>
                <div className="min-h-0">
                  <div className="flex flex-wrap gap-3 p-4 rounded-xl border border-border bg-card">
                    <div className="space-y-1.5 min-w-[160px]">
                      <label className="text-xs font-medium text-muted-foreground">Pricing Model</label>
                      <Select value={pricingFilter} onValueChange={handlePricingChange}>
                        <SelectTrigger className="w-44 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRICING_MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 min-w-[160px]">
                      <label className="text-xs font-medium text-muted-foreground">Category</label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-48 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 min-w-[160px]">
                      <label className="text-xs font-medium text-muted-foreground">Sponsor Tier</label>
                      <Select value={tierFilter} onValueChange={setTierFilter}>
                        <SelectTrigger className="w-44 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Products</SelectItem>
                          <SelectItem value="gold">🥇 Gold</SelectItem>
                          <SelectItem value="silver">🥈 Silver</SelectItem>
                          <SelectItem value="bronze">🥉 Bronze</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 min-w-[200px] flex-1">
                      <label className="text-xs font-medium text-muted-foreground">Min Rating: {ratingRange[0] > 0 ? `${ratingRange[0]}+ ★` : "Any"}</label>
                      <div className="pt-1.5 px-1">
                        <Slider value={ratingRange} onValueChange={setRatingRange} min={0} max={5} step={0.5} className="w-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {displayLoading ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />) :
            displayProducts?.map((p: any) => (
              <ProductCard
                key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline}
                logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews}
                pricing_model={p.pricing_model} category_name={p.categories?.name}
                is_featured={p.is_featured} is_sponsored={p.is_sponsored} sponsor_tier={p.sponsor_tier}
              />
            ))
          }
        </div>

        {!displayLoading && q && displayProducts?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">{t("searchPage.noResults")}</p>
            <p>{t("searchPage.tryDifferent")} <Link to="/categories" className="text-primary hover:underline">{t("searchPage.browseCategories")}</Link></p>
          </div>
        )}

        {!aiMode && q && <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} className="mt-10" />}
      </div>
    </>
  );
}
