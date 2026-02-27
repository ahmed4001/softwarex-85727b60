import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductLogo } from "@/components/ProductLogo";
import { motion } from "framer-motion";
import { ArrowRight, Crown, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CategoryLeadersSection() {
  const { data: leaders } = useQuery({
    queryKey: ["category-leaders"],
    queryFn: async () => {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name, slug, icon")
        .eq("is_active", true)
        .order("product_count", { ascending: false })
        .limit(6);

      if (!categories || categories.length === 0) return [];

      const results = await Promise.all(
        categories.map(async (cat) => {
          const { data: products } = await supabase
            .from("products")
            .select("id, name, slug, logo_url, avg_rating, total_reviews, tagline")
            .eq("is_active", true)
            .eq("category_id", cat.id)
            .order("info_score", { ascending: false })
            .order("avg_rating", { ascending: false })
            .limit(3);
          return { category: cat, products: products || [] };
        })
      );

      return results.filter((r) => r.products.length > 0);
    },
  });

  if (!leaders || leaders.length === 0) return null;

  return (
    <section className="py-20" aria-labelledby="leaders-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">Category Leaders</p>
            </div>
            <h2 id="leaders-heading" className="text-2xl md:text-3xl font-extrabold text-foreground">
              #1 Software in Every Category
            </h2>
            <p className="text-muted-foreground mt-1">Top-rated tools leading their respective categories</p>
          </div>
          <Link to="/categories">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              All Categories <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {leaders.map(({ category, products }, i) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="glass-card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <Link to={`/category/${category.slug}`} className="font-bold text-foreground hover:text-primary transition-colors text-sm">
                  {category.name}
                </Link>
                <Badge variant="secondary" className="text-[10px] font-semibold">
                  Top 3
                </Badge>
              </div>
              <div className="space-y-3">
                {products.map((p: any, pi: number) => (
                  <Link key={p.id} to={`/product/${p.slug}`} className="flex items-center gap-3 group">
                    <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${pi === 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {pi === 0 ? <Crown className="h-3.5 w-3.5 text-primary mx-auto" /> : `#${pi + 1}`}
                    </span>
                    <ProductLogo name={p.name} logoUrl={p.logo_url} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {p.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Star className="h-3 w-3 text-[hsl(var(--star))] fill-[hsl(var(--star))]" />
                      {Number(p.avg_rating).toFixed(1)}
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
