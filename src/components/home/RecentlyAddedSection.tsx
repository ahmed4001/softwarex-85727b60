import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductLogo } from "@/components/ProductLogo";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Tag, Flame, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useHomepageSection } from "@/hooks/useHomepageSection";

function useCountdown(endDate: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endDate) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [endDate]);
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - now;
  if (diff <= 0) return "Expired";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}

function isExpiringSoon(endDate: string | null): boolean {
  if (!endDate) return false;
  const diff = new Date(endDate).getTime() - Date.now();
  return diff > 0 && diff <= 48 * 3600000;
}

function DealCountdown({ endDate }: { endDate: string | null }) {
  const countdown = useCountdown(endDate);
  if (!countdown) return null;
  const isExpired = countdown === "Expired";
  const soon = isExpiringSoon(endDate);
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${isExpired ? "text-destructive" : soon ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
      <Timer className="h-3.5 w-3.5" />
      <span>{isExpired ? "Expired" : `Ends in ${countdown}`}</span>
    </div>
  );
}

export function RecentlyAddedSection() {
  const cfg = useHomepageSection("recently_added");
  const { data: recentProducts } = useQuery({
    queryKey: ["products-recent", cfg.curatedIds],
    queryFn: async () => {
      if (cfg.curatedIds.length > 0) {
        const { data } = await supabase
          .from("products")
          .select("id, slug, name, tagline, logo_url, created_at, info_score, avg_rating, total_reviews, categories!products_category_id_fkey(name)")
          .in("id", cfg.curatedIds);
        const order = new Map(cfg.curatedIds.map((id, i) => [id, i]));
        return (data || []).slice().sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      }
      const { applyRealFirstOrder } = await import("@/lib/product-order");
      let query = supabase
        .from("products")
        .select("id, slug, name, tagline, logo_url, created_at, info_score, avg_rating, total_reviews, categories!products_category_id_fkey(name)")
        .eq("is_active", true);
      query = applyRealFirstOrder(query, "newest");
      const { data } = await query.limit(12);
      return data || [];
    },
  });

  const { data: featuredDeals } = useQuery({
    queryKey: ["deals-featured-recently-added"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals" as any)
        .select("id, slug, product_name, logo_url, discount_amount, discount_type, coupon_code, end_date, is_featured, is_trending, click_count")
        .eq("is_visible", true)
        .eq("review_status", "approved")
        .or("is_featured.eq.true,is_trending.eq.true")
        .order("is_featured", { ascending: false })
        .order("click_count", { ascending: false })
        .limit(4);
      return (data || []) as any[];
    },
  });

  if (!cfg.enabled) return null;
  if (!recentProducts || recentProducts.length === 0) return null;

  return (
    <section className="py-16 md:py-20">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <p className="t-eyebrow mb-1">New Arrivals</p>
            <h2 className="t-h2">Recently added</h2>
            <p className="text-muted-foreground mt-1">The latest software added to our directory</p>
          </div>
          <Link to="/categories">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              View All <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        {featuredDeals && featuredDeals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold">Hot Deals</h3>
              <Link to="/deals" className="ml-auto text-sm font-medium text-primary hover:underline flex items-center gap-1">
                All deals <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredDeals.map((deal: any, i: number) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link to={`/deals/${deal.slug}`} className="glass-card p-4 group block relative overflow-hidden">
                    <div className="absolute top-0 right-0 flex flex-col items-end gap-1">
                      {deal.discount_amount && (
                        <Badge className="rounded-none rounded-bl-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-[10px]">
                          {deal.discount_type === "amount" ? "$" : ""}{deal.discount_amount}{deal.discount_type === "percent" ? "% OFF" : deal.discount_type === "amount" ? " OFF" : ""}
                        </Badge>
                      )}
                      {isExpiringSoon(deal.end_date) && (
                        <Badge variant="destructive" className="rounded-none rounded-bl-lg text-[10px] font-bold animate-pulse">
                          Expires soon
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      {deal.logo_url ? (
                        <img src={deal.logo_url} alt={deal.product_name} className="h-10 w-10 rounded-lg object-contain bg-muted p-1" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {deal.product_name?.[0]}
                        </div>
                      )}
                      <div className="min-w-0 pr-8">
                        <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{deal.product_name}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Tag className="h-3 w-3" />
                          <span>Deal</span>
                          {deal.coupon_code && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span className="font-mono text-primary">{deal.coupon_code}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <DealCountdown endDate={deal.end_date} />
                    <Button size="sm" variant="outline" className="w-full text-xs mt-2">
                      View Deal <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {recentProducts.map((p: any, i: number) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/product/${p.slug}`} className="glass-card p-5 group block">
                <div className="flex items-start gap-3.5">
                  <ProductLogo name={p.name} logoUrl={p.logo_url} size="md" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-[15px] group-hover:text-primary transition-colors truncate">
                      {p.name}
                    </h3>
                    {p.tagline && <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{p.tagline}</p>}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Added {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                      {p.categories?.name && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <span>{p.categories.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
