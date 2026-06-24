import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { StatCard } from "@/components/StatCard";
import { motion } from "framer-motion";
import { Package, Star, Eye, MessageSquare, TrendingUp, Pencil, BarChart3, Users, LayoutGrid, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { VendorResponseMetrics } from "@/components/vendor/VendorResponseMetrics";
import { VendorCompetitorBenchmark } from "@/components/vendor/VendorCompetitorBenchmark";

function SectionHeader({ icon: Icon, title, description, action }: { icon: any; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-display font-bold text-foreground leading-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function VendorDashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-8 w-56 bg-muted rounded-lg mb-2" />
        <div className="h-4 w-72 bg-muted/60 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-card border-l-4 border-l-muted p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-3 w-24 bg-muted/70 rounded mb-3" />
                <div className="h-9 w-20 bg-muted/50 rounded" />
              </div>
              <div className="h-14 w-14 rounded-2xl bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted/30" />
      <div>
        <div className="h-6 w-40 bg-muted rounded-lg mb-4" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="glass-card p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-muted/50" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-muted/60 rounded mb-2" />
                <div className="h-3 w-48 bg-muted/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VendorDashboard() {
  const { user } = useAuth();

  const { data: claims = [] } = useQuery({
    queryKey: ["vendor-claims", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("*, products(id, name, slug, logo_url, avg_rating, total_reviews, view_count, click_count)")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      return data || [];
    },
  });

  const productIds = claims.map((c: any) => c.products?.id).filter(Boolean);

  const { data: reviews = [] } = useQuery({
    queryKey: ["vendor-reviews-count", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, overall_rating, created_at, status")
        .in("product_id", productIds);
      return data || [];
    },
  });

  const { data: responses = [] } = useQuery({
    queryKey: ["vendor-responses-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_responses")
        .select("id")
        .eq("user_id", user!.id);
      return data || [];
    },
  });

  const totalViews = claims.reduce((sum: number, c: any) => sum + (c.products?.view_count || 0), 0);
  const totalClicks = claims.reduce((sum: number, c: any) => sum + (c.products?.click_count || 0), 0);
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum: number, r: any) => sum + r.overall_rating, 0) / totalReviews).toFixed(1)
    : "—";
  const approvedReviews = reviews.filter((r: any) => r.status === "approved").length;
  const unanswered = Math.max(0, approvedReviews - responses.length);

  // Build review trend chart data (last 12 months)
  const chartData = useMemo(() => {
    const months: { month: string; reviews: number; avgRating: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en", { month: "short", year: "2-digit" });
      const monthReviews = reviews.filter((r: any) => r.created_at?.startsWith(key));
      const avg = monthReviews.length > 0
        ? monthReviews.reduce((s: number, r: any) => s + r.overall_rating, 0) / monthReviews.length
        : 0;
      months.push({ month: label, reviews: monthReviews.length, avgRating: Math.round(avg * 10) / 10 });
    }
    return months;
  }, [reviews]);

  return (
    <>
      <SeoHead title="Vendor Dashboard — ReviewHunts" description="Manage your products, respond to reviews, and view analytics." robots="noindex, nofollow" />
      {!user ? (
        <VendorDashboardSkeleton />
      ) : (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-border/60">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Vendor Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Overview of your products, reviews, and performance.</p>
          </div>
          {claims.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link to="/vendor/reviews"><Button variant="outline" size="sm" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Reviews</Button></Link>
              <Link to="/vendor/analytics"><Button variant="outline" size="sm" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Analytics</Button></Link>
              <Link to="/vendor/claim"><Button size="sm" className="gap-1.5"><Package className="h-3.5 w-3.5" />Claim product</Button></Link>
            </div>
          )}
        </div>

        {claims.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No claimed products yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Claim your product listing to respond to reviews and view analytics.</p>
            <Link to="/vendor/claim"><Button>Claim a Product</Button></Link>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <section>
              <SectionHeader icon={LayoutGrid} title="At a glance" description="Headline metrics across all claimed products." />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                <StatCard title="Products" value={claims.length} icon={Package} />
                <StatCard title="Total Views" value={totalViews.toLocaleString()} icon={Eye} />
                <StatCard title="Clicks" value={totalClicks.toLocaleString()} icon={TrendingUp} />
                <StatCard title="Avg Rating" value={avgRating} icon={Star} />
                <StatCard title="Unanswered" value={unanswered} icon={MessageSquare} />
              </div>
            </section>

            {/* Performance tabs */}
            <section>
              <SectionHeader icon={BarChart3} title="Performance" description="Review trends, response health, and competitor benchmarks." />
              <Tabs defaultValue="trend" className="w-full">
                <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
                  <TabsTrigger value="trend">Review trend</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                  <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
                </TabsList>

                <TabsContent value="trend" className="mt-4">
                  {reviews.length > 0 ? (
                    <div className="glass-card p-4 md:p-6">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="vendorGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "12px",
                                fontSize: "12px",
                              }}
                            />
                            <Area type="monotone" dataKey="reviews" stroke="hsl(var(--primary))" fill="url(#vendorGrad)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card p-8 text-center text-sm text-muted-foreground">No review data yet for the last 12 months.</div>
                  )}
                </TabsContent>

                <TabsContent value="response" className="mt-4">
                  <VendorResponseMetrics userId={user!.id} productIds={productIds} />
                </TabsContent>

                <TabsContent value="benchmark" className="mt-4">
                  <VendorCompetitorBenchmark productIds={productIds} />
                </TabsContent>
              </Tabs>
            </section>

            {/* Products */}
            <section>
              <SectionHeader
                icon={Users}
                title="Your products"
                description={`${claims.length} claimed product${claims.length === 1 ? "" : "s"}`}
                action={
                  <Link to="/vendor/products" className="hidden sm:block">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">Manage all<ExternalLink className="h-3 w-3" /></Button>
                  </Link>
                }
              />
              <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
                {claims.map((c: any) => (
                  <div key={c.id} className="glass-card p-4 md:p-5 flex items-center gap-4 hover:border-primary/40 transition-colors">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {c.products?.logo_url ? (
                        <img src={c.products.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{c.products?.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Star className="h-3 w-3" />{c.products?.avg_rating || 0}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{c.products?.total_reviews || 0}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.products?.view_count || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link to={`/vendor/products/${c.products?.id}/edit`} aria-label="Edit product">
                        <Button variant="ghost" size="sm" className="gap-1"><Pencil className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Link to={`/product/${c.products?.slug}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </motion.div>
      )}
    </>
  );
}
