import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductLogo } from "@/components/ProductLogo";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquare, Star, ThumbsUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function RecentReviewsFeed() {
  const { data: reviews } = useQuery({
    queryKey: ["recent-reviews-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select(`
          id, title, rating, pros, cons, created_at, 
          products!reviews_product_id_fkey(id, name, slug, logo_url),
          profiles!reviews_user_id_fkey(display_name, avatar_url)
        `)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  if (!reviews || reviews.length === 0) return null;

  return (
    <section className="py-20" aria-labelledby="reviews-feed-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">Community Voice</p>
            </div>
            <h2 id="reviews-feed-heading" className="text-2xl md:text-3xl font-extrabold text-foreground">
              Latest Verified Reviews
            </h2>
            <p className="text-muted-foreground mt-1">Real feedback from real users — updated in real time</p>
          </div>
          <Link to="/search">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              All Reviews <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r: any, i: number) => {
            const product = r.products;
            const profile = r.profiles;
            const displayName = profile?.display_name || "Anonymous";
            const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/product/${product?.slug}`} className="glass-card p-5 group block h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <ProductLogo name={product?.name || ""} logoUrl={product?.logo_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {product?.name}
                      </p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <Star
                            key={si}
                            className={`h-3 w-3 ${si < r.rating ? "text-[hsl(var(--star))] fill-[hsl(var(--star))]" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {r.title && (
                    <p className="font-medium text-sm text-foreground mb-1.5 line-clamp-1">"{r.title}"</p>
                  )}

                  {r.pros && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      <ThumbsUp className="h-3 w-3 inline mr-1 text-green-500" />
                      {r.pros}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{displayName}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
