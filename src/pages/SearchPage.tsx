import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [page, setPage] = useState(0);
  const { t } = useTranslation();

  // Reset page when query changes
  useEffect(() => { setPage(0); }, [q]);

  const { data: totalCount } = useQuery({
    queryKey: ["search-count", q],
    queryFn: async () => {
      if (!q.trim()) return 0;
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .ilike("name", `%${q}%`);
      return count ?? 0;
    },
    enabled: q.length > 0,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["search", q, page],
    queryFn: async () => {
      if (!q.trim()) return [];
      const { data } = await supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name)")
        .eq("is_active", true)
        .ilike("name", `%${q}%`)
        .order("avg_rating", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      return data || [];
    },
    enabled: q.length > 0,
  });

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  return (
    <>
      <SeoHead title={q ? `${t("common.search")}: ${q}` : t("common.search")} />
      <div className="container py-8">
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setParams({ q: e.target.value })}
              placeholder={t("searchPage.searchSoftware")}
              className="h-14 pl-12 text-lg rounded-2xl"
            />
          </div>
        </div>

        {q && <p className="text-muted-foreground mb-6">{t("searchPage.resultsFor", { count: totalCount ?? 0, query: q })}</p>}

        <div className="grid md:grid-cols-2 gap-4">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />) :
            products?.map((p: any) => (
              <ProductCard
                key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline}
                logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews}
                pricing_model={p.pricing_model} category_name={p.categories?.name}
              />
            ))
          }
        </div>

        {!isLoading && q && products?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">{t("searchPage.noResults")}</p>
            <p>{t("searchPage.tryDifferent")} <Link to="/category/all" className="text-primary hover:underline">{t("searchPage.browseCategories")}</Link></p>
          </div>
        )}

        {/* Pagination */}
        {q && totalPages > 1 && (
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
    </>
  );
}
