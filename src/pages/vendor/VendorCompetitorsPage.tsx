import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Package, Star, Eye, MessageSquare, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function VendorCompetitorsPage() {
  const { user } = useAuth();

  const { data: claims = [] } = useQuery({
    queryKey: ["vendor-claims-competitors", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("product_id, products(id, name, slug, logo_url, avg_rating, total_reviews, view_count, click_count, category_id)")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      return data || [];
    },
  });

  const claimedProducts = claims.map((c: any) => c.products).filter(Boolean);
  const categoryIds = [...new Set(claimedProducts.map((p: any) => p.category_id).filter(Boolean))];

  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ["vendor-competitors", categoryIds],
    enabled: categoryIds.length > 0,
    queryFn: async () => {
      const claimedIds = claimedProducts.map((p: any) => p.id);
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, avg_rating, total_reviews, view_count, click_count, category_id, categories!products_category_id_fkey(name)")
        .in("category_id", categoryIds)
        .eq("is_active", true)
        .not("id", "in", `(${claimedIds.join(",")})`)
        .order("avg_rating", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const getTrend = (yours: number, theirs: number) => {
    if (yours > theirs) return { icon: TrendingUp, color: "text-green-500", label: "Ahead" };
    if (yours < theirs) return { icon: TrendingDown, color: "text-destructive", label: "Behind" };
    return { icon: Minus, color: "text-muted-foreground", label: "Even" };
  };

  // Chart data: your products vs top competitors by rating
  const chartData = [
    ...claimedProducts.map((p: any) => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + "…" : p.name,
      rating: Number(p.avg_rating) || 0,
      type: "yours",
    })),
    ...competitors.slice(0, 5).map((p: any) => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + "…" : p.name,
      rating: Number(p.avg_rating) || 0,
      type: "competitor",
    })),
  ].sort((a, b) => b.rating - a.rating);

  if (claimedProducts.length === 0) {
    return (
      <>
        <SeoHead title="Competitor Insights — Vendor" robots="noindex, nofollow" />
        <div className="glass-card p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No claimed products</h2>
          <p className="text-sm text-muted-foreground mb-4">Claim a product to see competitor insights.</p>
          <Link to="/vendor/claim"><Button>Claim a Product</Button></Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Competitor Insights — Vendor" description="See how your products compare to competitors." robots="noindex, nofollow" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Competitor Insights</h1>
          <p className="text-muted-foreground mt-1">Compare your products against competitors in the same categories</p>
        </div>

        {/* Rating Comparison Chart */}
        {chartData.length > 0 && (
          <div className="glass-card p-6 mb-8">
            <h2 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Rating Comparison
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" domain={[0, 5]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)} ★`, "Rating"]}
                  />
                  <Bar dataKey="rating" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.type === "yours" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" /> Your products</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-muted-foreground/40" /> Competitors</span>
            </div>
          </div>
        )}

        {/* Your Products */}
        <h2 className="text-lg font-display font-bold text-foreground mb-4">Your Products</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {claimedProducts.map((p: any) => (
            <div key={p.id} className="glass-card p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.logo_url ? <img decoding="async" loading="lazy" src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3" />{Number(p.avg_rating).toFixed(1)}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{p.total_reviews || 0}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(p.view_count || 0).toLocaleString()}</span>
                </div>
              </div>
              <Badge variant="default" className="text-[10px]">Yours</Badge>
            </div>
          ))}
        </div>

        {/* Competitors */}
        <h2 className="text-lg font-display font-bold text-foreground mb-4">
          Competitors ({competitors.length})
        </h2>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : competitors.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">No competitors found in your categories.</div>
        ) : (
          <div className="space-y-2">
            {competitors.map((comp: any) => {
              const yourBest = claimedProducts.reduce(
                (best: any, p: any) => (p.category_id === comp.category_id ? p : best),
                claimedProducts[0]
              );
              const ratingTrend = getTrend(Number(yourBest?.avg_rating || 0), Number(comp.avg_rating));
              const reviewsTrend = getTrend(yourBest?.total_reviews || 0, comp.total_reviews || 0);
              const viewsTrend = getTrend(yourBest?.view_count || 0, comp.view_count || 0);

              return (
                <div key={comp.id} className="glass-card p-5 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {comp.logo_url ? <img decoding="async" loading="lazy" src={comp.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-primary">{comp.name.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/product/${comp.slug}`} className="text-sm font-semibold text-foreground hover:text-primary truncate">{comp.name}</Link>
                      <Badge variant="outline" className="text-[10px]">{comp.categories?.name || "—"}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1.5">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />{Number(comp.avg_rating).toFixed(1)}
                        <ratingTrend.icon className={`h-3 w-3 ${ratingTrend.color}`} />
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />{comp.total_reviews || 0}
                        <reviewsTrend.icon className={`h-3 w-3 ${reviewsTrend.color}`} />
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />{(comp.view_count || 0).toLocaleString()}
                        <viewsTrend.icon className={`h-3 w-3 ${viewsTrend.color}`} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </>
  );
}
