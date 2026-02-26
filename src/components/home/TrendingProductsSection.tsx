import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductLogo } from "@/components/ProductLogo";
import { ArrowRight, TrendingUp, Star, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export function TrendingProductsSection() {
  const { data: trending } = useQuery({
    queryKey: ["trending-products"],
    queryFn: async () => {
      // Products with most reviews in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentReviews } = await supabase
        .from("reviews")
        .select("product_id")
        .eq("status", "approved")
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (!recentReviews || recentReviews.length === 0) {
        // Fallback: most viewed products
        const { data } = await supabase
          .from("products")
          .select("id, name, slug, logo_url, avg_rating, total_reviews, tagline, view_count, categories!products_category_id_fkey(name)")
          .eq("is_active", true)
          .order("view_count", { ascending: false })
          .limit(6);
        return (data || []).map((p: any) => ({ ...p, recentReviewCount: 0 }));
      }

      // Count reviews per product
      const countMap: Record<string, number> = {};
      recentReviews.forEach((r) => {
        countMap[r.product_id] = (countMap[r.product_id] || 0) + 1;
      });

      const topIds = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => id);

      if (topIds.length === 0) return [];

      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, avg_rating, total_reviews, tagline, categories!products_category_id_fkey(name)")
        .in("id", topIds)
        .eq("is_active", true);

      return (products || []).map((p: any) => ({
        ...p,
        recentReviewCount: countMap[p.id] || 0,
      })).sort((a: any, b: any) => b.recentReviewCount - a.recentReviewCount);
    },
  });

  if (!trending || trending.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/20" aria-labelledby="trending-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-destructive" />
              <p className="text-sm font-semibold text-destructive">Trending Now</p>
            </div>
            <h2 id="trending-heading" className="text-2xl md:text-3xl font-extrabold text-foreground">
              Most Reviewed This Month
            </h2>
            <p className="text-muted-foreground mt-1">Software getting the most attention from the community right now</p>
          </div>
          <Link to="/search">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              View All <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trending.map((p: any, i: number) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/product/${p.slug}`}>
                <Card className="border-border/50 hover:border-primary/30 transition-all hover:shadow-md group">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="relative">
                      <ProductLogo name={p.name} logoUrl={p.logo_url} size="md" />
                      <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive flex items-center justify-center">
                        <TrendingUp className="h-3 w-3 text-destructive-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {p.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{p.tagline || (p.categories as any)?.name}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs font-medium">
                          <Star className="h-3 w-3 text-[hsl(var(--star))] fill-[hsl(var(--star))]" />
                          {Number(p.avg_rating).toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">{p.total_reviews} reviews</span>
                        {p.recentReviewCount > 0 && (
                          <span className="text-xs font-medium text-destructive flex items-center gap-0.5">
                            <Flame className="h-3 w-3" /> +{p.recentReviewCount} this month
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
