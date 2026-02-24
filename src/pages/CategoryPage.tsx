import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

export default function CategoryPage() {
  const { slug } = useParams();
  const [sort, setSort] = useState("rating");
  const [page, setPage] = useState(0);
  const isAll = slug === "all";
  const { t } = useTranslation();

  const { data: category } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      if (isAll) return { name: t("categoryPage.allCategories"), description: t("categories.subtitle"), slug: "all" };
      const { data } = await supabase.from("categories").select("*").eq("slug", slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("is_active", true).order("name");
      return data || [];
    },
  });

  // Total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ["products-category-count", slug],
    queryFn: async () => {
      let query = supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (!isAll && category && "id" in category) query = query.eq("category_id", (category as any).id);
      const { count } = await query;
      return count ?? 0;
    },
    enabled: !!category,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products-category", slug, sort, page],
    queryFn: async () => {
      let query = supabase.from("products").select("*, categories!products_category_id_fkey(name)").eq("is_active", true);
      if (!isAll && category && "id" in category) query = query.eq("category_id", (category as any).id);
      if (sort === "rating") query = query.order("avg_rating", { ascending: false });
      else if (sort === "reviews") query = query.order("total_reviews", { ascending: false });
      else if (sort === "newest") query = query.order("created_at", { ascending: false });
      else query = query.order("name");
      const { data } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      return data || [];
    },
    enabled: !!category,
  });

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  // Reset page when sort or slug changes
  const handleSortChange = (value: string) => {
    setSort(value);
    setPage(0);
  };

  return (
    <>
      <SeoHead title={category?.name || t("categories.title")} description={category?.description || t("categories.subtitle")} />
      <div className="container py-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-foreground transition-colors">{t("nav.home")}</Link>
          <span className="opacity-30">/</span>
          <span className="text-foreground font-medium">{category?.name || t("categories.title")}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <aside className="w-full lg:w-60 flex-shrink-0">
            <div className="glass-card p-5 lg:sticky lg:top-24">
              <h3 className="font-display font-bold text-foreground mb-4 text-sm uppercase tracking-wider">{t("categories.title")}</h3>
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
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4"
            >
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                  {isAll ? t("categoryPage.allSoftware") : `${t("categoryPage.best")} ${category?.name} ${category?.name?.endsWith("Software") ? "" : t("categoryPage.software")}`}
                </h1>
                <p className="text-muted-foreground mt-1">{t("categoryPage.productsFound", { count: totalCount ?? 0 })}</p>
              </div>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">{t("categoryPage.topRated")}</SelectItem>
                  <SelectItem value="reviews">{t("categoryPage.mostReviews")}</SelectItem>
                  <SelectItem value="newest">{t("categoryPage.newest")}</SelectItem>
                  <SelectItem value="name">{t("categoryPage.az")}</SelectItem>
                </SelectContent>
              </Select>
            </motion.div>

            <div className="space-y-4">
              {isLoading ? Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={i} />) :
                products?.map((p: any) => (
                  <ProductCard
                    key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline}
                    logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews}
                    pricing_model={p.pricing_model} category_name={p.categories?.name}
                    is_featured={p.is_featured} is_sponsored={p.is_sponsored}
                  />
                ))
              }
              {!isLoading && products?.length === 0 && (
                <div className="glass-card p-16 text-center text-muted-foreground">{t("categoryPage.noProducts")}</div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  // Show max 7 page buttons with ellipsis
                  if (totalPages <= 7 || i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) {
                    return (
                      <Button
                        key={i}
                        variant={i === page ? "default" : "outline"}
                        size="icon"
                        className="rounded-xl h-9 w-9 text-sm"
                        onClick={() => setPage(i)}
                      >
                        {i + 1}
                      </Button>
                    );
                  }
                  if (i === 1 && page > 3) return <span key={i} className="text-muted-foreground px-1">…</span>;
                  if (i === totalPages - 2 && page < totalPages - 4) return <span key={i} className="text-muted-foreground px-1">…</span>;
                  return null;
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
