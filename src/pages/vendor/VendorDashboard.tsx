import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { motion } from "framer-motion";
import { Package, Star, Eye, MessageSquare, TrendingUp, Pencil, BarChart3, Users, LayoutGrid, ExternalLink, Activity, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { VendorResponseMetrics } from "@/components/vendor/VendorResponseMetrics";
import { VendorCompetitorBenchmark } from "@/components/vendor/VendorCompetitorBenchmark";

// ---------- Command Center primitives (scoped to this page) ----------
const NAVY = "#0a0a1a";
const PANEL = "#0f0f24";
const PANEL_HI = "#141432";
const BORDER = "#1e1e5a";
const ACCENT = "#4f46e5";
const ACCENT_GLOW = "#818cf8";

function CommandPanel({ children, className = "", label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div
      className={`relative rounded-md border ${className}`}
      style={{ background: PANEL, borderColor: BORDER }}
    >
      {label && (
        <div
          className="absolute -top-px left-3 px-2 text-[10px] font-mono uppercase tracking-[0.18em]"
          style={{ background: PANEL, color: ACCENT_GLOW, transform: "translateY(-50%)" }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function CommandStat({ title, value, icon: Icon, accent }: { title: string; value: React.ReactNode; icon: any; accent?: boolean }) {
  return (
    <div
      className="relative p-4 md:p-5 rounded-md border overflow-hidden group"
      style={{ background: PANEL, borderColor: BORDER }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${BORDER} 1px, transparent 1px), linear-gradient(90deg, ${BORDER} 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-300/70 mb-2">{title}</div>
          <div className="font-mono text-2xl md:text-3xl font-semibold tabular-nums" style={{ color: accent ? ACCENT_GLOW : "#e8e8ff" }}>
            {value}
          </div>
        </div>
        <div
          className="h-8 w-8 rounded-sm flex items-center justify-center border flex-shrink-0"
          style={{ borderColor: BORDER, background: PANEL_HI, color: ACCENT_GLOW }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, action }: { icon: any; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-6 w-6 rounded-sm flex items-center justify-center border" style={{ borderColor: BORDER, background: PANEL_HI, color: ACCENT_GLOW }}>
          <Icon className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
          <h2 className="text-sm font-mono uppercase tracking-[0.22em] text-indigo-100">{title}</h2>
          {description && <p className="text-[11px] text-indigo-300/60 font-mono">// {description}</p>}
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
      <div
        className="relative rounded-lg overflow-hidden -mx-2 sm:mx-0"
        style={{ background: NAVY, color: "#e8e8ff" }}
      >
        {/* Ambient glow */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background: `radial-gradient(800px 300px at 80% -10%, ${ACCENT}26, transparent 60%), radial-gradient(600px 300px at 0% 100%, ${ACCENT}1a, transparent 60%)`,
          }}
        />
        {/* Grid backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${ACCENT_GLOW} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT_GLOW} 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative space-y-8 p-4 md:p-8">
        {/* Status bar */}
        <div
          className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ background: PANEL_HI, borderColor: BORDER, color: ACCENT_GLOW }}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#4ade80" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#4ade80" }} />
            </span>
            <span>SYS // VENDOR.OPS</span>
            <span className="hidden sm:inline opacity-60">/ NODE 01 / LIVE</span>
          </div>
          <div className="hidden md:flex items-center gap-3 opacity-70">
            <Radio className="h-3 w-3" />
            <span>{new Date().toISOString().slice(0,16).replace("T"," ")}Z</span>
          </div>
        </div>

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b" style={{ borderColor: BORDER }}>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-indigo-300/60 mb-2">// CONTROL ROOM</div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-indigo-50 leading-tight">Vendor Command</h1>
            <p className="text-sm text-indigo-300/70 mt-1 font-mono">Live telemetry across your products, reviews, and signal.</p>
          </div>
          {claims.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link to="/vendor/reviews"><Button variant="outline" size="sm" className="gap-1.5 border-indigo-700/60 bg-indigo-950/40 text-indigo-100 hover:bg-indigo-900/60 hover:text-white font-mono text-xs uppercase tracking-wider"><MessageSquare className="h-3.5 w-3.5" />Reviews</Button></Link>
              <Link to="/vendor/analytics"><Button variant="outline" size="sm" className="gap-1.5 border-indigo-700/60 bg-indigo-950/40 text-indigo-100 hover:bg-indigo-900/60 hover:text-white font-mono text-xs uppercase tracking-wider"><BarChart3 className="h-3.5 w-3.5" />Analytics</Button></Link>
              <Link to="/vendor/claim"><Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase tracking-wider shadow-[0_0_20px_-4px_#4f46e5]"><Package className="h-3.5 w-3.5" />Claim</Button></Link>
            </div>
          )}
        </div>

        {claims.length === 0 ? (
          <CommandPanel className="p-12 text-center">
            <Package className="h-12 w-12 text-indigo-400/40 mx-auto mb-4" />
            <h2 className="text-lg font-mono uppercase tracking-wider text-indigo-100 mb-2">No claimed products</h2>
            <p className="text-sm text-indigo-300/70 mb-4 font-mono">// Claim a product to begin transmission.</p>
            <Link to="/vendor/claim"><Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono uppercase tracking-wider">Claim a Product</Button></Link>
          </CommandPanel>
        ) : (
          <>
            {/* KPIs */}
            <section>
              <SectionHeader icon={LayoutGrid} title="Telemetry" description="headline metrics — all claimed products" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                <CommandStat title="Products" value={claims.length} icon={Package} />
                <CommandStat title="Views" value={totalViews.toLocaleString()} icon={Eye} />
                <CommandStat title="Clicks" value={totalClicks.toLocaleString()} icon={TrendingUp} />
                <CommandStat title="Avg Rating" value={avgRating} icon={Star} accent />
                <CommandStat title="Unanswered" value={unanswered} icon={MessageSquare} accent={unanswered > 0} />
              </div>
            </section>

            {/* Performance tabs */}
            <section>
              <SectionHeader icon={Activity} title="Performance" description="trends, response, benchmark" />
              <Tabs defaultValue="trend" className="w-full">
                <TabsList
                  className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex p-1 rounded-md border h-auto"
                  style={{ background: PANEL_HI, borderColor: BORDER }}
                >
                  <TabsTrigger value="trend" className="font-mono text-[11px] uppercase tracking-wider data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-indigo-200">Trend</TabsTrigger>
                  <TabsTrigger value="response" className="font-mono text-[11px] uppercase tracking-wider data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-indigo-200">Response</TabsTrigger>
                  <TabsTrigger value="benchmark" className="font-mono text-[11px] uppercase tracking-wider data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-indigo-200">Benchmark</TabsTrigger>
                </TabsList>

                <TabsContent value="trend" className="mt-4">
                  {reviews.length > 0 ? (
                    <CommandPanel label="Review.flux / 12mo" className="p-4 md:p-6 pt-6">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="vendorGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={ACCENT_GLOW} stopOpacity={0.5} />
                                <stop offset="95%" stopColor={ACCENT_GLOW} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 4" stroke={BORDER} />
                            <XAxis dataKey="month" tick={{ fill: "#a5b4fc", fontSize: 10, fontFamily: "monospace" }} stroke={BORDER} />
                            <YAxis tick={{ fill: "#a5b4fc", fontSize: 10, fontFamily: "monospace" }} stroke={BORDER} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: PANEL_HI,
                                border: `1px solid ${BORDER}`,
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontFamily: "monospace",
                                color: "#e8e8ff",
                              }}
                            />
                            <Area type="monotone" dataKey="reviews" stroke={ACCENT_GLOW} fill="url(#vendorGrad)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CommandPanel>
                  ) : (
                    <CommandPanel className="p-8 text-center text-sm text-indigo-300/60 font-mono">// no signal — past 12 months</CommandPanel>
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
                title="Assets"
                description={`${claims.length} claimed unit${claims.length === 1 ? "" : "s"}`}
                action={
                  <Link to="/vendor/products" className="hidden sm:block">
                    <Button variant="ghost" size="sm" className="gap-1 text-[11px] font-mono uppercase tracking-wider text-indigo-300 hover:text-white hover:bg-indigo-900/50">Manage<ExternalLink className="h-3 w-3" /></Button>
                  </Link>
                }
              />
              <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
                {claims.map((c: any, i: number) => (
                  <div
                    key={c.id}
                    className="relative rounded-md border p-4 md:p-5 flex items-center gap-4 transition-all hover:border-indigo-500/80 hover:shadow-[0_0_24px_-6px_#4f46e5]"
                    style={{ background: PANEL, borderColor: BORDER }}
                  >
                    <div className="absolute top-2 right-2 text-[9px] font-mono text-indigo-400/40 tracking-wider">#{String(i + 1).padStart(3, "0")}</div>
                    <div
                      className="h-12 w-12 rounded-sm flex items-center justify-center flex-shrink-0 overflow-hidden border"
                      style={{ background: PANEL_HI, borderColor: BORDER }}
                    >
                      {c.products?.logo_url ? (
                        <img src={c.products.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-indigo-400/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-indigo-50 truncate">{c.products?.name}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-indigo-300/70 mt-1 font-mono tabular-nums">
                        <span className="flex items-center gap-1"><Star className="h-3 w-3" />{c.products?.avg_rating || 0}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{c.products?.total_reviews || 0}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.products?.view_count || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link to={`/vendor/products/${c.products?.id}/edit`} aria-label="Edit product">
                        <Button variant="ghost" size="sm" className="text-indigo-200 hover:text-white hover:bg-indigo-900/60"><Pencil className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Link to={`/product/${c.products?.slug}`}>
                        <Button variant="outline" size="sm" className="border-indigo-700/60 bg-indigo-950/40 text-indigo-100 hover:bg-indigo-900/60 hover:text-white font-mono text-xs uppercase tracking-wider">View</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </motion.div>
      </div>
      )}
    </>
  );
}
