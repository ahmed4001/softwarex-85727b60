import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingTiersDisplay } from "@/components/PricingTiersDisplay";
import { TCOCalculator } from "@/components/TCOCalculator";
import { DollarSign, Search, X, ArrowLeftRight, Check, Minus, BarChart3 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SelectedProduct {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  pricing_model: string | null;
  starting_price: number | null;
  pricing_tiers: any;
  pricing_description: string | null;
  features: any;
}

export default function PricingComparisonPage() {
  const [searchParams] = useSearchParams();
  const initialIds = searchParams.get("products")?.split(",").filter(Boolean) || [];

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [search, setSearch] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Load initial products from URL
  useQuery({
    queryKey: ["pricing-initial", initialIds],
    enabled: initialIds.length > 0 && !initialized,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, pricing_model, starting_price, pricing_tiers, pricing_description, features")
        .in("id", initialIds)
        .eq("is_active", true);
      if (data) setSelectedProducts(data);
      setInitialized(true);
      return data;
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["pricing-search", search],
    enabled: search.length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, pricing_model, starting_price, pricing_tiers, pricing_description, features")
        .ilike("name", `%${search}%`)
        .eq("is_active", true)
        .limit(8);
      return data || [];
    },
  });

  const addProduct = (p: SelectedProduct) => {
    if (selectedProducts.length >= 4) return;
    if (selectedProducts.some((s) => s.id === p.id)) return;
    setSelectedProducts((prev) => [...prev, p]);
    setSearch("");
  };

  const removeProduct = (id: string) => setSelectedProducts((prev) => prev.filter((p) => p.id !== id));

  // Build feature matrix
  const allFeatures = Array.from(
    new Set(selectedProducts.flatMap((p) => (Array.isArray(p.features) ? p.features.filter((f: any) => typeof f === "string") : [])))
  ).sort();

  const parsedTiers = (p: SelectedProduct) => {
    const tiers = Array.isArray(p.pricing_tiers) ? p.pricing_tiers : [];
    return tiers.filter((t: any) => t && typeof t === "object" && t.name);
  };

  return (
    <>
      <SeoHead title="Compare Pricing & Plans" description="Compare software pricing plans side-by-side with feature matrices and total cost of ownership calculator." />
      <div className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-display font-bold text-foreground">Pricing & Plans Comparison</h1>
          </div>
          <p className="text-muted-foreground">Compare pricing plans, feature matrices, and total cost of ownership side-by-side</p>
        </div>

        {/* Product Picker */}
        <div className="glass-card p-6 mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {selectedProducts.map((p) => (
              <Badge key={p.id} variant="secondary" className="gap-2 py-2 px-4 rounded-xl text-sm font-medium">
                <div className="h-5 w-5 rounded-md bg-muted overflow-hidden flex-shrink-0">
                  {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-primary flex items-center justify-center h-full">{p.name.charAt(0)}</span>}
                </div>
                {p.name}
                <button onClick={() => removeProduct(p.id)} className="ml-1 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
            {selectedProducts.length < 4 && (
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Add product to compare (${selectedProducts.length}/4)...`}
                  className="pl-9"
                />
                {searchResults.length > 0 && search.length > 1 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-popover border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {searchResults
                      .filter((r: any) => !selectedProducts.some((s) => s.id === r.id))
                      .map((r: any) => (
                        <button
                          key={r.id}
                          onClick={() => addProduct(r)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors"
                        >
                          <div className="h-7 w-7 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                            {r.logo_url ? <img src={r.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-primary flex items-center justify-center h-full">{r.name.charAt(0)}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground">{r.name}</span>
                            {r.starting_price && <span className="text-xs text-muted-foreground ml-2">${r.starting_price}/mo</span>}
                          </div>
                          <Badge variant="outline" className="capitalize text-[10px]">{r.pricing_model || "N/A"}</Badge>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {selectedProducts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Search and add up to 4 products to compare their pricing</p>
          )}
        </div>

        {selectedProducts.length >= 1 && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="overview" className="rounded-lg font-medium gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Price Overview
              </TabsTrigger>
              <TabsTrigger value="features" className="rounded-lg font-medium gap-1.5">
                <Check className="h-3.5 w-3.5" /> Feature Matrix
              </TabsTrigger>
              <TabsTrigger value="tiers" className="rounded-lg font-medium gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Detailed Plans
              </TabsTrigger>
              <TabsTrigger value="tco" className="rounded-lg font-medium gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> TCO Calculator
              </TabsTrigger>
            </TabsList>

            {/* Price Overview */}
            <TabsContent value="overview">
              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5">Product</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-5 py-3.5">Pricing Model</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-5 py-3.5">Starting Price</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-5 py-3.5">Plans Available</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3.5">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map((p) => {
                      const tiers = parsedTiers(p);
                      return (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                                {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-primary flex items-center justify-center h-full">{p.name.charAt(0)}</span>}
                              </div>
                              <span className="font-semibold text-foreground">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <Badge variant="outline" className="capitalize rounded-lg">{p.pricing_model || "N/A"}</Badge>
                          </td>
                          <td className="px-5 py-4 text-center">
                            {p.starting_price ? (
                              <span className="text-lg font-display font-bold">${p.starting_price}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center text-sm text-muted-foreground">
                            {tiers.length > 0 ? `${tiers.length} plans` : "—"}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link to={`/product/${p.slug}`}>
                              <Button variant="ghost" size="sm" className="text-xs">View Product →</Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Feature Matrix */}
            <TabsContent value="features">
              {allFeatures.length > 0 ? (
                <div className="glass-card overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 min-w-[200px]">Feature</th>
                        {selectedProducts.map((p) => (
                          <th key={p.id} className="text-center text-xs font-semibold text-muted-foreground px-5 py-3.5 min-w-[120px]">
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="h-7 w-7 rounded-lg bg-muted overflow-hidden">
                                {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-primary flex items-center justify-center h-full">{p.name.charAt(0)}</span>}
                              </div>
                              <span className="truncate max-w-[100px]">{p.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allFeatures.map((feature) => (
                        <tr key={feature} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-3 text-sm text-foreground font-medium">{feature}</td>
                          {selectedProducts.map((p) => {
                            const has = Array.isArray(p.features) && p.features.includes(feature);
                            return (
                              <td key={p.id} className="px-5 py-3 text-center">
                                {has ? (
                                  <Check className="h-4.5 w-4.5 text-primary mx-auto" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="glass-card p-12 text-center text-muted-foreground">
                  No feature data available for the selected products.
                </div>
              )}
            </TabsContent>

            {/* Detailed Plans */}
            <TabsContent value="tiers" className="space-y-8">
              {selectedProducts.map((p) => (
                <div key={p.id}>
                  <PricingTiersDisplay
                    tiers={parsedTiers(p)}
                    productName={p.name}
                    pricingModel={p.pricing_model || undefined}
                    startingPrice={p.starting_price}
                    pricingDescription={p.pricing_description}
                  />
                </div>
              ))}
            </TabsContent>

            {/* TCO Calculator */}
            <TabsContent value="tco">
              <TCOCalculator products={selectedProducts} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
