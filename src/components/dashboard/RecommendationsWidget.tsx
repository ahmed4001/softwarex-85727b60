import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductLogo } from "@/components/ProductLogo";
import { motion } from "framer-motion";

interface Props {
  userId: string;
  savedProductIds: string[];
}

export function RecommendationsWidget({ userId, savedProductIds }: Props) {
  // Get user's reviewed/saved category IDs, then recommend from those categories
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ["dashboard-recommendations", userId, savedProductIds],
    queryFn: async () => {
      // Find categories from user's reviewed products
      const { data: reviewedProducts } = await supabase
        .from("reviews")
        .select("product_id")
        .eq("user_id", userId)
        .limit(20);

      const interactedIds = new Set([
        ...savedProductIds,
        ...(reviewedProducts?.map((r) => r.product_id) || []),
      ]);

      // Get category IDs from interacted products
      let categoryIds: string[] = [];
      if (interactedIds.size > 0) {
        const { data: cats } = await supabase
          .from("products")
          .select("category_id")
          .in("id", [...interactedIds])
          .not("category_id", "is", null);
        categoryIds = [...new Set((cats || []).map((c) => c.category_id!))];
      }

      // Fetch top-rated products from same categories, excluding already interacted
      let query = supabase
        .from("products")
        .select("id, name, slug, logo_url, avg_rating, total_reviews, tagline, categories!products_category_id_fkey(name)")
        .eq("is_active", true)
        .gt("total_reviews", 0)
        .order("avg_rating", { ascending: false })
        .limit(6);

      if (categoryIds.length > 0) {
        query = query.in("category_id", categoryIds);
      }

      const { data: products } = await query;

      // Filter out already saved/reviewed
      return (products || []).filter((p) => !interactedIds.has(p.id)).slice(0, 4);
    },
  });

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-3">
          <div className="h-5 w-40 bg-muted/50 rounded animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-5 text-center">
          <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
          <h4 className="text-sm font-bold text-foreground mb-1">Recommendations</h4>
          <p className="text-xs text-muted-foreground mb-3">Save and review products to get personalized recommendations.</p>
          <Link to="/search">
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5">
              Browse Products <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Recommended For You</h3>
        </div>
        <div className="space-y-2.5">
          {recommendations.map((p: any, i: number) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/product/${p.slug}`}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
              >
                <ProductLogo name={p.name} logoUrl={p.logo_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-[hsl(var(--star))] fill-[hsl(var(--star))]" />
                    <span className="text-xs text-muted-foreground">
                      {Number(p.avg_rating).toFixed(1)} · {p.total_reviews} reviews
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
