import { useState } from "react";
import { ProductLogo } from "@/components/ProductLogo";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { StarRating } from "@/components/StarRating";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fallbackCategories = [
  "Project Management",
  "Video Conferencing",
  "E-Commerce Platforms",
  "Marketing Automation",
  "Accounting",
  "CRM",
  "Expense Management",
  "ERP Systems",
  "Online Backup",
  "AI Chatbots",
];

export function MostPopularCategoriesSection() {
  const [activeCategory, setActiveCategory] = useState(0);

  const { data: categories } = useQuery({
    queryKey: ["categories-popular-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("product_count", { ascending: false })
        .limit(10);
      return data && data.length > 0 ? data : null;
    },
  });

  const categoryList = categories || fallbackCategories.map((name, i) => ({
    id: String(i),
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
  }));

  const activeCat = categoryList[activeCategory];

  const { data: products } = useQuery({
    queryKey: ["products-by-category", activeCat?.id || activeCat?.slug],
    queryFn: async () => {
      if (categories && activeCat) {
        const { data } = await supabase
          .from("products")
          .select("id, slug, name, logo_url, avg_rating, total_reviews, screenshots")
          .eq("category_id", (activeCat as any).id)
          .eq("is_active", true)
          .order("info_score", { ascending: false })
          .order("avg_rating", { ascending: false })
          .limit(9);
        return data || [];
      }
      return [];
    },
    enabled: !!categories,
  });

  return (
    <section className="py-20 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight">
            Most Popular Software
            <br />
            Categories
          </h2>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left sidebar - category list */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="space-y-0.5">
              {categoryList.map((cat: any, i: number) => (
                <button
                  key={cat.id || i}
                  onClick={() => setActiveCategory(i)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeCategory === i
                      ? "bg-primary/8 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right side - product grid */}
          <div className="flex-1">
            <div className="flex items-center justify-end mb-4">
              <Link
                to={`/category/${(activeCat as any)?.slug || "accounting"}`}
                className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
              >
                See all {(activeCat as any)?.name} Software
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products && products.length > 0 ? (
                products.map((p: any, i: number) => {
                  const screenshots = Array.isArray(p.screenshots) ? p.screenshots : [];
                  const firstScreenshot = screenshots.find((s: any) => typeof s === "string" ? s : s?.url);
                  const screenshotUrl = typeof firstScreenshot === "string" ? firstScreenshot : firstScreenshot?.url;

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link
                        to={`/product/${p.slug}`}
                        className="glass-card overflow-hidden group block ring-1 ring-border/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 hover:ring-primary/30"
                      >
                        {/* Screenshot area */}
                        <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                          {screenshotUrl ? (
                            <img
                              src={screenshotUrl}
                              alt={`${p.name} screenshot`}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <ProductLogo name={p.name} logoUrl={p.logo_url} size="lg" />
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="p-4 flex items-center gap-3">
                          <ProductLogo name={p.name} logoUrl={p.logo_url} size="xs" />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                              {p.name}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <StarRating rating={Number(p.avg_rating) || 0} size="sm" />
                              <span className="text-xs text-muted-foreground">
                                ({p.total_reviews?.toLocaleString() || 0})
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })
              ) : (
                // Placeholder cards when no products
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass-card p-5 text-center">
                    <div className="h-4 w-24 bg-muted rounded mx-auto mb-2" />
                    <div className="h-3 w-20 bg-muted rounded mx-auto mb-4" />
                    <div className="h-16 w-16 mx-auto rounded-lg bg-muted" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
