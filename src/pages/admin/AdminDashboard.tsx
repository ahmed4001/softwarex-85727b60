import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Package, Star, Users, MessageSquare, Eye, Sparkles, TrendingUp, ArrowUpRight, Clock, FileText, ShieldCheck, Globe } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { QuickActionsPanel } from "@/components/admin/QuickActionsPanel";
import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";
import { ContentPipelineWidget } from "@/components/admin/ContentPipelineWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format, subDays, formatDistanceToNow } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Review = Tables<"reviews">;
type Product = Tables<"products">;
type Profile = Tables<"profiles">;

interface ReviewWithRelations extends Review {
  products: Pick<Product, "name"> | null;
  profiles: Pick<Profile, "name"> | null;
}

interface TopProduct extends Pick<Product, "name" | "total_reviews" | "avg_rating" | "view_count"> {}

interface DailyReviewCount {
  day: string;
  reviews: number;
}

interface StatusBreakdownItem {
  name: string;
  value: number;
}

const CHART_COLORS = ["hsl(245, 82%, 63%)", "hsl(187, 92%, 42%)", "hsl(152, 69%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 50%)"];

export default function AdminDashboard() {
  // Core stats
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, reviews, users, pending, categories, submissions, comparisons, blogPosts] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("vendor_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("comparisons").select("id", { count: "exact", head: true }),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
      ]);
      return {
        products: products.count ?? 0,
        reviews: reviews.count ?? 0,
        users: users.count ?? 0,
        pending: pending.count ?? 0,
        categories: categories.count ?? 0,
        pendingSubmissions: submissions.count ?? 0,
        comparisons: comparisons.count ?? 0,
        blogPosts: blogPosts.count ?? 0,
      };
    },
  });

  // Growth metrics: compare users/products/reviews to 7 days ago
  const { data: growthStats } = useQuery({
    queryKey: ["admin-growth-stats"],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const [newUsers, newProducts, newReviews] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
        supabase.from("products").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
        supabase.from("reviews").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      ]);
      return {
        newUsers: newUsers.count ?? 0,
        newProducts: newProducts.count ?? 0,
        newReviews: newReviews.count ?? 0,
      };
    },
  });

  // Reviews over time
  const { data: reviewsOverTime } = useQuery<DailyReviewCount[]>({
    queryKey: ["admin-reviews-over-time"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      const { data: reviews } = await supabase.from("reviews").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()).order("created_at", { ascending: true });
      const countByDay = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - 29 + i);
        countByDay.set(d.toISOString().split("T")[0], 0);
      }
      for (const r of reviews ?? []) {
        if (r.created_at) {
          const key = r.created_at.split("T")[0];
          if (countByDay.has(key)) countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
        }
      }
      return Array.from(countByDay.entries()).map(([day, reviews]) => ({
        day: new Date(day).toLocaleDateString("en", { month: "short", day: "numeric" }),
        reviews,
      }));
    },
  });

  // Status breakdown
  const { data: statusBreakdown } = useQuery<StatusBreakdownItem[]>({
    queryKey: ["admin-review-status-breakdown"],
    queryFn: async () => {
      const statuses = ["approved", "pending", "rejected", "spam", "flagged"] as const;
      const counts = await Promise.all(statuses.map((s) => supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", s)));
      return statuses.map((s, i) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), value: counts[i].count ?? 0 })).filter((item) => item.value > 0);
    },
  });

  // Category product distribution
  const { data: categoryDistribution } = useQuery({
    queryKey: ["admin-category-distribution"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name, product_count").eq("is_active", true).order("product_count", { ascending: false }).limit(8);
      return (data || []).filter((c: any) => (c.product_count || 0) > 0).map((c: any) => ({ name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name, products: c.product_count || 0 }));
    },
  });

  // Enrichment stats
  const { data: enrichmentStats } = useQuery({
    queryKey: ["admin-enrichment-stats"],
    queryFn: async () => {
      const { data: allProducts } = await supabase.from("products").select("id, website_url, features, category_id, categories!products_category_id_fkey(name, slug)").eq("is_active", true);
      const products = allProducts ?? [];
      const needsEnrichment = products.filter((p) => !p.website_url || !p.features || (Array.isArray(p.features) && p.features.length === 0));
      const byCategory: Record<string, { name: string; total: number; needsEnrich: number }> = {};
      for (const p of products) {
        const cat = p.categories as unknown as { name: string; slug: string } | null;
        const catName = cat?.name ?? "Uncategorized";
        const catSlug = cat?.slug ?? "uncategorized";
        if (!byCategory[catSlug]) byCategory[catSlug] = { name: catName, total: 0, needsEnrich: 0 };
        byCategory[catSlug].total++;
      }
      for (const p of needsEnrichment) {
        const cat = p.categories as unknown as { name: string; slug: string } | null;
        const catSlug = cat?.slug ?? "uncategorized";
        if (byCategory[catSlug]) byCategory[catSlug].needsEnrich++;
      }
      const topCategories = Object.entries(byCategory).filter(([, v]) => v.needsEnrich > 0).sort((a, b) => b[1].needsEnrich - a[1].needsEnrich).slice(0, 8);
      return { total: products.length, needsEnrichment: needsEnrichment.length, enriched: products.length - needsEnrichment.length, topCategories };
    },
  });

  // Recent reviews
  const { data: recentReviews } = useQuery<ReviewWithRelations[]>({
    queryKey: ["admin-recent-reviews"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("*, products(name), profiles(name)").order("created_at", { ascending: false }).limit(10);
      return (data as unknown as ReviewWithRelations[]) ?? [];
    },
  });

  // Top products
  const { data: topProducts } = useQuery<TopProduct[]>({
    queryKey: ["admin-top-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("name, total_reviews, avg_rating, view_count").order("view_count", { ascending: false }).limit(5);
      return (data as TopProduct[]) ?? [];
    },
  });

  // Recent activity
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(8);
      return data || [];
    },
  });

  const statusTotal = useMemo(() => (statusBreakdown ?? []).reduce((sum, s) => sum + s.value, 0), [statusBreakdown]);

  return (
    <>
      <SeoHead title="Admin Dashboard" />
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview and recent activity</p>
        </motion.div>

        {/* Primary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <StatCard title="Products" value={stats?.products ?? 0} icon={Package} color="primary" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
            <StatCard title="Reviews" value={stats?.reviews ?? 0} icon={Star} color="secondary" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <StatCard title="Users" value={stats?.users ?? 0} icon={Users} color="success" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
            <StatCard title="Pending" value={stats?.pending ?? 0} icon={MessageSquare} color="warning" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <StatCard title="Categories" value={stats?.categories ?? 0} icon={Globe} color="primary" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <StatCard title="Comparisons" value={stats?.comparisons ?? 0} icon={TrendingUp} color="secondary" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <StatCard title="Blog Posts" value={stats?.blogPosts ?? 0} icon={FileText} color="success" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
            <StatCard title="Submissions" value={stats?.pendingSubmissions ?? 0} icon={ShieldCheck} color="warning" />
          </motion.div>
        </div>

        {/* Quick Actions + System Health + Content Pipeline */}
        <div className="grid xl:grid-cols-3 gap-4">
          <QuickActionsPanel />
          <SystemHealthPanel />
          <ContentPipelineWidget />
        </div>

        {/* Growth cards */}
        {growthStats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "New Users (7d)", value: growthStats.newUsers },
              { label: "New Products (7d)", value: growthStats.newProducts },
              { label: "New Reviews (7d)", value: growthStats.newReviews },
            ].map((g) => (
              <motion.div key={g.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{g.label}</p>
                      <p className="text-2xl font-bold text-foreground">{g.value}</p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-green-500" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Charts row */}
        <div className="grid xl:grid-cols-3 gap-5">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-2 glass-card p-6">
            <h3 className="font-display font-bold text-foreground mb-5">Reviews — Last 30 Days</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={reviewsOverTime ?? []}>
                <defs>
                  <linearGradient id="reviewGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(245, 82%, 63%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(245, 82%, 63%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 90%)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(225, 10%, 48%)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(225, 10%, 48%)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(225, 15%, 90%)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="reviews" stroke="hsl(245, 82%, 63%)" fill="url(#reviewGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-6">
            <h3 className="font-display font-bold text-foreground mb-5">Review Status</h3>
            {statusBreakdown && statusBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {statusBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-4 justify-center mt-3">
                  {statusBreakdown.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {s.name} ({statusTotal > 0 ? Math.round((s.value / statusTotal) * 100) : 0}%)
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">No review data yet.</p>
            )}
          </motion.div>
        </div>

        {/* Category distribution + enrichment */}
        <div className="grid xl:grid-cols-2 gap-5">
          {categoryDistribution && categoryDistribution.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }} className="glass-card p-6">
              <h3 className="font-display font-bold text-foreground mb-4">Products by Category</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 90%)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(225, 10%, 48%)" }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: "hsl(225, 10%, 48%)" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="products" fill="hsl(245, 82%, 63%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {enrichmentStats && enrichmentStats.needsEnrichment > 0 && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.29 }} className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-warning" />
                  <h3 className="font-display font-bold text-foreground">Enrichment Status</h3>
                </div>
                <Link to="/admin/seed"><Button variant="outline" size="sm" className="rounded-lg font-medium"><Sparkles className="mr-1 h-3 w-3" /> Enrich</Button></Link>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 rounded-xl bg-muted/50"><div className="text-2xl font-bold text-foreground">{enrichmentStats.total}</div><div className="text-xs text-muted-foreground">Total</div></div>
                <div className="text-center p-3 rounded-xl bg-green-500/10"><div className="text-2xl font-bold text-green-600">{enrichmentStats.enriched}</div><div className="text-xs text-muted-foreground">Enriched</div></div>
                <div className="text-center p-3 rounded-xl bg-amber-500/10"><div className="text-2xl font-bold text-amber-600">{enrichmentStats.needsEnrichment}</div><div className="text-xs text-muted-foreground">Needs Work</div></div>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{Math.round((enrichmentStats.enriched / enrichmentStats.total) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(enrichmentStats.enriched / enrichmentStats.total) * 100}%` }} />
                </div>
              </div>
              {enrichmentStats.topCategories.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Top needing enrichment</div>
                  {enrichmentStats.topCategories.map(([slug, cat]) => (
                    <div key={slug} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 text-sm">
                      <span className="font-medium text-foreground">{cat.name}</span>
                      <span className="text-xs text-amber-600">{cat.needsEnrich} / {cat.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Bottom: Recent reviews + top products + activity */}
        <div className="grid xl:grid-cols-3 gap-5">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-foreground">Recent Reviews</h3>
              <Link to="/admin/reviews"><Button variant="ghost" size="sm" className="rounded-lg font-medium">View All</Button></Link>
            </div>
            <div className="space-y-1">
              {recentReviews?.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{r.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">on {r.products?.name ?? "—"} · by {r.profiles?.name ?? "Anonymous"}</p>
                  </div>
                  <StatusBadge status={r.status ?? "pending"} />
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
              {topProducts?.map((p, i) => (
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

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-foreground">Recent Activity</h3>
              <Link to="/admin/activity"><Button variant="ghost" size="sm" className="rounded-lg font-medium">View All</Button></Link>
            </div>
            <div className="space-y-1">
              {recentActivity.map((a: any) => (
                <div key={a.id} className="py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium text-foreground truncate">{a.action}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5.5">
                    {a.entity_type && <span className="capitalize">{a.entity_type}</span>}
                    {a.created_at && <span> · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>}
                  </p>
                </div>
              ))}
              {recentActivity.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
