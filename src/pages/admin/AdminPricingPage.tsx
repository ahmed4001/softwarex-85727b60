import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Plus, Trash2, Pencil, Search, Check, Minus, GripVertical, Layers, Package, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PricingTier {
  id: string;
  product_id: string;
  name: string;
  price: number;
  period: string;
  description: string | null;
  is_popular: boolean;
  is_enterprise: boolean;
  sort_order: number;
  cta_label: string | null;
  cta_url: string | null;
}

interface PricingFeature {
  id: string;
  product_id: string;
  name: string;
  category: string | null;
  sort_order: number;
}

interface TierFeature {
  id: string;
  tier_id: string;
  feature_id: string;
  value: string;
}

export default function AdminPricingPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [tierDialog, setTierDialog] = useState<{ open: boolean; tier?: PricingTier }>({ open: false });
  const [featureDialog, setFeatureDialog] = useState<{ open: boolean; feature?: PricingFeature }>({ open: false });

  // Search products
  const { data: products = [] } = useQuery({
    queryKey: ["admin-pricing-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name, slug, logo_url, pricing_model").eq("is_active", true).order("name").limit(20);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch tiers for selected product
  const { data: tiers = [] } = useQuery({
    queryKey: ["admin-pricing-tiers", selectedProductId],
    enabled: !!selectedProductId,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_pricing_tiers")
        .select("*")
        .eq("product_id", selectedProductId!)
        .order("sort_order");
      return (data || []) as PricingTier[];
    },
  });

  // Fetch features for selected product
  const { data: features = [] } = useQuery({
    queryKey: ["admin-pricing-features", selectedProductId],
    enabled: !!selectedProductId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pricing_features")
        .select("*")
        .eq("product_id", selectedProductId!)
        .order("sort_order");
      return (data || []) as PricingFeature[];
    },
  });

  // Fetch tier-feature mappings
  const tierIds = tiers.map((t) => t.id);
  const { data: tierFeatures = [] } = useQuery({
    queryKey: ["admin-tier-features", tierIds],
    enabled: tierIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pricing_tier_features")
        .select("*")
        .in("tier_id", tierIds);
      return (data || []) as TierFeature[];
    },
  });

  const tierFeatureMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    tierFeatures.forEach((tf) => {
      if (!map.has(tf.tier_id)) map.set(tf.tier_id, new Set());
      map.get(tf.tier_id)!.add(tf.feature_id);
    });
    return map;
  }, [tierFeatures]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-pricing-tiers", selectedProductId] });
    queryClient.invalidateQueries({ queryKey: ["admin-pricing-features", selectedProductId] });
    queryClient.invalidateQueries({ queryKey: ["admin-tier-features"] });
  };

  // Tier mutations
  const saveTier = useMutation({
    mutationFn: async (tier: Partial<PricingTier> & { id?: string }) => {
      if (tier.id) {
        const { id, ...rest } = tier;
        const { error } = await supabase.from("product_pricing_tiers").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const payload = { ...tier, product_id: selectedProductId! };
        const { error } = await supabase.from("product_pricing_tiers").insert([payload as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Tier saved"); invalidateAll(); setTierDialog({ open: false }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_pricing_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tier deleted"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Feature mutations
  const saveFeature = useMutation({
    mutationFn: async (feature: Partial<PricingFeature> & { id?: string }) => {
      if (feature.id) {
        const { id, ...rest } = feature;
        const { error } = await supabase.from("pricing_features").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const payload = { ...feature, product_id: selectedProductId! };
        const { error } = await supabase.from("pricing_features").insert([payload as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Feature saved"); invalidateAll(); setFeatureDialog({ open: false }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFeature = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pricing_features").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Feature deleted"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle tier-feature mapping
  const toggleTierFeature = useMutation({
    mutationFn: async ({ tierId, featureId, hasIt }: { tierId: string; featureId: string; hasIt: boolean }) => {
      if (hasIt) {
        const { error } = await supabase.from("pricing_tier_features").delete().eq("tier_id", tierId).eq("feature_id", featureId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pricing_tier_features").insert({ tier_id: tierId, feature_id: featureId });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAll(),
    onError: (e: any) => toast.error(e.message),
  });

  // Migrate JSON pricing_tiers to normalized tables
  const migrateFromJson = useMutation({
    mutationFn: async (productId: string) => {
      const { data: product } = await supabase.from("products").select("pricing_tiers").eq("id", productId).single();
      const jsonTiers = Array.isArray(product?.pricing_tiers) ? product.pricing_tiers : [];
      if (jsonTiers.length === 0) throw new Error("No JSON pricing tiers to migrate");

      for (let i = 0; i < jsonTiers.length; i++) {
        const jt: any = jsonTiers[i];
        const { data: newTier, error: tierErr } = await supabase
          .from("product_pricing_tiers")
          .insert({
            product_id: productId,
            name: jt.name || `Plan ${i + 1}`,
            price: typeof jt.price === "number" ? jt.price : 0,
            period: jt.period || "month",
            description: jt.description || null,
            is_popular: !!jt.is_popular,
            sort_order: i,
            cta_label: jt.cta_label || null,
            cta_url: jt.cta_url || null,
          })
          .select("id")
          .single();
        if (tierErr) throw tierErr;

        const featureNames: string[] = Array.isArray(jt.features) ? jt.features.filter((f: any) => typeof f === "string") : [];
        for (let fi = 0; fi < featureNames.length; fi++) {
          // Check if feature already exists for this product
          let { data: existing } = await supabase
            .from("pricing_features")
            .select("id")
            .eq("product_id", productId)
            .eq("name", featureNames[fi])
            .maybeSingle();

          let featureId: string;
          if (existing) {
            featureId = existing.id;
          } else {
            const { data: newFeat, error: featErr } = await supabase
              .from("pricing_features")
              .insert({ product_id: productId, name: featureNames[fi], sort_order: fi })
              .select("id")
              .single();
            if (featErr) throw featErr;
            featureId = newFeat.id;
          }

          await supabase.from("pricing_tier_features").insert({ tier_id: newTier.id, feature_id: featureId }).select();
        }
      }
    },
    onSuccess: () => { toast.success("Migrated JSON tiers to normalized tables"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Bulk migrate ALL products with JSON pricing_tiers
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const bulkMigrate = useMutation({
    mutationFn: async () => {
      // Fetch all products that have non-empty JSON pricing_tiers
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, pricing_tiers")
        .eq("is_active", true);
      if (!allProducts) return { migrated: 0, skipped: 0, errors: 0 };

      // Filter to products with actual JSON tiers
      const candidates = allProducts.filter((p: any) => {
        const tiers = p.pricing_tiers;
        return Array.isArray(tiers) && tiers.length > 0;
      });

      // Check which already have normalized tiers
      const candidateIds = candidates.map((c: any) => c.id);
      if (candidateIds.length === 0) return { migrated: 0, skipped: 0, errors: 0 };

      const { data: existingTiers } = await supabase
        .from("product_pricing_tiers")
        .select("product_id")
        .in("product_id", candidateIds);
      const alreadyMigrated = new Set((existingTiers || []).map((t: any) => t.product_id));

      const toMigrate = candidates.filter((c: any) => !alreadyMigrated.has(c.id));
      let migrated = 0;
      let errors = 0;
      setBulkProgress({ done: 0, total: toMigrate.length, errors: 0 });

      for (const product of toMigrate) {
        try {
          const jsonTiers = product.pricing_tiers as any[];
          for (let i = 0; i < jsonTiers.length; i++) {
            const jt: any = jsonTiers[i];
            const { data: newTier, error: tierErr } = await supabase
              .from("product_pricing_tiers")
              .insert({
                product_id: product.id,
                name: jt.name || `Plan ${i + 1}`,
                price: typeof jt.price === "number" ? jt.price : 0,
                period: jt.period || "month",
                description: jt.description || null,
                is_popular: !!jt.is_popular,
                sort_order: i,
                cta_label: jt.cta_label || null,
                cta_url: jt.cta_url || null,
              })
              .select("id")
              .single();
            if (tierErr) throw tierErr;

            const featureNames: string[] = Array.isArray(jt.features)
              ? jt.features.filter((f: any) => typeof f === "string")
              : [];
            for (let fi = 0; fi < featureNames.length; fi++) {
              let { data: existing } = await supabase
                .from("pricing_features")
                .select("id")
                .eq("product_id", product.id)
                .eq("name", featureNames[fi])
                .maybeSingle();

              let featureId: string;
              if (existing) {
                featureId = existing.id;
              } else {
                const { data: newFeat, error: featErr } = await supabase
                  .from("pricing_features")
                  .insert({ product_id: product.id, name: featureNames[fi], sort_order: fi })
                  .select("id")
                  .single();
                if (featErr) throw featErr;
                featureId = newFeat.id;
              }
              await supabase.from("pricing_tier_features").insert({ tier_id: newTier!.id, feature_id: featureId });
            }
          }
          migrated++;
        } catch {
          errors++;
        }
        setBulkProgress({ done: migrated + errors, total: toMigrate.length, errors });
      }

      return { migrated, skipped: alreadyMigrated.size, errors };
    },
    onSuccess: (result) => {
      if (result) {
        toast.success(`Bulk migration complete: ${result.migrated} migrated, ${result.skipped} already done, ${result.errors} errors`);
      }
      setBulkProgress(null);
      invalidateAll();
    },
    onError: (e: any) => { toast.error(e.message); setBulkProgress(null); },
  });

  const selectedProduct = products.find((p: any) => p.id === selectedProductId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Pricing Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage pricing tiers and feature matrices for products</p>
        </div>
        <div className="flex items-center gap-2">
          {bulkProgress && (
            <span className="text-xs text-muted-foreground">
              {bulkProgress.done}/{bulkProgress.total} processed{bulkProgress.errors > 0 ? ` (${bulkProgress.errors} errors)` : ""}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => bulkMigrate.mutate()}
            disabled={bulkMigrate.isPending}
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            {bulkMigrate.isPending ? "Migrating All..." : "Bulk Migrate All JSON"}
          </Button>
        </div>
      </div>

      {/* Product Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Product</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
            {(products as any[]).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-xl text-sm text-left transition-all border",
                  selectedProductId === p.id
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="h-7 w-7 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-primary flex items-center justify-center h-full">{p.name.charAt(0)}</span>}
                </div>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedProductId && selectedProduct && (
        <Tabs defaultValue="tiers" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="tiers" className="rounded-lg font-medium gap-1.5">
                <Package className="h-3.5 w-3.5" /> Tiers ({tiers.length})
              </TabsTrigger>
              <TabsTrigger value="features" className="rounded-lg font-medium gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Features ({features.length})
              </TabsTrigger>
              <TabsTrigger value="matrix" className="rounded-lg font-medium gap-1.5">
                <Check className="h-3.5 w-3.5" /> Feature Matrix
              </TabsTrigger>
            </TabsList>
            {tiers.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => migrateFromJson.mutate(selectedProductId)}
                disabled={migrateFromJson.isPending}
                className="text-xs"
              >
                {migrateFromJson.isPending ? "Migrating..." : "Import from JSON"}
              </Button>
            )}
          </div>

          {/* Tiers Tab */}
          <TabsContent value="tiers" className="space-y-3">
            <Button size="sm" onClick={() => setTierDialog({ open: true })} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Tier
            </Button>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tiers.map((tier) => (
                <Card key={tier.id} className={cn("relative", tier.is_popular && "ring-2 ring-primary")}>
                  {tier.is_popular && <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px]">Popular</Badge>}
                  <CardContent className="pt-5">
                    <h3 className="font-bold text-foreground mb-1">{tier.name}</h3>
                    <div className="text-2xl font-display font-bold mb-2">
                      ${Number(tier.price)}<span className="text-sm font-normal text-muted-foreground">/{tier.period}</span>
                    </div>
                    {tier.description && <p className="text-xs text-muted-foreground mb-3">{tier.description}</p>}
                    <div className="text-xs text-muted-foreground mb-3">
                      {tierFeatureMap.get(tier.id)?.size || 0} features included
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setTierDialog({ open: true, tier })}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => deleteTier.mutate(tier.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-3">
            <Button size="sm" onClick={() => setFeatureDialog({ open: true })} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Feature
            </Button>
            <div className="space-y-1">
              {features.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <span className="text-sm font-medium">{f.name}</span>
                    {f.category && <Badge variant="outline" className="text-[10px]">{f.category}</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFeatureDialog({ open: true, feature: f })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteFeature.mutate(f.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {features.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No features yet. Add features to build a comparison matrix.</p>}
            </div>
          </TabsContent>

          {/* Feature Matrix Tab */}
          <TabsContent value="matrix">
            {tiers.length > 0 && features.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 min-w-[200px]">Feature</th>
                      {tiers.map((t) => (
                        <th key={t.id} className="text-center text-xs font-semibold text-muted-foreground px-4 py-3 min-w-[100px]">
                          {t.name}
                          <div className="text-[10px] font-normal">${Number(t.price)}/{t.period}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f) => (
                      <tr key={f.id} className="border-b border-border/30 hover:bg-muted/10">
                        <td className="px-4 py-2.5 text-sm font-medium">{f.name}</td>
                        {tiers.map((t) => {
                          const hasIt = tierFeatureMap.get(t.id)?.has(f.id) || false;
                          return (
                            <td key={t.id} className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => toggleTierFeature.mutate({ tierId: t.id, featureId: f.id, hasIt })}
                                className={cn(
                                  "h-7 w-7 rounded-lg inline-flex items-center justify-center transition-all",
                                  hasIt ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground/30 hover:bg-muted"
                                )}
                              >
                                {hasIt ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Add both tiers and features to configure the matrix.</p>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Tier Dialog */}
      <TierDialog
        open={tierDialog.open}
        tier={tierDialog.tier}
        onClose={() => setTierDialog({ open: false })}
        onSave={(data) => saveTier.mutate(data)}
        isPending={saveTier.isPending}
      />

      {/* Feature Dialog */}
      <FeatureDialog
        open={featureDialog.open}
        feature={featureDialog.feature}
        onClose={() => setFeatureDialog({ open: false })}
        onSave={(data) => saveFeature.mutate(data)}
        isPending={saveFeature.isPending}
      />
    </div>
  );
}

function TierDialog({ open, tier, onClose, onSave, isPending }: {
  open: boolean;
  tier?: PricingTier;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: "", price: 0, period: "month", description: "", is_popular: false, is_enterprise: false, sort_order: 0, cta_label: "", cta_url: "",
  });

  const handleOpen = () => {
    if (tier) {
      setForm({
        name: tier.name, price: Number(tier.price), period: tier.period, description: tier.description || "",
        is_popular: tier.is_popular, is_enterprise: tier.is_enterprise, sort_order: tier.sort_order,
        cta_label: tier.cta_label || "", cta_url: tier.cta_url || "",
      });
    } else {
      setForm({ name: "", price: 0, period: "month", description: "", is_popular: false, is_enterprise: false, sort_order: 0, cta_label: "", cta_url: "" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={handleOpen as any}>
        <DialogHeader>
          <DialogTitle>{tier ? "Edit Tier" : "Add Tier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Pro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Price</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period</Label>
              <Select value={form.period} onValueChange={(v) => setForm((f) => ({ ...f, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">CTA Label</Label>
              <Input value={form.cta_label} onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))} placeholder="Get Started" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CTA URL</Label>
              <Input value={form.cta_url} onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_popular} onCheckedChange={(c) => setForm((f) => ({ ...f, is_popular: c }))} />
              <Label className="text-xs">Popular</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_enterprise} onCheckedChange={(c) => setForm((f) => ({ ...f, is_enterprise: c }))} />
              <Label className="text-xs">Enterprise</Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sort Order</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ ...form, ...(tier ? { id: tier.id } : {}) })} disabled={isPending || !form.name}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeatureDialog({ open, feature, onClose, onSave, isPending }: {
  open: boolean;
  feature?: PricingFeature;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({ name: "", category: "", sort_order: 0 });

  const handleOpen = () => {
    if (feature) {
      setForm({ name: feature.name, category: feature.category || "", sort_order: feature.sort_order });
    } else {
      setForm({ name: "", category: "", sort_order: 0 });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={handleOpen as any}>
        <DialogHeader>
          <DialogTitle>{feature ? "Edit Feature" : "Add Feature"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Feature Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Unlimited projects" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category (optional)</Label>
            <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Core, Support, Security..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sort Order</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ ...form, ...(feature ? { id: feature.id } : {}) })} disabled={isPending || !form.name}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
