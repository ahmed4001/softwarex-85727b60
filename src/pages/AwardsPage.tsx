import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, ThumbsUp, Search, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AwardsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["award-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("award_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: nominations = [] } = useQuery({
    queryKey: ["award-nominations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("award_nominations")
        .select("*, products(id, name, slug, logo_url, avg_rating, total_reviews)");
      return data || [];
    },
  });

  const { data: votes = [] } = useQuery({
    queryKey: ["award-votes"],
    queryFn: async () => {
      const { data } = await supabase.from("award_votes").select("*");
      return data || [];
    },
  });

  const { data: userVotes = [] } = useQuery({
    queryKey: ["my-award-votes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("award_votes")
        .select("award_category_id, product_id")
        .eq("user_id", user!.id);
      return data || [];
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ categoryId, productId }: { categoryId: string; productId: string }) => {
      const existing = userVotes.find((v: any) => v.award_category_id === categoryId);
      if (existing) {
        await supabase.from("award_votes").delete().eq("award_category_id", categoryId).eq("user_id", user!.id);
        if (existing.product_id === productId) return; // just removed
      }
      const { error } = await supabase.from("award_votes").insert({
        award_category_id: categoryId,
        product_id: productId,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-votes"] });
      queryClient.invalidateQueries({ queryKey: ["my-award-votes"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getTopProducts = (categoryId: string) => {
    const catNoms = nominations.filter((n: any) => n.award_category_id === categoryId);
    const voteCount = (productId: string) =>
      votes.filter((v: any) => v.award_category_id === categoryId && v.product_id === productId).length;
    return catNoms
      .map((n: any) => ({ ...n, voteCount: voteCount(n.product_id) }))
      .sort((a: any, b: any) => b.voteCount - a.voteCount)
      .slice(0, 10);
  };

  const currentYear = categories[0]?.year || 2026;

  return (
    <>
      <SeoHead title={`Best of ${currentYear} Awards`} description={`Vote for the best software of ${currentYear}. Community-driven awards across multiple categories.`} />
      <div className="container py-8 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--star))]/10 text-[hsl(var(--star))] px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Trophy className="h-4 w-4" /> Best of {currentYear}
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">Annual Software Awards</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">Vote for your favorite tools across categories. Help the community discover the best software.</p>
        </motion.div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-64 rounded-xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : categories.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No active award categories</h2>
            <p className="text-sm text-muted-foreground">Check back soon for the next awards season!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {categories.map((cat: any) => {
              const topProducts = getTopProducts(cat.id);
              const userVote = userVotes.find((v: any) => v.award_category_id === cat.id);
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-border/50 overflow-hidden">
                    <div className="bg-gradient-to-r from-[hsl(var(--star))]/5 to-primary/5 px-5 py-4 border-b border-border/50">
                      <h2 className="font-display font-bold text-foreground text-lg">{cat.name}</h2>
                      {cat.description && <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>}
                    </div>
                    <CardContent className="p-5">
                      {topProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No nominations yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {topProducts.map((nom: any, idx: number) => (
                            <div key={nom.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                {nom.products?.logo_url ? (
                                  <img decoding="async" loading="lazy" src={nom.products.logo_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-primary">{nom.products?.name?.charAt(0)}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <Link to={`/product/${nom.products?.slug}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                                  {nom.products?.name}
                                </Link>
                                <p className="text-[10px] text-muted-foreground">★ {Number(nom.products?.avg_rating || 0).toFixed(1)} · {nom.products?.total_reviews} reviews</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground">{nom.voteCount}</span>
                                <Button
                                  variant={userVote?.product_id === nom.product_id ? "default" : "outline"}
                                  size="sm"
                                  className="h-7 px-2 text-xs rounded-lg"
                                  disabled={!user || voteMutation.isPending}
                                  onClick={() => voteMutation.mutate({ categoryId: cat.id, productId: nom.product_id })}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {user && <NominateButton categoryId={cat.id} existingProductIds={topProducts.map((n: any) => n.product_id)} />}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function NominateButton({ categoryId, existingProductIds }: { categoryId: string; existingProductIds: string[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["nominate-search", search],
    enabled: search.length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url")
        .eq("is_active", true)
        .ilike("name", `%${search}%`)
        .limit(10);
      return (data || []).filter((p: any) => !existingProductIds.includes(p.id));
    },
  });

  const nominate = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("award_nominations").insert({
        award_category_id: categoryId,
        product_id: productId,
        nominated_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product nominated!");
      queryClient.invalidateQueries({ queryKey: ["award-nominations"] });
      setOpen(false);
      setSearch("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full mt-3 gap-1.5 text-xs text-muted-foreground">
          <Plus className="h-3.5 w-3.5" /> Nominate a product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nominate a Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {products.map((p: any) => (
              <button
                key={p.id}
                onClick={() => nominate.mutate(p.id)}
                disabled={nominate.isPending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {p.logo_url ? <img decoding="async" loading="lazy" src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-primary">{p.name.charAt(0)}</span>}
                </div>
                <span className="text-sm font-medium text-foreground">{p.name}</span>
              </button>
            ))}
            {search.length > 1 && products.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No products found</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
