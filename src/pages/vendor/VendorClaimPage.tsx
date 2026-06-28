import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Search, ShieldCheck, Loader2, CheckCircle, Clock } from "lucide-react";

export default function VendorClaimPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [evidence, setEvidence] = useState("");

  // Search products
  const { data: products = [], isLoading: searching } = useQuery({
    queryKey: ["vendor-search-products", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, is_claimed")
        .ilike("name", `%${search}%`)
        .eq("is_active", true)
        .limit(10);
      return data || [];
    },
  });

  // Existing claims by user
  const { data: myClaims = [] } = useQuery({
    queryKey: ["my-product-claims", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("*, products(name, logo_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const submitClaim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_claims").insert({
        product_id: selectedProduct.id,
        user_id: user!.id,
        evidence: evidence.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim submitted! An admin will review it.");
      setSelectedProduct(null);
      setEvidence("");
      setSearch("");
      queryClient.invalidateQueries({ queryKey: ["my-product-claims"] });
    },
    onError: (err: any) => {
      toast.error(err.message?.includes("duplicate") ? "You've already claimed this product." : err.message);
    },
  });

  return (
    <>
      <SeoHead title="Claim Product — Vendor Portal" description="Claim your product listing on ReviewHunts." robots="noindex, nofollow" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-display font-bold text-foreground">Claim Your Product</h1>
          <p className="text-muted-foreground mt-1">Verify ownership to manage your listing and respond to reviews.</p>
        </div>

        {/* Search */}
        <div className="glass-card p-6 mb-6">
          <Label className="text-sm font-semibold mb-2 block">Search for your product</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedProduct(null); }}
              placeholder="Start typing your product name..."
              className="pl-10"
            />
          </div>

          {search.length >= 2 && (
            <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
              {searching ? (
                <p className="text-sm text-muted-foreground py-2">Searching...</p>
              ) : products.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No products found</p>
              ) : (
                products.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      selectedProduct?.id === p.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {p.logo_url ? <img decoding="async" loading="lazy" src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-muted-foreground">{p.name.charAt(0)}</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    </div>
                    {p.is_claimed && <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Already claimed</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Claim form */}
        {selectedProduct && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
            <h3 className="font-semibold text-foreground mb-3">Claim: {selectedProduct.name}</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-1 block">Evidence of ownership (optional)</Label>
                <Input
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="e.g., Your role at the company, company email, website admin access..."
                />
                <p className="text-xs text-muted-foreground mt-1">Provide any info to help verify your claim</p>
              </div>
              <Button
                onClick={() => submitClaim.mutate()}
                disabled={submitClaim.isPending || selectedProduct.is_claimed}
                className="w-full"
              >
                {submitClaim.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Claim
              </Button>
            </div>
          </motion.div>
        )}

        {/* Existing claims */}
        {myClaims.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Your Claims</h3>
            {myClaims.map((c: any) => (
              <div key={c.id} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {c.products?.logo_url ? <img decoding="async" loading="lazy" src={c.products.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold">{c.products?.name?.charAt(0)}</span>}
                  </div>
                  <span className="text-sm font-medium text-foreground">{c.products?.name}</span>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  c.status === "approved" ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]" :
                  c.status === "rejected" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {c.status === "approved" ? <CheckCircle className="h-3 w-3 inline mr-1" /> : c.status === "pending" ? <Clock className="h-3 w-3 inline mr-1" /> : null}
                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
}
