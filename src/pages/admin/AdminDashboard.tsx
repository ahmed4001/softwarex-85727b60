import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Package, Star, Users, MessageSquare, Eye, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CHART_COLORS = ["hsl(245, 82%, 63%)", "hsl(187, 92%, 42%)", "hsl(152, 69%, 45%)", "hsl(38, 92%, 50%)"];

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, reviews, users, pending] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return { products: products.count || 0, reviews: reviews.count || 0, users: users.count || 0, pending: pending.count || 0 };
    },
  });

  const { data: enrichmentStats } = useQuery({
    queryKey: ["admin-enrichment-stats"],
    queryFn: async () => {
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, website_url, features, category_id, categories(name, slug)")
        .eq("is_active", true);

      const products = allProducts || [];
      const needsEnrichment = products.filter(
        (p: any) => !p.website_url || !p.features || (Array.isArray(p.features) && p.features.length === 0)
      );

      // Group by category
      const byCategory: Record<string, { name: string; total: number; needsEnrich: number }> = {};
      for (const p of products) {
        const catName = (p as any).categories?.name || "Uncategorized";
        const catSlug = (p as any).categories?.slug || "uncategorized";
        if (!byCategory[catSlug]) byCategory[catSlug] = { name: catName, total: 0, needsEnrich: 0 };
        byCategory[catSlug].total++;
      }
      for (const p of needsEnrichment) {
        const catSlug = (p as any).categories?.slug || "uncategorized";
        if (byCategory[catSlug]) byCategory[catSlug].needsEnrich++;
      }

      const topCategories = Object.entries(byCategory)
        .filter(([, v]) => v.needsEnrich > 0)
        .sort((a, b) => b[1].needsEnrich - a[1].needsEnrich)
        .slice(0, 8);

      return {
        total: products.length,
        needsEnrichment: needsEnrichment.length,
        enriched: products.length - needsEnrichment.length,
        topCategories,
      };
    },
  });

  const { data: recentReviews } = useQuery({
    queryKey: ["admin-recent-reviews"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("*, products(name), profiles(name)").order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["admin-top-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("name, total_reviews, avg_rating, view_count").order("view_count", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const reviewsOverTime = Array.from({ length: 30 }, (_, i) => ({ day: `${i + 1}`, reviews: Math.floor(Math.random() * 20) + 5 }));
  const statusBreakdown = [
    { name: "Approved", value: 65 }, { name: "Pending", value: 20 },
    { name: "Rejected", value: 10 }, { name: "Spam", value: 5 },
  ];

  return (
    <>
      <SeoHead title="Admin Dashboard" />
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview and recent activity</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <StatCard title="Total Products" value={stats?.products || 0} icon={Package} color="primary" trend={12} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <StatCard title="Total Reviews" value={stats?.reviews || 0} icon={Star} color="secondary" trend={8} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <StatCard title="Total Users" value={stats?.users || 0} icon={Users} color="success" trend={15} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <StatCard title="Pending Reviews" value={stats?.pending || 0} icon={MessageSquare} color="warning" trend={-5} />
          </motion.div>
        </div>

        <div className="grid xl:grid-cols-3 gap-5">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-2 glass-card p-6">
            <h3 className="font-display font-bold text-foreground mb-5">Reviews — Last 30 Days</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={reviewsOverTime}>
                <defs>
                  <linearGradient id="reviewGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(245, 82%, 63%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(245, 82%, 63%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 90%)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(225, 10%, 48%)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(225, 10%, 48%)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(225, 15%, 90%)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="reviews" stroke="hsl(245, 82%, 63%)" fill="url(#reviewGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-6">
            <h3 className="font-display font-bold text-foreground mb-5">Review Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {statusBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 justify-center mt-3">
              {statusBreakdown.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                  {s.name} ({s.value}%)
                </div>
              ))}
            </div>
        </motion.div>

        {/* Enrichment Widget */}
        {enrichmentStats && enrichmentStats.needsEnrichment > 0 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }} className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="font-display font-bold text-foreground">Product Enrichment Status</h3>
              </div>
              <Link to="/admin/seed">
                <Button variant="outline" size="sm" className="rounded-lg font-medium">
                  <Sparkles className="mr-1 h-3 w-3" /> Enrich Now
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{enrichmentStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Products</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-green-500/10">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{enrichmentStats.enriched}</div>
                <div className="text-xs text-muted-foreground">Enriched</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-500/10">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{enrichmentStats.needsEnrichment}</div>
                <div className="text-xs text-muted-foreground">Need Enrichment</div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Enrichment progress</span>
                <span>{Math.round((enrichmentStats.enriched / enrichmentStats.total) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                  style={{ width: `${(enrichmentStats.enriched / enrichmentStats.total) * 100}%` }}
                />
              </div>
            </div>
            {/* Top categories needing enrichment */}
            {enrichmentStats.topCategories.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground mb-2">Top categories needing enrichment</div>
                {enrichmentStats.topCategories.map(([slug, cat]) => (
                  <div key={slug} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 text-sm">
                    <span className="font-medium text-foreground">{cat.name}</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">{cat.needsEnrich} / {cat.total}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        </div>

        <div className="grid xl:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-foreground">Recent Reviews</h3>
              <Link to="/admin/reviews"><Button variant="ghost" size="sm" className="rounded-lg font-medium">View All</Button></Link>
            </div>
            <div className="space-y-1">
              {recentReviews?.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{r.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">on {r.products?.name || "—"} · by {r.profiles?.name || "Anonymous"}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
              {(!recentReviews || recentReviews.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">No reviews yet.</p>}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-foreground">Top Products</h3>
              <Link to="/admin/products"><Button variant="ghost" size="sm" className="rounded-lg font-medium">View All</Button></Link>
            </div>
            <div className="space-y-1">
              {topProducts?.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.total_reviews} reviews · ★ {Number(p.avg_rating).toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Eye className="h-3.5 w-3.5" /> {p.view_count}
                  </div>
                </div>
              ))}
              {(!topProducts || topProducts.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">No products yet.</p>}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
