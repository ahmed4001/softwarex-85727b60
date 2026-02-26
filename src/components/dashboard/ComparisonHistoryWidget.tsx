import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitCompareArrows, ArrowRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductLogo } from "@/components/ProductLogo";
import { motion } from "framer-motion";
import { useMemo } from "react";

interface Props {
  userId: string;
  savedProductIds: string[];
}

export function ComparisonHistoryWidget({ userId, savedProductIds }: Props) {
  // Find comparisons relevant to user's saved/reviewed products
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-comparisons", userId, savedProductIds],
    queryFn: async () => {
      // Get user's interacted product IDs
      const { data: reviewedProducts } = await supabase
        .from("reviews")
        .select("product_id")
        .eq("user_id", userId)
        .limit(20);

      const interactedIds = [
        ...savedProductIds,
        ...(reviewedProducts?.map((r) => r.product_id) || []),
      ];

      // Get popular comparisons (if user has interacted products, prefer those)
      const { data: comparisons } = await supabase
        .from("comparisons")
        .select("id, slug, title, product_ids, product_a_score, product_b_score, winner_product_id")
        .eq("is_published", true)
        .order("view_count", { ascending: false })
        .limit(50);

      if (!comparisons?.length) return { comparisons: [], productMap: {} };

      // Prioritize comparisons involving user's products
      const sorted = comparisons.sort((a, b) => {
        const aIds = Array.isArray(a.product_ids) ? a.product_ids as string[] : [];
        const bIds = Array.isArray(b.product_ids) ? b.product_ids as string[] : [];
        const aMatch = aIds.some((id) => interactedIds.includes(id)) ? 1 : 0;
        const bMatch = bIds.some((id) => interactedIds.includes(id)) ? 1 : 0;
        return bMatch - aMatch;
      });

      const top = sorted.slice(0, 5);

      // Fetch product details for logos
      const allProductIds = new Set<string>();
      top.forEach((c) => {
        const ids = Array.isArray(c.product_ids) ? c.product_ids as string[] : [];
        ids.forEach((id) => allProductIds.add(id));
      });

      const productMap: Record<string, { name: string; logo_url: string | null }> = {};
      if (allProductIds.size > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name, logo_url")
          .in("id", [...allProductIds]);
        products?.forEach((p) => {
          productMap[p.id] = { name: p.name, logo_url: p.logo_url };
        });
      }

      return { comparisons: top, productMap };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const { comparisons = [], productMap = {} } = data || {};

  if (comparisons.length === 0) {
    return (
      <div className="text-center py-12">
        <GitCompareArrows className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-foreground mb-1">No comparisons yet</h3>
        <p className="text-xs text-muted-foreground mb-4">Explore head-to-head software comparisons.</p>
        <Link to="/compare">
          <Button size="sm" className="rounded-xl gap-1.5">
            Browse Comparisons <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {comparisons.map((comp: any, i: number) => {
        const ids = Array.isArray(comp.product_ids) ? comp.product_ids as string[] : [];
        const productA = productMap[ids[0]];
        const productB = productMap[ids[1]];

        return (
          <motion.div
            key={comp.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/compare/${comp.slug}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border hover:bg-muted/30 transition-all group"
            >
              <div className="flex -space-x-2">
                {productA && (
                  <ProductLogo name={productA.name} logoUrl={productA.logo_url} size="xs" className="ring-2 ring-background" />
                )}
                {productB && (
                  <ProductLogo name={productB.name} logoUrl={productB.logo_url} size="xs" className="ring-2 ring-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {productA?.name || "?"} vs {productB?.name || "?"}
                </p>
                {comp.product_a_score && comp.product_b_score && (
                  <p className="text-xs text-muted-foreground">
                    {Number(comp.product_a_score).toFixed(1)} vs {Number(comp.product_b_score).toFixed(1)}
                  </p>
                )}
              </div>
              {comp.winner_product_id && (
                <Trophy className="h-3.5 w-3.5 text-[hsl(var(--star))]" />
              )}
            </Link>
          </motion.div>
        );
      })}
      <Link to="/compare" className="block">
        <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground hover:text-primary">
          View All Comparisons <ArrowRight className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}
