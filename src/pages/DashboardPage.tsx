import { useEffect, useState } from "react";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { NotificationsTab } from "@/components/dashboard/NotificationsTab";
import { ReviewActivityChart } from "@/components/dashboard/ReviewActivityChart";
import { RecommendationsWidget } from "@/components/dashboard/RecommendationsWidget";
import { ComparisonHistoryWidget } from "@/components/dashboard/ComparisonHistoryWidget";
import { SocialFeedWidget } from "@/components/dashboard/SocialFeedWidget";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { useSavedProducts } from "@/hooks/useSavedProducts";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Bookmark, Star, Settings, User, LogOut, Loader2, Search, ArrowRight, Heart, Sparkles, MessageSquarePlus, Bell, Award, List, Plus, Flame, TrendingUp, BarChart3, GitCompareArrows, Users } from "lucide-react";
import { BadgeShowcase } from "@/components/dashboard/BadgeShowcase";
import { StreakTracker } from "@/components/dashboard/StreakTracker";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-8 w-48 bg-muted rounded-lg mb-2" />
        <div className="h-4 w-72 bg-muted/60 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/40" />
        ))}
      </div>
      <div className="h-10 w-80 bg-muted/50 rounded-lg" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-muted/40" />
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:border-border transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-display font-bold text-foreground leading-none">{value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const { savedProductIds } = useSavedProducts();

  const { data: profile } = useQuery({
    queryKey: ["dashboard-profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, review_count, helpful_votes_received")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  const { data: badgeCounts } = useQuery({
    queryKey: ["dashboard-badge-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("user_badges")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count || 0;
    },
  });

  return (
    <RequireAuth>
      <SeoHead title={t("dashboard.title")} description={t("dashboard.subtitle")} />
      <main className="container py-8 md:py-10 max-w-6xl">
        {!user ? (
          <DashboardSkeleton />
        ) : (
          <>
            <WelcomeBanner userName={user.email?.split("@")[0]} />

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-extrabold text-foreground">
                    {profile?.name || t("dashboard.title")}
                  </h1>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="gap-2 text-destructive hover:text-destructive">
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">{t("auth.signOut")}</span>
              </Button>
            </motion.div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <StatCard icon={Star} label="Reviews" value={profile?.review_count || 0} color="bg-[hsl(var(--star))]/10 text-[hsl(var(--star))]" />
              <StatCard icon={Bookmark} label="Saved" value={savedProductIds.length} color="bg-primary/10 text-primary" />
              <StatCard icon={Award} label="Badges" value={badgeCounts || 0} color="bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]" />
              <StatCard icon={TrendingUp} label="Helpful Votes" value={profile?.helpful_votes_received || 0} color="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" />
            </div>

            {/* Main content: two-column on desktop */}
            <div className="grid lg:grid-cols-[1fr_300px] gap-8">
              {/* Left: Tabs */}
              <div>
                <Tabs defaultValue="saved" className="space-y-5">
                  <TabsList className="bg-muted/30 p-1 rounded-xl w-full flex flex-wrap">
                    <TabsTrigger value="saved" className="gap-1.5 flex-1 min-w-0 rounded-lg text-xs sm:text-sm">
                      <Bookmark className="h-3.5 w-3.5" /> {t("dashboard.saved")}
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="gap-1.5 flex-1 min-w-0 rounded-lg text-xs sm:text-sm">
                      <Star className="h-3.5 w-3.5" /> {t("dashboard.myReviews")}
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="gap-1.5 flex-1 min-w-0 rounded-lg text-xs sm:text-sm">
                      <BarChart3 className="h-3.5 w-3.5" /> Analytics
                    </TabsTrigger>
                    <TabsTrigger value="discover" className="gap-1.5 flex-1 min-w-0 rounded-lg text-xs sm:text-sm">
                      <GitCompareArrows className="h-3.5 w-3.5" /> Discover
                    </TabsTrigger>
                    <TabsTrigger value="community" className="gap-1.5 flex-1 min-w-0 rounded-lg text-xs sm:text-sm">
                      <Users className="h-3.5 w-3.5" /> Community
                    </TabsTrigger>
                    <TabsTrigger value="lists" className="gap-1.5 flex-1 min-w-0 rounded-lg text-xs sm:text-sm">
                      <List className="h-3.5 w-3.5" /> Lists
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-1.5 flex-1 min-w-0 rounded-lg text-xs sm:text-sm">
                      <Bell className="h-3.5 w-3.5" /> Activity
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="gap-1.5 flex-1 min-w-0 rounded-lg text-xs sm:text-sm">
                      <Settings className="h-3.5 w-3.5" /> {t("dashboard.profile")}
                    </TabsTrigger>
                  </TabsList>

                  <AnimatePresence mode="wait">
                    <TabsContent value="saved" asChild forceMount={undefined}>
                      <motion.div key="saved" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                        <SavedProductsTab userId={user.id} />
                      </motion.div>
                    </TabsContent>
                    <TabsContent value="reviews" asChild forceMount={undefined}>
                      <motion.div key="reviews" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                        <MyReviewsTab userId={user.id} />
                      </motion.div>
                    </TabsContent>
                    <TabsContent value="analytics" asChild forceMount={undefined}>
                      <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                        <AnalyticsTab userId={user.id} />
                      </motion.div>
                    </TabsContent>
                    <TabsContent value="discover" asChild forceMount={undefined}>
                      <motion.div key="discover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                        <DiscoverTab userId={user.id} savedProductIds={savedProductIds} />
                      </motion.div>
                    </TabsContent>
                    <TabsContent value="community" asChild forceMount={undefined}>
                      <motion.div key="community" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                        <CommunityTab />
                      </motion.div>
                    </TabsContent>
                    <TabsContent value="lists" asChild forceMount={undefined}>
                      <motion.div key="lists" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                        <MyListsTab userId={user.id} />
                      </motion.div>
                    </TabsContent>
                    <TabsContent value="notifications" asChild forceMount={undefined}>
                      <motion.div key="notifications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                        <NotificationsTab userId={user.id} />
                      </motion.div>
                    </TabsContent>
                    <TabsContent value="profile" asChild forceMount={undefined}>
                      <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                        <ProfileTab user={user} onSignOut={signOut} />
                      </motion.div>
                    </TabsContent>
                  </AnimatePresence>
                </Tabs>
              </div>

              {/* Right: Sidebar widgets */}
              <aside className="space-y-5 order-first lg:order-last">
                <StreakTracker userId={user.id} />
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <BadgeShowcase userId={user.id} />
                  </CardContent>
                </Card>
                <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-accent/5">
                  <CardContent className="p-5 text-center">
                    <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-foreground mb-1">Share your experience</h4>
                    <p className="text-xs text-muted-foreground mb-3">Help others by writing reviews and earn badges.</p>
                    <Link to="/search">
                      <Button size="sm" className="rounded-xl gap-1.5 w-full">
                        <MessageSquarePlus className="h-3.5 w-3.5" /> Write a Review
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>
    </RequireAuth>
  );
}

function SavedProductsTab({ userId }: { userId: string }) {
  const { savedProductIds, isLoading: loadingSaved } = useSavedProducts();
  const { t } = useTranslation();

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ["saved-products-detail", savedProductIds],
    enabled: savedProductIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name)")
        .in("id", savedProductIds)
        .eq("is_active", true);
      return data || [];
    },
  });

  const isLoading = loadingSaved || loadingProducts;

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
        <div className="relative mx-auto w-20 h-20 mb-5">
          <div className="absolute inset-0 rounded-2xl bg-primary/5 rotate-6" />
          <div className="absolute inset-0 rounded-2xl bg-primary/10 -rotate-3" />
          <div className="relative h-full w-full rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
            <Bookmark className="h-8 w-8 text-primary/50" />
          </div>
        </div>
        <h3 className="text-base font-bold text-foreground mb-1">{t("dashboard.noSavedProducts")}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">{t("dashboard.noSavedHint")}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/search">
            <Button className="gap-2 rounded-xl">
              <Search className="h-4 w-4" /> Browse Software
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {products.map((p: any) => (
        <ProductCard
          key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline}
          logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews}
          pricing_model={p.pricing_model} category_name={p.categories?.name}
          is_featured={p.is_featured} is_sponsored={p.is_sponsored}
        />
      ))}
    </div>
  );
}

function MyReviewsTab({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["my-reviews", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, products!reviews_product_id_fkey(name, slug, logo_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
  }

  if (!reviews || reviews.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
        <div className="relative mx-auto w-20 h-20 mb-5">
          <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--star))]/5 rotate-6" />
          <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--star))]/10 -rotate-3" />
          <div className="relative h-full w-full rounded-2xl bg-gradient-to-br from-[hsl(var(--star))]/15 to-primary/5 flex items-center justify-center">
            <Star className="h-8 w-8 text-[hsl(var(--star))]/50" />
          </div>
        </div>
        <h3 className="text-base font-bold text-foreground mb-1">{t("dashboard.noReviews")}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">{t("dashboard.noReviewsHint")}</p>
        <Link to="/search">
          <Button className="gap-2 rounded-xl">
            <MessageSquarePlus className="h-4 w-4" /> Write a Review
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r: any) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {r.products?.logo_url ? (
                    <img src={r.products.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{r.products?.name?.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link to={`/product/${r.products?.slug}`} className="font-semibold text-sm text-foreground hover:text-primary transition-colors">
                      {r.products?.name}
                    </Link>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.status === 'approved' ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' :
                      r.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                      'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-medium">{r.title || t("dashboard.untitledReview")}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < r.overall_rating ? 'text-[hsl(var(--star))] fill-[hsl(var(--star))]' : 'text-muted-foreground/20'}`} />
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.body && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.body}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function ProfileTab({ user, onSignOut }: { user: any; onSignOut: () => void }) {
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data;
    },
  });

  const [form, setForm] = useState({ name: "", bio: "", company: "", job_title: "", industry: "" });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "",
        bio: profile.bio || "",
        company: profile.company || "",
        job_title: profile.job_title || "",
        industry: profile.industry || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(form)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(t("dashboard.profileUpdateFailed"));
    } else {
      toast.success(t("dashboard.profileUpdated"));
      refetch();
    }
  };

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />)}</div>;
  }

  return (
    <div className="max-w-lg space-y-5">
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{profile?.name || user.email}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t("dashboard.displayName")}</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t("dashboard.bio")}</label>
              <Input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={t("dashboard.bioPlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">{t("dashboard.company")}</label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">{t("dashboard.jobTitle")}</label>
                <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t("dashboard.industry")}</label>
              <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("dashboard.saveChanges")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MyListsTab({ userId }: { userId: string }) {
  const { data: lists, isLoading } = useQuery({
    queryKey: ["my-lists", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lists")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
  }

  if (!lists || lists.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
        <div className="relative mx-auto w-20 h-20 mb-5">
          <div className="absolute inset-0 rounded-2xl bg-primary/5 rotate-6" />
          <div className="absolute inset-0 rounded-2xl bg-primary/10 -rotate-3" />
          <div className="relative h-full w-full rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
            <List className="h-8 w-8 text-primary/50" />
          </div>
        </div>
        <h3 className="text-base font-bold text-foreground mb-1">No lists yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">Create curated software lists to share with the community.</p>
        <Link to="/lists/new">
          <Button className="gap-2 rounded-xl"><Plus className="h-4 w-4" /> Create Your First List</Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end mb-1">
        <Link to="/lists/new"><Button size="sm" variant="outline" className="gap-1.5 rounded-xl"><Plus className="h-4 w-4" /> New List</Button></Link>
      </div>
      {lists.map((list: any) => (
        <motion.div key={list.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Link to={`/lists/${list.slug}`} className="font-semibold text-sm text-foreground hover:text-primary transition-colors">
                    {list.title}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{list.product_count} products</span>
                    <span>{list.upvote_count} upvotes</span>
                    <span className={list.is_published ? "text-[hsl(var(--success))]" : "text-muted-foreground"}>
                      {list.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>
                <Link to={`/lists/${list.slug}/edit`}>
                  <Button variant="outline" size="sm" className="rounded-lg">Edit</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function AnalyticsTab({ userId }: { userId: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-foreground mb-1">Your Analytics</h3>
        <p className="text-sm text-muted-foreground">Track your review activity and engagement over time.</p>
      </div>
      <ReviewActivityChart userId={userId} />
    </div>
  );
}

function DiscoverTab({ userId, savedProductIds }: { userId: string; savedProductIds: string[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-foreground mb-1">Discover</h3>
        <p className="text-sm text-muted-foreground">Recommendations and comparisons based on your interests.</p>
      </div>
      <RecommendationsWidget userId={userId} savedProductIds={savedProductIds} />
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Comparisons For You</h3>
          </div>
          <ComparisonHistoryWidget userId={userId} savedProductIds={savedProductIds} />
        </CardContent>
      </Card>
    </div>
  );
}

function CommunityTab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-foreground mb-1">Community Feed</h3>
        <p className="text-sm text-muted-foreground">See what others are reviewing and sharing.</p>
      </div>
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
          </div>
          <SocialFeedWidget />
        </CardContent>
      </Card>
    </div>
  );
}