import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProductLogo } from "@/components/ProductLogo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Plus, Search, X } from "lucide-react";

interface PricingComparisonWidgetProps {
  currentProduct: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    pricing_model: string | null;
    starting_price: number | null;
    pricing_tiers: any;
  };
}

interface ComparedProduct {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  pricing_model: string | null;
  starting_price: number | null;
  pricing_tiers: any;
}

export function PricingComparisonWidget({ currentProduct }: PricingComparisonWidgetProps) {
  const [selectedProducts, setSelectedProducts] = useState<ComparedProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch alternatives for quick-add chips
  const { data: alternatives = [] } = useQuery({
    queryKey: ["widget-alternatives", currentProduct.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("alternatives")
        .select("*, alternative:products!alternatives_alternative_product_id_fkey(id, name, slug, logo_url, pricing_model, starting_price, pricing_tiers)")
        .eq("product_id", currentProduct.id)
        .order("similarity_score", { ascending: false })
        .limit(3);
      return (data || []).filter((a: any) => a.alternative);
    },
  });

  // Search products
  const { data: searchResults = [] } = useQuery({
    queryKey: ["widget-search", searchQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, pricing_model, starting_price, pricing_tiers")
        .ilike("name", `%${searchQuery}%`)
        .neq("id", currentProduct.id)
        .eq("is_active", true)
        .limit(5);
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch tier counts for all products in the comparison
  const allProductIds = [currentProduct.id, ...selectedProducts.map((p) => p.id)];
  const { data: tierCounts = {} } = useQuery({
    queryKey: ["widget-tier-counts", allProductIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_pricing_tiers")
        .select("product_id")
        .in("product_id", allProductIds);
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.product_id] = (counts[row.product_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Close search on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addProduct = useCallback((product: ComparedProduct) => {
    if (selectedProducts.length >= 3) return;
    if (selectedProducts.some((p) => p.id === product.id)) return;
    setSelectedProducts((prev) => [...prev, product]);
    setSearchQuery("");
    setIsSearchOpen(false);
  }, [selectedProducts]);

  const removeProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const getTierCount = (product: ComparedProduct) => {
    const normalized = tierCounts[product.id];
    if (normalized && normalized > 0) return normalized;
    const jsonTiers = Array.isArray(product.pricing_tiers) ? product.pricing_tiers.filter((t: any) => t && typeof t === "object" && t.name) : [];
    return jsonTiers.length || 0;
  };

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return "—";
    if (price === 0) return "Free";
    return `$${price}/mo`;
  };

  const allComparedProducts = [currentProduct, ...selectedProducts];
  const compareUrl = `/compare-pricing?products=${allComparedProducts.map((p) => p.id).join(",")}`;

  // Filter alternatives not already selected
  const availableAlternatives = alternatives.filter(
    (a: any) => !selectedProducts.some((p) => p.id === a.alternative.id)
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          Compare Pricing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick-add chips + Search */}
        <div className="flex flex-wrap items-center gap-2">
          {availableAlternatives.length > 0 && selectedProducts.length < 3 && (
            <>
              <span className="text-xs text-muted-foreground font-medium">Quick add:</span>
              {availableAlternatives.slice(0, 3 - selectedProducts.length).map((a: any) => (
                <Button
                  key={a.alternative.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-lg gap-1.5"
                  onClick={() => addProduct(a.alternative)}
                >
                  <Plus className="h-3 w-3" />
                  {a.alternative.name}
                </Button>
              ))}
            </>
          )}

          {selectedProducts.length < 3 && (
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => searchQuery.length >= 2 && setIsSearchOpen(true)}
                  placeholder="Search products..."
                  className="h-7 w-48 pl-8 text-xs rounded-lg"
                />
              </div>
              {isSearchOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-lg shadow-lg border border-border z-50 overflow-hidden">
                  {searchResults
                    .filter((r: any) => !selectedProducts.some((p) => p.id === r.id))
                    .map((r: any) => (
                      <button
                        key={r.id}
                        onClick={() => addProduct(r)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <ProductLogo name={r.name} logoUrl={r.logo_url} size="sm" />
                        <span className="text-xs font-medium truncate">{r.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected product chips */}
        {selectedProducts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedProducts.map((p) => (
              <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                {p.name}
                <button onClick={() => removeProduct(p.id)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Comparison table */}
        {allComparedProducts.length > 1 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28 text-xs" />
                  {allComparedProducts.map((p) => (
                    <TableHead key={p.id} className="text-center text-xs min-w-[100px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <ProductLogo name={p.name} logoUrl={p.logo_url} size="sm" />
                        <span className="font-semibold truncate max-w-[90px]">{p.name}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-medium text-muted-foreground">Model</TableCell>
                  {allComparedProducts.map((p) => (
                    <TableCell key={p.id} className="text-center text-xs capitalize">
                      {p.pricing_model || "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium text-muted-foreground">Starting Price</TableCell>
                  {allComparedProducts.map((p) => (
                    <TableCell key={p.id} className="text-center text-xs font-semibold">
                      {formatPrice(p.starting_price)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium text-muted-foreground">Plans</TableCell>
                  {allComparedProducts.map((p) => (
                    <TableCell key={p.id} className="text-center text-xs">
                      {getTierCount(p) || "—"}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty state */}
        {allComparedProducts.length === 1 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            Add products above to see a side-by-side pricing comparison.
          </p>
        )}

        {/* CTA */}
        <div className="text-center pt-1">
          <Link to={compareUrl}>
            <Button variant="outline" size="sm" className="rounded-xl gap-2 text-xs font-semibold">
              Compare in Detail <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
