import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ListFilter, LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { PaginationControls } from "@/components/PaginationControls";
import { CategoryGrid } from "@/components/CategoryGrid";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAbVariant } from "@/hooks/useAbVariant";
import { useDebounce } from "@/hooks/useDebounce";
import { trackEvent } from "@/lib/analytics";
import { RelatedInternalLinks } from "@/components/RelatedInternalLinks";

const PAGE_SIZE = 20;
const STALE_5_MIN = 5 * 60 * 1000;

export default function CategoryPage() {
  const { slug } = useParams();
  const [sort, setSort] = useState("rating");
  const [tierFilter, setTierFilter] = useState("all");
  const [page, setPage] = useState(0);
  const isAll = slug === "all";
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // Mobile-first filter drawer is the only mobile layout — A/B flag retained
  // for analytics tagging on existing dashboards but always resolves to B.
  const [filterVariant] = useAbVariant("mobile_filter_v1", ["A", "B"]);
  const useNewMobileFilters = isMobile;


  // Debounce filter inputs so users tapping multiple chips don't fire 5 separate queries.
  const debouncedSort = useDebounce(sort, 200);
  const debouncedTier = useDebounce(tierFilter, 200);

  useEffect(() => {
    trackEvent("category_view", { slug: slug || "", variant: filterVariant, is_mobile: isMobile });
  }, [slug, filterVariant, isMobile]);

  const { data: category } = useQuery({
    queryKey: ["category", slug],
    staleTime: STALE_5_MIN,
    queryFn: async () => {
      if (isAll) return { name: t("categoryPage.allCategories"), description: t("categories.subtitle"), slug: "all" };
      const { data } = await supabase.from("categories").select("*").eq("slug", slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-list"],
    staleTime: STALE_5_MIN,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("is_active", true).order("name");
      return data || [];
    },
  });

  // Total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ["products-category-count", slug, debouncedTier],
    staleTime: 60_000,
    queryFn: async () => {
      let query = supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (!isAll && category && "id" in category) query = query.eq("category_id", (category as any).id);
      if (debouncedTier !== "all") {
        query = query.eq("is_sponsored", true).eq("sponsor_tier", debouncedTier as any);
      }
      const { count } = await query;
      return count ?? 0;
    },
    enabled: !!category,
  });

  const { data: products, isLoading, isFetching } = useQuery({
    queryKey: ["products-category", slug, debouncedSort, page, debouncedTier],
    staleTime: 60_000,
    placeholderData: (prev) => prev, // keep previous results visible while refetching
    queryFn: async () => {
      const { applyRealFirstOrder, realFirstComparator } = await import("@/lib/product-order");
      let query = supabase.from("products").select("*, categories!products_category_id_fkey(name)").eq("is_active", true);
      if (!isAll && category && "id" in category) query = query.eq("category_id", (category as any).id);
      if (debouncedTier !== "all") {
        query = query.eq("is_sponsored", true).eq("sponsor_tier", debouncedTier as any);
      }
      const tierOrder: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
      query = applyRealFirstOrder(query, debouncedSort as any);
      const { data } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const results = data || [];
      return results.sort((a: any, b: any) => {
        if (a.is_sponsored && !b.is_sponsored) return -1;
        if (!a.is_sponsored && b.is_sponsored) return 1;
        if (a.is_sponsored && b.is_sponsored) {
          return (tierOrder[a.sponsor_tier] ?? 3) - (tierOrder[b.sponsor_tier] ?? 3);
        }
        return realFirstComparator(a, b);
      });
    },
    enabled: !!category,
  });

  // Fetch all products for the Grid (no pagination)
  const { data: allGridProducts } = useQuery({
    queryKey: ["products-grid", slug],
    staleTime: STALE_5_MIN,
    queryFn: async () => {
      const { applyRealFirstOrder } = await import("@/lib/product-order");
      let query = supabase.from("products")
        .select("id, name, slug, logo_url, avg_rating, total_reviews, click_count, view_count, comparison_count, info_score")
        .eq("is_active", true);
      if (!isAll && category && "id" in category) query = query.eq("category_id", (category as any).id);
      const { data } = await applyRealFirstOrder(query, "rating").limit(50);
      return data || [];
    },
    enabled: !!category && !isAll,
  });

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  // Reset page when sort/filter/slug changes + track analytics
  const handleSortChange = (value: string) => {
    setSort(value);
    setPage(0);
    trackEvent("category_sort_change", { slug: slug || "", sort: value, variant: filterVariant, is_mobile: isMobile });
  };

  const handleTierFilterChange = (value: string) => {
    setTierFilter(value);
    setPage(0);
    trackEvent("category_filter_change", { slug: slug || "", tier: value, variant: filterVariant, is_mobile: isMobile });
  };

  const handleFilterDrawerOpen = (kind: "categories" | "tier") => {
    trackEvent("category_filter_open", { slug: slug || "", kind, variant: filterVariant, is_mobile: isMobile });
  };

  return (
    <>
      <SeoHead
        title={(category as any)?.seo_title || (category?.name ? `Best ${category.name} Software in 2026 — Compared` : t("categories.title"))}
        description={(category as any)?.seo_description || (category?.name ? `Compare the best ${category.name} software in 2026. Real user reviews, pricing, pros & cons across ${totalCount || 'top'} tools — pick the right one in minutes.`.slice(0, 154) : t("categories.subtitle"))}
        keywords={(category as any)?.seo_keywords || `${category?.name} software, best ${category?.name} tools, ${category?.name} reviews 2026`}
        canonicalUrl={`https://reviewhunts.com/category/${slug}`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": category?.name || t("categories.title"),
            "description": category?.description || t("categories.subtitle"),
            "url": `https://reviewhunts.com/category/${slug}`,
            "numberOfItems": totalCount ?? (products?.length ?? 0),
            ...(category && (category as any).updated_at && {
              "dateModified": new Date((category as any).updated_at).toISOString().split("T")[0],
            }),
            "isPartOf": {
              "@type": "WebSite",
              "name": "ReviewHunts",
              "url": "https://reviewhunts.com",
            },
            "about": {
              "@type": "Thing",
              "name": category?.name ? `${category.name} software` : "Business software",
            },
            ...(products && products.length > 0 && {
              "mainEntity": {
                "@type": "ItemList",
                "name": category?.name ? `Best ${category.name} software` : "Top software",
                "numberOfItems": products.length,
                "itemListOrder": "https://schema.org/ItemListOrderDescending",
                "itemListElement": products.map((p: any, idx: number) => ({
                  "@type": "ListItem",
                  "position": idx + 1,
                  "url": `https://reviewhunts.com/product/${p.slug}`,
                  "item": {
                    "@type": ["Product", "SoftwareApplication"],
                    "name": p.name,
                    "url": `https://reviewhunts.com/product/${p.slug}`,
                    "applicationCategory": (p.categories as any)?.name || category?.name || "BusinessApplication",
                    "operatingSystem": "Web",
                    ...(p.logo_url && { "image": p.logo_url }),
                    ...(p.tagline && { "description": p.tagline }),
                    ...(p.avg_rating && p.total_reviews > 0 && {
                      "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": Number(p.avg_rating).toFixed(1),
                        "bestRating": "5",
                        "worstRating": "1",
                        "ratingCount": p.total_reviews,
                        "reviewCount": p.total_reviews,
                      },
                    }),
                    ...(p.starting_price !== null && p.starting_price !== undefined && {
                      "offers": {
                        "@type": "Offer",
                        "price": p.starting_price || 0,
                        "priceCurrency": "USD",
                        "availability": "https://schema.org/InStock",
                        "priceValidUntil": new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split("T")[0],
                        "url": `https://reviewhunts.com/product/${p.slug}`,
                      },
                    }),
                  },
                })),
              },
            }),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://reviewhunts.com" },
              { "@type": "ListItem", "position": 2, "name": "Categories", "item": `https://reviewhunts.com/categories` },
              { "@type": "ListItem", "position": 3, "name": category?.name || t("categories.title") }
            ]
          }
        ]}
      />
      <div className="container py-5 sm:py-10 pb-20 lg:pb-10">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <Link to="/" className="hover:text-foreground transition-colors">{t("nav.home")}</Link>
          <span className="opacity-30">/</span>
          <span className="text-foreground font-medium truncate">{category?.name || t("categories.title")}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-60 flex-shrink-0">
            <div className="glass-card p-5 lg:sticky lg:top-24">
              <div role="heading" aria-level={2} className="font-display font-bold text-foreground mb-4 text-sm uppercase tracking-wider">{t("categories.title")}</div>
              <div className="space-y-0.5">
                <Link to="/category/all" className={cn(
                  "block px-3 py-2.5 text-sm rounded-xl transition-all duration-200 font-medium",
                  isAll ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}>
                  {t("categoryPage.allCategories")}
                </Link>
                {categories?.map((c) => (
                  <Link key={c.id} to={`/category/${c.slug}`} className={cn(
                    "flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-all duration-200",
                    slug === c.slug ? "text-primary bg-primary/8 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}>
                    <span>{c.name}</span>
                    <span className="text-xs opacity-50">{c.product_count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {/* Title block */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 sm:mb-6"
            >
              <h1 className="text-[1.4rem] sm:text-2xl md:text-3xl font-display font-bold text-foreground leading-tight">
                {isAll ? t("categoryPage.allSoftware") : `${t("categoryPage.best")} ${category?.name} ${category?.name?.endsWith("Software") ? "" : t("categoryPage.software")}`}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("categoryPage.productsFound", { count: totalCount ?? 0 })}</p>
            </motion.div>

            {/* Mobile filter bar — Variant B (new) */}
            {useNewMobileFilters && (
              <div className="lg:hidden sticky top-[56px] z-20 -mx-4 px-4 py-2.5 mb-4 bg-background/85 backdrop-blur-xl border-b border-border" data-ab-variant="B">
                <div className="flex items-center gap-2">
                  <Sheet onOpenChange={(o) => o && handleFilterDrawerOpen("categories")}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9 px-3 text-xs font-medium flex-shrink-0">
                        <LayoutGrid className="h-3.5 w-3.5" /> Categories
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[85%] sm:w-80 p-0">
                      <SheetHeader className="p-4 border-b border-border">
                        <SheetTitle>{t("categories.title")}</SheetTitle>
                      </SheetHeader>
                      <div className="p-3 overflow-y-auto max-h-[calc(100vh-4rem)] space-y-0.5">
                        <Link to="/category/all" className={cn(
                          "block px-3 py-2.5 text-sm rounded-xl transition-all font-medium",
                          isAll ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        )}>
                          {t("categoryPage.allCategories")}
                        </Link>
                        {categories?.map((c) => (
                          <Link key={c.id} to={`/category/${c.slug}`} className={cn(
                            "flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-all",
                            slug === c.slug ? "text-primary bg-primary/8 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          )}>
                            <span className="truncate">{c.name}</span>
                            <span className="text-xs opacity-50 ml-2">{c.product_count}</span>
                          </Link>
                        ))}
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* Horizontal sort chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 -mr-4 pr-4">
                    {[
                      { value: "rating", label: t("categoryPage.topRated") },
                      { value: "reviews", label: t("categoryPage.mostReviews") },
                      { value: "newest", label: t("categoryPage.newest") },
                      { value: "name", label: t("categoryPage.az") },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleSortChange(opt.value)}
                        className={cn(
                          "h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors border",
                          sort === opt.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <Sheet onOpenChange={(o) => o && handleFilterDrawerOpen("tier")}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" aria-label="Open tier filters" className="rounded-xl h-9 w-9 p-0 flex-shrink-0 relative">
                        <ListFilter className="h-4 w-4" />
                        {tierFilter !== "all" && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-2xl">
                      <SheetHeader>
                        <SheetTitle>Filter</SheetTitle>
                      </SheetHeader>
                      <div className="py-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sponsor tier</p>
                        {[
                          { value: "all", label: "All Products" },
                          { value: "gold", label: "🥇 Gold Sponsors" },
                          { value: "silver", label: "🥈 Silver Sponsors" },
                          { value: "bronze", label: "🥉 Bronze Sponsors" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleTierFilterChange(opt.value)}
                            className={cn(
                              "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                              tierFilter === opt.value ? "bg-primary/10 text-primary" : "bg-muted/50 text-foreground hover:bg-muted"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            )}

            {/* (Mobile filter bar handled above via the drawer; no legacy variant on mobile.) */}


            {/* Desktop filter row */}
            <div className="hidden lg:flex items-center justify-end gap-2 mb-6">
              <Select value={tierFilter} onValueChange={handleTierFilterChange}>
                <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="Sponsor Tier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="gold">🥇 Gold Sponsors</SelectItem>
                  <SelectItem value="silver">🥈 Silver Sponsors</SelectItem>
                  <SelectItem value="bronze">🥉 Bronze Sponsors</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">{t("categoryPage.topRated")}</SelectItem>
                  <SelectItem value="reviews">{t("categoryPage.mostReviews")}</SelectItem>
                  <SelectItem value="newest">{t("categoryPage.newest")}</SelectItem>
                  <SelectItem value="name">{t("categoryPage.az")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* G2-style Category Grid — desktop only (position chart doesn't suit mobile) */}
            {allGridProducts && allGridProducts.length >= 3 && (
              <div className="hidden md:block">
                <CategoryGrid products={allGridProducts} categoryName={category?.name || undefined} />
              </div>
            )}

            <div className={cn("space-y-3 sm:space-y-4 transition-opacity", isFetching && !isLoading && "opacity-60")}>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={i} />) :
                products?.map((p: any, idx: number) => (
                  <ProductCard
                    key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline}
                    logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews}
                    pricing_model={p.pricing_model} category_name={p.categories?.name}
                    is_featured={p.is_featured} is_sponsored={p.is_sponsored} sponsor_tier={p.sponsor_tier}
                    source={`category:${slug}:${filterVariant}:${idx}`}
                  />
                ))
              }
              {!isLoading && products?.length === 0 && (
                <div className="glass-card p-10 sm:p-16 text-center text-muted-foreground">{t("categoryPage.noProducts")}</div>
              )}
            </div>

            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} className="mt-8 sm:mt-10" />

            <RelatedInternalLinks
              categoryId={(category as any)?.id}
              categorySlug={slug}
              categoryName={category?.name}
              title={`Explore ${category?.name || "more"}`}
            />
          </div>
        </div>
      </div>

    </>
  );
}
