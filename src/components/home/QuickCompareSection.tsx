import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductLogo } from "@/components/ProductLogo";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeftRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function QuickCompareSection() {
  const { data: comparisons } = useQuery({
    queryKey: ["homepage-comparisons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("comparisons")
        .select("id, slug, title, product_ids, product_a_score, product_b_score, view_count")
        .eq("is_published", true)
        .order("view_count", { ascending: false })
        .limit(6);

      if (!data || data.length === 0) return [];

      // Fetch products for each comparison
      const allProductIds = new Set<string>();
      data.forEach((c: any) => {
        const ids = Array.isArray(c.product_ids) ? c.product_ids : [];
        ids.forEach((id: string) => allProductIds.add(id));
      });

      if (allProductIds.size === 0) return [];

      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, avg_rating")
        .in("id", Array.from(allProductIds));

      const productMap: Record<string, any> = {};
      (products || []).forEach((p: any) => { productMap[p.id] = p; });

      return data.map((c: any) => {
        const ids = Array.isArray(c.product_ids) ? c.product_ids : [];
        return {
          ...c,
          productA: productMap[ids[0]] || null,
          productB: productMap[ids[1]] || null,
        };
      }).filter((c: any) => c.productA && c.productB);
    },
  });

  if (!comparisons || comparisons.length === 0) return null;

  return (
    <section className="py-20 bg-muted/30" aria-labelledby="compare-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">Head-to-Head</p>
            </div>
            <h2 id="compare-heading" className="text-2xl md:text-3xl font-extrabold text-foreground">
              Popular Software Matchups
            </h2>
            <p className="text-muted-foreground mt-1">Side-by-side comparisons our community reads most</p>
          </div>
          <Link to="/compare">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              All Comparisons <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparisons.map((c: any, i: number) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/compare/${c.slug}`} className="glass-card p-5 group block">
                <div className="flex items-center justify-between gap-3">
                  {/* Product A */}
                  <div className="flex-1 text-center min-w-0">
                    <ProductLogo name={c.productA.name} logoUrl={c.productA.logo_url} size="md" className="mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground truncate">{c.productA.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Star className="h-3 w-3 text-[hsl(var(--star))] fill-[hsl(var(--star))]" />
                      <span className="text-xs font-medium">{Number(c.productA.avg_rating).toFixed(1)}</span>
                    </div>
                  </div>

                  {/* VS */}
                  <div className="flex-shrink-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-extrabold text-primary">VS</span>
                    </div>
                  </div>

                  {/* Product B */}
                  <div className="flex-1 text-center min-w-0">
                    <ProductLogo name={c.productB.name} logoUrl={c.productB.logo_url} size="md" className="mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground truncate">{c.productB.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Star className="h-3 w-3 text-[hsl(var(--star))] fill-[hsl(var(--star))]" />
                      <span className="text-xs font-medium">{Number(c.productB.avg_rating).toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 text-center">
                  <span className="text-xs text-primary font-semibold group-hover:underline">
                    View Full Comparison →
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
