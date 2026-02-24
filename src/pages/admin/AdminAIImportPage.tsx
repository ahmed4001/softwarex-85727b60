import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Package, Star, Wand2, Loader2, CheckCircle2,
  AlertCircle, Download, Trash2, Eye, ChevronDown, ChevronUp,
} from "lucide-react";

type GeneratedProduct = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  website_url: string;
  logo_url: string | null;
  category: string;
  category_id: string | null;
  pricing_model: string;
  starting_price: number | null;
  avg_rating: number;
  total_reviews: number;
  founded_year: number;
  headquarters: string;
  company_size: string;
  employee_count: number;
  features: string[];
  integrations: string[];
  pros_summary: string;
  cons_summary: string;
  seo_title: string;
  seo_description: string;
  is_verified: boolean;
  is_featured: boolean;
  is_active: boolean;
  selected?: boolean;
};

type GeneratedReview = {
  overall_rating: number;
  ease_of_use: number;
  customer_support: number;
  value_for_money: number;
  features_rating: number;
  title: string;
  pros: string;
  cons: string;
  body: string;
  reviewer_role: string;
  company_size: string;
  industry: string;
  usage_duration: string;
  use_case: string;
  recommendation_likelihood: number;
  selected?: boolean;
};

// ─── Generate Products Tab ─────────────────────────────
function GenerateProductsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [count, setCount] = useState("5");
  const [products, setProducts] = useState<GeneratedProduct[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name, slug").order("name");
      return data || [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const cat = categories.find((c) => c.id === selectedCategory);
      if (!cat) throw new Error("Select a category");
      const { data, error } = await supabase.functions.invoke("ai-generate-products", {
        body: { action: "generate_category", payload: { category: cat.name, count: parseInt(count), categoryId: cat.id } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.products as GeneratedProduct[];
    },
    onSuccess: (data) => {
      setProducts(data.map((p) => ({ ...p, selected: true })));
      toast({ title: "Generated!", description: `${data.length} products generated successfully.` });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const handleImport = async () => {
    const selected = products.filter((p) => p.selected !== false);
    if (!selected.length) return;
    setImporting(true);
    setImportProgress(0);
    let imported = 0;

    for (const p of selected) {
      const { error } = await supabase.from("products").upsert(
        {
          name: p.name,
          slug: p.slug,
          tagline: p.tagline,
          description: p.description,
          website_url: p.website_url,
          logo_url: p.logo_url,
          category_id: p.category_id,
          pricing_model: p.pricing_model as any,
          starting_price: p.starting_price,
          avg_rating: p.avg_rating,
          total_reviews: p.total_reviews,
          founded_year: p.founded_year,
          headquarters: p.headquarters,
          company_size: p.company_size,
          employee_count: p.employee_count,
          features: p.features,
          integrations: p.integrations,
          pros_summary: p.pros_summary,
          cons_summary: p.cons_summary,
          seo_title: p.seo_title,
          seo_description: p.seo_description,
          is_verified: true,
          is_active: true,
        },
        { onConflict: "slug" }
      );
      if (error) console.error("Import error for", p.name, error);
      imported++;
      setImportProgress(Math.round((imported / selected.length) * 100));
    }

    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    toast({ title: "Import complete", description: `${imported} products imported.` });
    setProducts([]);
  };

  const toggleProduct = (idx: number) => {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)));
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Number of products</Label>
            <Input type="number" min="1" max="20" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => generateMutation.mutate()} disabled={!selectedCategory || generateMutation.isPending} className="w-full">
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate Products
            </Button>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {products.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{products.length} Products Generated</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setProducts((prev) => prev.map((p) => ({ ...p, selected: true })))}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setProducts([])}>
                  <Trash2 className="h-4 w-4 mr-1" /> Clear
                </Button>
                <Button size="sm" onClick={handleImport} disabled={importing || !products.some((p) => p.selected)}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Import {products.filter((p) => p.selected).length} Selected
                </Button>
              </div>
            </div>

            {importing && <Progress value={importProgress} className="h-2" />}

            <div className="space-y-2">
              {products.map((p, idx) => (
                <Card key={idx} className={`p-4 transition-all ${p.selected ? "border-primary/40 bg-primary/5" : "opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={p.selected} onChange={() => toggleProduct(idx)} className="mt-1.5 h-4 w-4 accent-primary" />
                    {p.logo_url && <img src={p.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-muted p-1 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.name}</span>
                        <Badge variant="secondary" className="text-xs">{p.pricing_model}</Badge>
                        <Badge variant="outline" className="text-xs">⭐ {p.avg_rating}</Badge>
                        {p.website_url && (
                          <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary">
                            {new URL(p.website_url).hostname}
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{p.tagline}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}>
                      {expandedIdx === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  <AnimatePresence>
                    {expandedIdx === idx && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 gap-4 text-sm">
                          <div><span className="text-muted-foreground">HQ:</span> {p.headquarters}</div>
                          <div><span className="text-muted-foreground">Founded:</span> {p.founded_year}</div>
                          <div><span className="text-muted-foreground">Company size:</span> {p.company_size}</div>
                          <div><span className="text-muted-foreground">Price:</span> {p.starting_price ? `$${p.starting_price}/mo` : "Free"}</div>
                          <div className="col-span-2"><span className="text-muted-foreground">Features:</span> {p.features?.join(", ")}</div>
                          <div className="col-span-2"><span className="text-muted-foreground">Pros:</span> {p.pros_summary}</div>
                          <div className="col-span-2"><span className="text-muted-foreground">Cons:</span> {p.cons_summary}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Generate Reviews Tab ──────────────────────────────
function GenerateReviewsTab() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [reviewCount, setReviewCount] = useState("5");
  const [reviews, setReviews] = useState<GeneratedReview[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-for-reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, avg_rating, category_id, categories(name)")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const prod = products.find((p) => p.id === selectedProduct);
      if (!prod) throw new Error("Select a product");
      const categoryName = (prod as any).categories?.name || "Software";
      const { data, error } = await supabase.functions.invoke("ai-generate-products", {
        body: {
          action: "generate_reviews",
          payload: {
            product_name: prod.name,
            product_category: categoryName,
            count: parseInt(reviewCount),
            avg_rating: prod.avg_rating || 4.2,
          },
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.reviews as GeneratedReview[];
    },
    onSuccess: (data) => {
      setReviews(data.map((r) => ({ ...r, selected: true })));
      toast({ title: "Reviews generated!", description: `${data.length} reviews ready to import.` });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const handleImport = async () => {
    const selected = reviews.filter((r) => r.selected !== false);
    if (!selected.length) return;
    setImporting(true);
    setImportProgress(0);
    let imported = 0;

    // We need a dummy user_id for AI-generated reviews. Use a system user approach.
    // For now we'll use the current user's ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ title: "Must be logged in", variant: "destructive" }); setImporting(false); return; }

    for (const r of selected) {
      const { error } = await supabase.from("reviews").insert({
        product_id: selectedProduct,
        user_id: user.id,
        overall_rating: r.overall_rating,
        ease_of_use: r.ease_of_use,
        customer_support: r.customer_support,
        value_for_money: r.value_for_money,
        features_rating: r.features_rating,
        title: r.title,
        pros: r.pros,
        cons: r.cons,
        body: r.body,
        reviewer_role: r.reviewer_role,
        company_size: r.company_size,
        industry: r.industry,
        usage_duration: r.usage_duration,
        use_case: r.use_case,
        recommendation_likelihood: r.recommendation_likelihood,
        verified_reviewer: true,
        status: "approved" as any,
        source: "imported" as any,
      });
      if (error) console.error("Review import error:", error);
      imported++;
      setImportProgress(Math.round((imported / selected.length) * 100));
    }

    setImporting(false);
    toast({ title: "Reviews imported", description: `${imported} reviews added.` });
    setReviews([]);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Number of reviews</Label>
            <Input type="number" min="1" max="20" value={reviewCount} onChange={(e) => setReviewCount(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => generateMutation.mutate()} disabled={!selectedProduct || generateMutation.isPending} className="w-full">
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
              Generate Reviews
            </Button>
          </div>
        </div>
      </Card>

      {reviews.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{reviews.length} Reviews Generated</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setReviews([])}>
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                Import {reviews.filter((r) => r.selected).length}
              </Button>
            </div>
          </div>
          {importing && <Progress value={importProgress} className="h-2" />}
          <div className="space-y-2">
            {reviews.map((r, idx) => (
              <Card key={idx} className={`p-4 ${r.selected ? "border-primary/40 bg-primary/5" : "opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() => setReviews((prev) => prev.map((rv, i) => (i === idx ? { ...rv, selected: !rv.selected } : rv)))}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.title}</span>
                      <Badge variant="outline">{"⭐".repeat(r.overall_rating)}</Badge>
                      <span className="text-xs text-muted-foreground">{r.reviewer_role} · {r.industry}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Enrich Products Tab ───────────────────────────────
function EnrichProductsTab() {
  const { toast } = useToast();
  const [enriching, setEnriching] = useState<string | null>(null);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products-to-enrich"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, website_url, description, features, logo_url, tagline, pricing_model, avg_rating, category_id, categories(name)")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
  });

  const needsEnrichment = products.filter(
    (p) => !p.description || !p.features || (Array.isArray(p.features) && p.features.length === 0) || !p.tagline
  );

  const enrichSingle = async (product: any) => {
    setEnriching(product.id);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-products", {
        body: {
          action: "enrich_product",
          payload: {
            product: {
              name: product.name,
              category: (product as any).categories?.name || "Software",
              website_url: product.website_url,
              description: product.description,
              features: product.features,
              tagline: product.tagline,
              pricing_model: product.pricing_model,
            },
          },
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const enrichment = data.enrichment;
      const updatePayload: any = {};
      if (enrichment.description) updatePayload.description = enrichment.description;
      if (enrichment.tagline) updatePayload.tagline = enrichment.tagline;
      if (enrichment.features) updatePayload.features = enrichment.features;
      if (enrichment.integrations) updatePayload.integrations = enrichment.integrations;
      if (enrichment.pros_summary) updatePayload.pros_summary = enrichment.pros_summary;
      if (enrichment.cons_summary) updatePayload.cons_summary = enrichment.cons_summary;
      if (enrichment.logo_url) updatePayload.logo_url = enrichment.logo_url;
      if (enrichment.seo_title) updatePayload.seo_title = enrichment.seo_title;
      if (enrichment.seo_description) updatePayload.seo_description = enrichment.seo_description;
      if (enrichment.founded_year) updatePayload.founded_year = enrichment.founded_year;
      if (enrichment.headquarters) updatePayload.headquarters = enrichment.headquarters;
      if (enrichment.company_size) updatePayload.company_size = enrichment.company_size;
      if (enrichment.pricing_model) updatePayload.pricing_model = enrichment.pricing_model;
      if (enrichment.starting_price) updatePayload.starting_price = enrichment.starting_price;

      await supabase.from("products").update(updatePayload).eq("id", product.id);
      queryClient.invalidateQueries({ queryKey: ["admin-products-to-enrich"] });
      toast({ title: "Enriched", description: `${product.name} updated successfully.` });
    } catch (e: any) {
      toast({ title: "Enrichment failed", description: e.message, variant: "destructive" });
    } finally {
      setEnriching(null);
    }
  };

  const enrichAll = async () => {
    setBulkEnriching(true);
    setEnrichProgress(0);
    for (let i = 0; i < needsEnrichment.length; i++) {
      await enrichSingle(needsEnrichment[i]);
      setEnrichProgress(Math.round(((i + 1) / needsEnrichment.length) * 100));
    }
    setBulkEnriching(false);
    toast({ title: "Bulk enrichment complete" });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{needsEnrichment.length} products need enrichment</h3>
            <p className="text-sm text-muted-foreground">Missing descriptions, features, or taglines</p>
          </div>
          <Button onClick={enrichAll} disabled={bulkEnriching || needsEnrichment.length === 0}>
            {bulkEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Enrich All ({needsEnrichment.length})
          </Button>
        </div>
        {bulkEnriching && <Progress value={enrichProgress} className="h-2 mb-4" />}
      </Card>

      <div className="space-y-2">
        {needsEnrichment.map((p) => {
          const missing: string[] = [];
          if (!p.description) missing.push("description");
          if (!p.features || (Array.isArray(p.features) && p.features.length === 0)) missing.push("features");
          if (!p.tagline) missing.push("tagline");
          if (!p.logo_url) missing.push("logo");

          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-center gap-3">
                {p.logo_url ? (
                  <img src={p.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain bg-muted p-0.5" />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {p.name?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {missing.map((m) => (
                      <Badge key={m} variant="outline" className="text-xs text-destructive border-destructive/30">
                        <AlertCircle className="h-3 w-3 mr-1" /> {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => enrichSingle(p)}
                  disabled={enriching === p.id || bulkEnriching}
                >
                  {enriching === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                </Button>
              </div>
            </Card>
          );
        })}
        {needsEnrichment.length === 0 && !isLoading && (
          <Card className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-3" />
            <p className="font-medium">All products are fully enriched!</p>
            <p className="text-sm text-muted-foreground mt-1">No products need additional data.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function AdminAIImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">AI Product Data Generator</h1>
        <p className="text-muted-foreground mt-1">
          Generate, enrich, and import real software product data using AI + Clearbit logos
        </p>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="generate" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" /> Products
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex items-center gap-1.5">
            <Star className="h-4 w-4" /> Reviews
          </TabsTrigger>
          <TabsTrigger value="enrich" className="flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Enrich
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate"><GenerateProductsTab /></TabsContent>
        <TabsContent value="reviews"><GenerateReviewsTab /></TabsContent>
        <TabsContent value="enrich"><EnrichProductsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
