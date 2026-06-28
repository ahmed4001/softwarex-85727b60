import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Star, Eye, MessageSquare, TrendingUp, ExternalLink, Pencil } from "lucide-react";

export default function VendorProductsPage() {
  const { user } = useAuth();

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["vendor-claimed-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("*, products(id, name, slug, logo_url, tagline, avg_rating, total_reviews, view_count, click_count, pricing_model, is_featured, categories!products_category_id_fkey(name))")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      return data || [];
    },
  });

  return (
    <>
      <SeoHead title="My Products — Vendor Portal" description="View analytics for your claimed products." robots="noindex, nofollow" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">My Products</h1>
            <p className="text-muted-foreground mt-1">{claims.length} claimed product{claims.length !== 1 ? "s" : ""}</p>
          </div>
          <Link to="/vendor/claim">
            <Button variant="outline" size="sm">Claim Another</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : claims.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No products yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Claim your first product to see analytics here.</p>
            <Link to="/vendor/claim"><Button>Claim a Product</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((c: any) => {
              const p = c.products;
              if (!p) return null;
              return (
                <div key={c.id} className="glass-card p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {p.logo_url ? <img decoding="async" loading="lazy" src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-display font-bold text-foreground">{p.name}</h3>
                        {p.is_featured && <Badge variant="secondary" className="text-[10px]">Featured</Badge>}
                      </div>
                      {p.tagline && <p className="text-sm text-muted-foreground mt-0.5">{p.tagline}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {p.categories?.name && <Badge variant="outline" className="text-[10px]">{p.categories.name}</Badge>}
                        {p.pricing_model && <Badge variant="outline" className="text-[10px] capitalize">{p.pricing_model}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link to={`/vendor/products/${p.id}/edit`}>
                        <Button variant="ghost" size="sm" className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      </Link>
                      <Link to={`/product/${p.slug}`}>
                        <Button variant="ghost" size="sm" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> View</Button>
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <Eye className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-lg font-bold text-foreground">{(p.view_count || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Views</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-lg font-bold text-foreground">{(p.click_count || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Clicks</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <Star className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-lg font-bold text-foreground">{p.avg_rating || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Rating</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-lg font-bold text-foreground">{p.total_reviews || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Reviews</p>
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
