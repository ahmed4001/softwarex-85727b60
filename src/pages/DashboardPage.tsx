import { useEffect, useState } from "react";
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
import { Bookmark, Star, Settings, User, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-8 w-48 bg-muted rounded-lg mb-2" />
        <div className="h-4 w-72 bg-muted/60 rounded-lg" />
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

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();

  return (
    <RequireAuth>
      <SeoHead title={t("dashboard.title")} description={t("dashboard.subtitle")} />
      <main className="container py-10 max-w-5xl">
        {!user ? (
          <DashboardSkeleton />
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{t("dashboard.title")}</h1>
              <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
            </motion.div>

            <Tabs defaultValue="saved" className="space-y-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="saved" className="gap-1.5"><Bookmark className="h-4 w-4" /> {t("dashboard.saved")}</TabsTrigger>
                <TabsTrigger value="reviews" className="gap-1.5"><Star className="h-4 w-4" /> {t("dashboard.myReviews")}</TabsTrigger>
                <TabsTrigger value="profile" className="gap-1.5"><Settings className="h-4 w-4" /> {t("dashboard.profile")}</TabsTrigger>
              </TabsList>

              <TabsContent value="saved"><SavedProductsTab userId={user.id} /></TabsContent>
              <TabsContent value="reviews"><MyReviewsTab userId={user.id} /></TabsContent>
              <TabsContent value="profile"><ProfileTab user={user} onSignOut={signOut} /></TabsContent>
            </Tabs>
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
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
          <Bookmark className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-muted-foreground font-medium">{t("dashboard.noSavedProducts")}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{t("dashboard.noSavedHint")}</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <div className="text-center py-16">
        <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
          <Star className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-muted-foreground font-medium">{t("dashboard.noReviews")}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{t("dashboard.noReviewsHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r: any) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
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
                <h3 className="font-semibold text-sm text-foreground">{r.products?.name}</h3>
                <span className={`status-badge-${r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'}`}>
                  {r.status}
                </span>
              </div>
              <p className="text-sm text-foreground font-medium">{r.title || t("dashboard.untitledReview")}</p>
              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3 w-3 ${i < r.overall_rating ? 'text-[hsl(var(--star))] fill-[hsl(var(--star))]' : 'text-muted-foreground/20'}`} />
                ))}
                <span className="text-xs text-muted-foreground ml-1">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.body && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.body}</p>}
            </div>
          </div>
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
    <div className="max-w-lg space-y-6">
      <div className="glass-card p-6 space-y-4">
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
      </div>

      <Button variant="outline" onClick={onSignOut} className="w-full gap-2 text-destructive hover:text-destructive">
        <LogOut className="h-4 w-4" /> {t("auth.signOut")}
      </Button>
    </div>
  );
}
