import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { StatCard } from "@/components/StatCard";
import { motion } from "framer-motion";
import { Package, Star, Eye, MessageSquare, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function VendorDashboard() {
  const { user } = useAuth();

  // Get claimed products
  const { data: claims = [] } = useQuery({
    queryKey: ["vendor-claims", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("*, products(id, name, slug, logo_url, avg_rating, total_reviews, view_count)")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      return data || [];
    },
  });

  const productIds = claims.map((c: any) => c.products?.id).filter(Boolean);

  // Get reviews for claimed products
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

  // Get vendor responses count
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
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum: number, r: any) => sum + r.overall_rating, 0) / totalReviews).toFixed(1)
    : "—";
  const pendingReviews = reviews.filter((r: any) => r.status === "approved").length;
  const unanswered = pendingReviews - responses.length;

  return (
    <>
      <SeoHead title="Vendor Dashboard — SoftwareHub" description="Manage your products, respond to reviews, and view analytics." />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Vendor Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your products and reviews</p>
        </div>

        {claims.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No claimed products yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Claim your product listing to respond to reviews and view analytics.</p>
            <Link to="/vendor/claim">
              <Button>Claim a Product</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard title="Products" value={claims.length} icon={Package} />
              <StatCard title="Total Views" value={totalViews.toLocaleString()} icon={Eye} />
              <StatCard title="Avg Rating" value={avgRating} icon={Star} />
              <StatCard title="Unanswered" value={Math.max(0, unanswered)} icon={MessageSquare} />
            </div>

            <h2 className="text-lg font-display font-bold text-foreground mb-4">Your Products</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {claims.map((c: any) => (
                <div key={c.id} className="glass-card p-5 flex items-center gap-4">
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
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{c.products?.total_reviews || 0} reviews</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.products?.view_count || 0}</span>
                    </div>
                  </div>
                  <Link to={`/product/${c.products?.slug}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
