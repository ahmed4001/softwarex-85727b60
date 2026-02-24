import { useState, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import G2DiscoveryPanel from "@/components/admin/G2DiscoveryPanel";
import CapterraDiscoveryPanel from "@/components/admin/CapterraDiscoveryPanel";
import ComparisonContentPanel from "@/components/admin/ComparisonContentPanel";
import ProductHuntDiscoveryPanel from "@/components/admin/ProductHuntDiscoveryPanel";
import {
  Sparkles, Package, Star, Wand2, Loader2, CheckCircle2,
  AlertCircle, Download, Trash2, ChevronDown, ChevronUp,
  Zap, Globe, Building2, Calendar, DollarSign, Layers,
  ThumbsUp, ThumbsDown, BrainCircuit, ArrowRight,
  Upload, Image, Search, RefreshCw, Rocket,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────
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

// ─── Stat Pill Component ───────────────────────────────
function StatPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

// ─── Rating Stars ──────────────────────────────────────
function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= Math.round(rating) ? "text-[hsl(var(--star))] fill-[hsl(var(--star))]" : "text-border"}`}
        />
      ))}
      <span className="ml-1 text-xs font-semibold">{rating}</span>
    </div>
  );
}

// ─── Animated Counter ──────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="font-bold text-2xl"
    >
      {value}
    </motion.span>
  );
}

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
          name: p.name, slug: p.slug, tagline: p.tagline, description: p.description,
          website_url: p.website_url, logo_url: p.logo_url, category_id: p.category_id,
          pricing_model: p.pricing_model as any, starting_price: p.starting_price,
          avg_rating: p.avg_rating, total_reviews: p.total_reviews, founded_year: p.founded_year,
          headquarters: p.headquarters, company_size: p.company_size, employee_count: p.employee_count,
          features: p.features, integrations: p.integrations, pros_summary: p.pros_summary,
          cons_summary: p.cons_summary, seo_title: p.seo_title, seo_description: p.seo_description,
          is_verified: true, is_active: true,
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

  const selectedCount = products.filter((p) => p.selected).length;

  return (
    <div className="space-y-6">
      {/* Generator Card */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-primary/10 via-accent/30 to-transparent p-1">
          <div className="bg-card rounded-[calc(var(--radius)-2px)] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BrainCircuit className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Generate from Category</h3>
                <p className="text-xs text-muted-foreground">AI discovers real software products and populates all fields</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-11 bg-background/50">
                    <SelectValue placeholder="Choose a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Count</Label>
                <Input type="number" min="1" max="20" value={count} onChange={(e) => setCount(e.target.value)} className="h-11 bg-background/50" />
              </div>
              <div className="md:col-span-4">
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!selectedCategory || generateMutation.isPending}
                  className="w-full h-11 font-semibold shadow-md"
                  size="lg"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate {count} Products
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      <AnimatePresence>
        {generateMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-8 border-dashed border-2 border-primary/20">
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Sparkles className="h-6 w-6 text-primary" />
                </motion.div>
                <div className="text-center">
                  <p className="font-semibold">AI is generating products...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Discovering real software products with accurate data
                  </p>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="h-2 w-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{products.length} Products Ready</h3>
                  <p className="text-xs text-muted-foreground">{selectedCount} selected for import</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setProducts((prev) => prev.map((p) => ({ ...p, selected: true })))}
                  className="text-xs"
                >
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setProducts([])} className="text-xs text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0}
                  className="shadow-sm"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Download className="h-4 w-4 mr-1.5" />
                  )}
                  Import {selectedCount}
                </Button>
              </div>
            </div>

            {importing && (
              <div className="space-y-1.5">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{importProgress}% complete</p>
              </div>
            )}

            {/* Product Cards */}
            <div className="space-y-3">
              {products.map((p, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={`overflow-hidden transition-all duration-200 ${p.selected ? "border-primary/30 shadow-sm" : "opacity-50 border-border/50"}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={p.selected}
                          onCheckedChange={() => toggleProduct(idx)}
                          className="mt-1"
                        />
                        <div className="h-12 w-12 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {p.logo_url ? (
                            <img src={p.logo_url} alt="" className="h-10 w-10 object-contain" />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[15px]">{p.name}</span>
                            <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider">
                              {p.pricing_model}
                            </Badge>
                            <RatingStars rating={p.avg_rating} />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{p.tagline}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {p.website_url && (
                              <a href={p.website_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline">
                                <Globe className="h-3 w-3" />
                                {new URL(p.website_url).hostname}
                              </a>
                            )}
                            {p.headquarters && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" /> {p.headquarters}
                              </span>
                            )}
                            {p.founded_year && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" /> {p.founded_year}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 h-8 w-8"
                          onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        >
                          {expandedIdx === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedIdx === idx && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0">
                            <div className="border-t border-border/50 pt-4 space-y-4">
                              {/* Stats row */}
                              <div className="flex flex-wrap gap-2">
                                <StatPill icon={DollarSign} label="Price" value={p.starting_price ? `$${p.starting_price}/mo` : "Free"} />
                                <StatPill icon={Building2} label="Size" value={p.company_size} />
                                <StatPill icon={Star} label="Reviews" value={String(p.total_reviews)} />
                              </div>

                              {/* Features */}
                              {p.features?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Features</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {p.features.map((f, i) => (
                                      <Badge key={i} variant="outline" className="text-[11px] font-normal bg-muted/30">
                                        {f}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Pros & Cons */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {p.pros_summary && (
                                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                                      <span className="text-xs font-semibold text-primary">Pros</span>
                                    </div>
                                    <p className="text-xs text-foreground/80 leading-relaxed">{p.pros_summary}</p>
                                  </div>
                                )}
                                {p.cons_summary && (
                                  <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <ThumbsDown className="h-3.5 w-3.5 text-destructive" />
                                      <span className="text-xs font-semibold text-destructive">Cons</span>
                                    </div>
                                    <p className="text-xs text-foreground/80 leading-relaxed">{p.cons_summary}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {products.length === 0 && !generateMutation.isPending && (
        <Card className="p-12 border-dashed border-2">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Package className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground">No products generated yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Select a category above and click generate to discover real software products
              </p>
            </div>
          </div>
        </Card>
      )}
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

  // Bulk review state
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkInserted, setBulkInserted] = useState(0);
  const [bulkProcessed, setBulkProcessed] = useState(0);
  const [bulkRemaining, setBulkRemaining] = useState(0);
  const [bulkLog, setBulkLog] = useState<string[]>([]);
  const bulkCancelRef = useRef(false);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-for-reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, avg_rating, category_id, categories!products_category_id_fkey(name)")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
  });

  const { data: reviewStats = { total: 0, withReviews: 0, withoutReviews: 0 }, refetch: refetchStats } = useQuery({
    queryKey: ["admin-review-stats"],
    queryFn: async () => {
      const { count: total } = await supabase.from("reviews").select("*", { count: "exact", head: true });
      const { count: productCount } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true);
      const { count: withReviews } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true).gt("total_reviews", 0);
      return {
        total: total || 0,
        withReviews: withReviews || 0,
        withoutReviews: (productCount || 0) - (withReviews || 0),
      };
    },
  });

  const addBulkLog = (msg: string) => setBulkLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200));

  const startBulkReviews = async () => {
    bulkCancelRef.current = false;
    setBulkRunning(true);
    setBulkInserted(0);
    setBulkProcessed(0);
    setBulkLog([]);

    addBulkLog(`Starting bulk review generation for all products without reviews...`);

    let totalInserted = 0;
    let totalProcessed = 0;

    while (!bulkCancelRef.current) {
      try {
        const { data, error } = await supabase.functions.invoke("bulk-generate-reviews", {
          body: { batch_size: 2, reviews_per_product: 5 },
        });

        if (error) {
          addBulkLog(`❌ Error: ${error.message}`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        if (data) {
          totalInserted += data.inserted || 0;
          totalProcessed += data.products_processed || 0;
          setBulkInserted(totalInserted);
          setBulkProcessed(totalProcessed);
          setBulkRemaining(data.remaining || 0);
          addBulkLog(`✅ +${data.inserted} reviews for ${data.products_processed} products (${data.remaining} remaining)`);

          if ((data.remaining || 0) <= 0) {
            addBulkLog(`🎉 All products now have reviews!`);
            break;
          }
        }
      } catch (e: any) {
        addBulkLog(`❌ Network error: ${e.message}`);
        await new Promise(r => setTimeout(r, 3000));
      }

      // Small delay between batches
      await new Promise(r => setTimeout(r, 1000));
    }

    setBulkRunning(false);
    refetchStats();
    toast({
      title: bulkCancelRef.current ? "Review generation stopped" : "Bulk review generation complete!",
      description: `Added ${totalInserted} reviews across ${totalProcessed} products.`,
    });
  };

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

  const selectedCount = reviews.filter((r) => r.selected).length;

  return (
    <div className="space-y-6">
      {/* Bulk Review Generator */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-[hsl(var(--star))]/10 via-accent/20 to-transparent p-1">
          <div className="bg-card rounded-[calc(var(--radius)-2px)] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-[hsl(var(--star))]/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-[hsl(var(--star))]" />
              </div>
              <div>
                <h3 className="font-semibold">Bulk Generate Reviews</h3>
                <p className="text-xs text-muted-foreground">Auto-generate 5 reviews for every product that has none</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <AnimatedNumber value={reviewStats.total} />
                <p className="text-xs text-muted-foreground mt-1">Total Reviews</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <AnimatedNumber value={reviewStats.withReviews} />
                <p className="text-xs text-muted-foreground mt-1">Products with Reviews</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <AnimatedNumber value={reviewStats.withoutReviews} />
                <p className="text-xs text-muted-foreground mt-1">Need Reviews</p>
              </div>
            </div>

            <div className="flex items-end gap-4">
              {!bulkRunning ? (
                <Button
                  onClick={startBulkReviews}
                  disabled={reviewStats.withoutReviews === 0}
                  className="h-11 px-8 font-semibold shadow-md"
                  size="lg"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Reviews for {reviewStats.withoutReviews} Products
                </Button>
              ) : (
                <Button
                  onClick={() => { bulkCancelRef.current = true; }}
                  variant="destructive"
                  className="h-11 px-8"
                  size="lg"
                >
                  Stop Generation
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {(bulkRunning || bulkInserted > 0) && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Bulk Review Progress</h3>
              {bulkRunning && (
                <p className="text-sm text-muted-foreground">
                  Generating reviews... <span className="text-foreground font-medium">{bulkRemaining} products remaining</span>
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <StatPill icon={Star} label="Reviews" value={bulkInserted.toLocaleString()} />
              <StatPill icon={Package} label="Products" value={bulkProcessed.toLocaleString()} />
            </div>
          </div>
          {reviewStats.withoutReviews > 0 && (
            <>
              <Progress value={Math.round(((reviewStats.withoutReviews - bulkRemaining) / reviewStats.withoutReviews) * 100)} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {Math.round(((reviewStats.withoutReviews - bulkRemaining) / reviewStats.withoutReviews) * 100)}% complete
              </p>
            </>
          )}
          {bulkLog.length > 0 && (
            <div className="bg-muted/30 border border-border/50 rounded-lg p-3 max-h-48 overflow-auto">
              <div className="space-y-1">
                {bulkLog.map((entry, i) => (
                  <p key={i} className="text-xs font-mono text-muted-foreground">{entry}</p>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Single Product Generator */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-[hsl(var(--star))]/10 via-accent/20 to-transparent p-1">
          <div className="bg-card rounded-[calc(var(--radius)-2px)] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-[hsl(var(--star))]/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-[hsl(var(--star))]" />
              </div>
              <div>
                <h3 className="font-semibold">Generate Reviews for Single Product</h3>
                <p className="text-xs text-muted-foreground">AI creates realistic, varied reviews for any product</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="h-11 bg-background/50">
                    <SelectValue placeholder="Choose a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Count</Label>
                <Input type="number" min="1" max="20" value={reviewCount} onChange={(e) => setReviewCount(e.target.value)} className="h-11 bg-background/50" />
              </div>
              <div className="md:col-span-4">
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!selectedProduct || generateMutation.isPending}
                  className="w-full h-11 font-semibold shadow-md"
                  size="lg"
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
                  ) : (
                    <><Star className="h-4 w-4 mr-2" /> Generate {reviewCount} Reviews</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Loading */}
      <AnimatePresence>
        {generateMutation.isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="p-8 border-dashed border-2 border-[hsl(var(--star))]/20">
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="h-12 w-12 rounded-full bg-[hsl(var(--star))]/10 flex items-center justify-center"
                >
                  <Star className="h-6 w-6 text-[hsl(var(--star))]" />
                </motion.div>
                <p className="font-semibold">Generating realistic reviews...</p>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="h-2 w-2 rounded-full bg-[hsl(var(--star))]"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews list */}
      <AnimatePresence>
        {reviews.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[hsl(var(--star))]/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{reviews.length} Reviews Ready</h3>
                  <p className="text-xs text-muted-foreground">{selectedCount} selected</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => setReviews([])}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard
                </Button>
                <Button size="sm" onClick={handleImport} disabled={importing || selectedCount === 0} className="shadow-sm">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                  Import {selectedCount}
                </Button>
              </div>
            </div>

            {importing && (
              <div className="space-y-1.5">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{importProgress}%</p>
              </div>
            )}

            <div className="space-y-3">
              {reviews.map((r, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card className={`p-4 transition-all duration-200 ${r.selected ? "border-primary/30 shadow-sm" : "opacity-50"}`}>
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={r.selected}
                        onCheckedChange={() => setReviews((prev) => prev.map((rv, i) => (i === idx ? { ...rv, selected: !rv.selected } : rv)))}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">{r.title}</span>
                          <RatingStars rating={r.overall_rating} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <span className="font-medium">{r.reviewer_role}</span>
                          <span>·</span>
                          <span>{r.industry}</span>
                          <span>·</span>
                          <span>{r.company_size}</span>
                          <span>·</span>
                          <span>{r.usage_duration}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{r.body}</p>
                        <div className="flex gap-4 mt-2">
                          <div className="flex items-center gap-1 text-xs">
                            <Zap className="h-3 w-3 text-primary" />
                            <span>Ease: {r.ease_of_use}/5</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <DollarSign className="h-3 w-3 text-primary" />
                            <span>Value: {r.value_for_money}/5</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <Layers className="h-3 w-3 text-primary" />
                            <span>Features: {r.features_rating}/5</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {reviews.length === 0 && !generateMutation.isPending && !bulkRunning && bulkInserted === 0 && (
        <Card className="p-12 border-dashed border-2">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Star className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="font-medium text-muted-foreground">No reviews generated yet</p>
            <p className="text-sm text-muted-foreground/70">Use bulk generation or select a product for individual reviews</p>
          </div>
        </Card>
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
        .select("id, name, slug, website_url, description, features, logo_url, tagline, pricing_model, avg_rating, category_id, categories!products_category_id_fkey(name)")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
  });

  const needsEnrichment = products.filter(
    (p) => !p.description || !p.features || (Array.isArray(p.features) && p.features.length === 0) || !p.tagline
  );
  const enrichedCount = products.length - needsEnrichment.length;
  const enrichPercent = products.length > 0 ? Math.round((enrichedCount / products.length) * 100) : 0;

  const enrichSingle = async (product: any): Promise<{ ok: boolean; rateLimited?: boolean }> => {
    setEnriching(product.id);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-products", {
        body: {
          action: "enrich_product",
          payload: {
            product: {
              name: product.name, category: (product as any).categories?.name || "Software",
              website_url: product.website_url, description: product.description,
              features: product.features, tagline: product.tagline, pricing_model: product.pricing_model,
            },
          },
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const enrichment = data.enrichment;
      const updatePayload: any = {};
      const fields = ["description", "tagline", "features", "integrations", "pros_summary", "cons_summary",
        "logo_url", "seo_title", "seo_description", "founded_year", "headquarters", "company_size", "pricing_model", "starting_price"];
      for (const f of fields) { if (enrichment[f]) updatePayload[f] = enrichment[f]; }

      await supabase.from("products").update(updatePayload).eq("id", product.id);
      queryClient.invalidateQueries({ queryKey: ["admin-products-to-enrich"] });
      toast({ title: "Enriched", description: `${product.name} updated.` });
      return { ok: true };
    } catch (e: any) {
      const message = e?.message || "Unknown error";
      const isRateLimited = /rate limit|429/i.test(message);
      toast({
        title: isRateLimited ? "Rate limited" : "Enrichment failed",
        description: isRateLimited
          ? "AI provider is rate limiting requests. Slowing down and pausing bulk enrichment."
          : message,
        variant: "destructive",
      });
      return { ok: false, rateLimited: isRateLimited };
    } finally {
      setEnriching(null);
    }
  };

  const enrichAll = async () => {
    setBulkEnriching(true);
    setEnrichProgress(0);
    const delayMs = 2500;

    for (let i = 0; i < needsEnrichment.length; i++) {
      const result = await enrichSingle(needsEnrichment[i]);
      setEnrichProgress(Math.round(((i + 1) / needsEnrichment.length) * 100));

      if (result.rateLimited) {
        break;
      }

      if (i < needsEnrichment.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    setBulkEnriching(false);
    toast({ title: "Bulk enrichment run finished" });
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-accent/40 via-primary/5 to-transparent p-1">
          <div className="bg-card rounded-[calc(var(--radius)-2px)] p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Data Enrichment</h3>
                  <p className="text-xs text-muted-foreground">AI fills missing descriptions, features, taglines & more</p>
                </div>
              </div>
              <Button
                onClick={enrichAll}
                disabled={bulkEnriching || needsEnrichment.length === 0}
                className="shadow-md"
              >
                {bulkEnriching ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enriching...</>
                ) : (
                  <><Wand2 className="h-4 w-4 mr-2" /> Enrich All ({needsEnrichment.length})</>
                )}
              </Button>
            </div>

            {/* Progress overview */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-xl bg-muted/30">
                <AnimatedNumber value={products.length} />
                <p className="text-xs text-muted-foreground mt-1">Total Products</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-primary/5">
                <AnimatedNumber value={enrichedCount} />
                <p className="text-xs text-muted-foreground mt-1">Enriched</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-destructive/5">
                <AnimatedNumber value={needsEnrichment.length} />
                <p className="text-xs text-muted-foreground mt-1">Needs Work</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Enrichment progress</span>
                <span className="font-semibold">{enrichPercent}%</span>
              </div>
              <Progress value={enrichPercent} className="h-2.5" />
            </div>

            {bulkEnriching && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Batch progress</span>
                  <span className="font-semibold">{enrichProgress}%</span>
                </div>
                <Progress value={enrichProgress} className="h-2" />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Product list */}
      <div className="space-y-2">
        {needsEnrichment.map((p, idx) => {
          const missing: string[] = [];
          if (!p.description) missing.push("description");
          if (!p.features || (Array.isArray(p.features) && p.features.length === 0)) missing.push("features");
          if (!p.tagline) missing.push("tagline");
          if (!p.logo_url) missing.push("logo");

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
            >
              <Card className="p-4 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt="" className="h-8 w-8 object-contain" />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">{p.name?.[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{p.name}</span>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {missing.map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px] text-destructive/80 border-destructive/20 bg-destructive/5">
                          <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => enrichSingle(p)}
                    disabled={enriching === p.id || bulkEnriching}
                    className="gap-1.5"
                  >
                    {enriching === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Enrich</span>
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}

        {needsEnrichment.length === 0 && !isLoading && (
          <Card className="p-12 border-dashed border-2">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <p className="font-semibold">All products fully enriched!</p>
              <p className="text-sm text-muted-foreground">Every product has complete data. Nice work.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Scrape Real Data Tab ──────────────────────────────
function ScrapeRealDataTab() {
  const [source, setSource] = useState<"g2" | "capterra">("g2");

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-blue-500/10 via-accent/20 to-transparent p-1">
          <div className="bg-card rounded-[calc(var(--radius)-2px)] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Scrape Real Products</h3>
                <p className="text-xs text-muted-foreground">Discover and import real software from G2 & Capterra review sites</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={source === "g2" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSource("g2")}
                  className="gap-1.5"
                >
                  <Globe className="h-3.5 w-3.5" /> G2
                </Button>
                <Button
                  variant={source === "capterra" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSource("capterra")}
                  className="gap-1.5"
                >
                  <Globe className="h-3.5 w-3.5" /> Capterra
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
      {source === "g2" ? <G2DiscoveryPanel /> : <CapterraDiscoveryPanel />}
    </div>
  );
}

// ─── Upload Images Tab ─────────────────────────────────
function UploadImagesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [uploading, setUploading] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-for-images"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, website_url")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
  });

  const productsWithoutLogos = products.filter((p) => !p.logo_url);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logos/${selectedProduct}-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type });
      
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      await supabase
        .from("products")
        .update({ logo_url: urlData.publicUrl })
        .eq("id", selectedProduct);

      queryClient.invalidateQueries({ queryKey: ["admin-products-for-images"] });
      toast({ title: "Logo uploaded", description: "Product logo has been updated." });
      setSelectedProduct("");
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const autoFetchLogos = async () => {
    setAutoFetching(true);
    setFetchProgress(0);
    let updated = 0;

    for (let i = 0; i < productsWithoutLogos.length; i++) {
      const p = productsWithoutLogos[i];
      if (p.website_url) {
        try {
          const domain = new URL(p.website_url).hostname.replace("www.", "");
          const logoUrl = `https://logo.clearbit.com/${domain}`;
          
          // Test if logo exists
          const res = await fetch(logoUrl, { method: "HEAD" });
          if (res.ok) {
            await supabase
              .from("products")
              .update({ logo_url: logoUrl })
              .eq("id", p.id);
            updated++;
          }
        } catch {
          // Skip failed fetches
        }
      }
      setFetchProgress(Math.round(((i + 1) / productsWithoutLogos.length) * 100));
    }

    setAutoFetching(false);
    queryClient.invalidateQueries({ queryKey: ["admin-products-for-images"] });
    toast({ title: "Auto-fetch complete", description: `Updated ${updated} product logos.` });
  };

  return (
    <div className="space-y-6">
      {/* Manual Upload Card */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-violet-500/10 via-accent/20 to-transparent p-1">
          <div className="bg-card rounded-[calc(var(--radius)-2px)] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Upload className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold">Upload Product Logo</h3>
                <p className="text-xs text-muted-foreground">Manually upload a logo image for any product</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="h-11 bg-background/50">
                    <SelectValue placeholder="Choose a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          {p.logo_url ? (
                            <img src={p.logo_url} alt="" className="h-4 w-4 rounded object-contain" />
                          ) : (
                            <div className="h-4 w-4 rounded bg-muted flex items-center justify-center">
                              <Image className="h-2.5 w-2.5 text-muted-foreground" />
                            </div>
                          )}
                          {p.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Logo Image</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={!selectedProduct || uploading}
                  className="h-11 bg-background/50"
                />
              </div>
              <div className="md:col-span-3">
                {uploading && (
                  <div className="flex items-center gap-2 h-11 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Auto-fetch Logos Card */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-emerald-500/10 via-accent/20 to-transparent p-1">
          <div className="bg-card rounded-[calc(var(--radius)-2px)] p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Auto-Fetch Logos</h3>
                  <p className="text-xs text-muted-foreground">
                    Automatically grab logos from product websites using Clearbit
                  </p>
                </div>
              </div>
              <Button
                onClick={autoFetchLogos}
                disabled={autoFetching || productsWithoutLogos.length === 0}
                className="shadow-md"
              >
                {autoFetching ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Fetching...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" /> Fetch {productsWithoutLogos.length} Logos</>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-xl bg-muted/30">
                <span className="font-bold text-2xl">{products.length}</span>
                <p className="text-xs text-muted-foreground mt-1">Total Products</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-primary/5">
                <span className="font-bold text-2xl">{products.length - productsWithoutLogos.length}</span>
                <p className="text-xs text-muted-foreground mt-1">Have Logos</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-destructive/5">
                <span className="font-bold text-2xl">{productsWithoutLogos.length}</span>
                <p className="text-xs text-muted-foreground mt-1">Missing Logos</p>
              </div>
            </div>

            {autoFetching && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fetching logos...</span>
                  <span className="font-semibold">{fetchProgress}%</span>
                </div>
                <Progress value={fetchProgress} className="h-2" />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Products missing logos */}
      {productsWithoutLogos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Products Missing Logos ({productsWithoutLogos.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {productsWithoutLogos.slice(0, 20).map((p) => (
              <Card key={p.id} className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Image className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <span className="text-xs font-medium truncate">{p.name}</span>
              </Card>
            ))}
            {productsWithoutLogos.length > 20 && (
              <Card className="p-3 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">+{productsWithoutLogos.length - 20} more</span>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Generate Tab ─────────────────────────────────
function BulkGenerateTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [totalInserted, setTotalInserted] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [currentCategory, setCurrentCategory] = useState("");
  const [categoryProgress, setCategoryProgress] = useState(0);
  const [targetCount, setTargetCount] = useState("5000");
  const cancelRef = useRef(false);
  const [log, setLog] = useState<string[]>([]);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name, slug").order("name");
      return data || [];
    },
  });

  const { data: productCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ["admin-product-count"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));

  const startBulkGenerate = async () => {
    cancelRef.current = false;
    setIsRunning(true);
    setTotalInserted(0);
    setTotalSkipped(0);
    setTotalErrors(0);
    setLog([]);

    const target = parseInt(targetCount);
    const batchSize = 25;
    const batchesPerCategory = Math.ceil(target / categories.length / batchSize);

    addLog(`Starting bulk generation: target ${target} products across ${categories.length} categories`);

    let totalDone = 0;

    for (let catIdx = 0; catIdx < categories.length; catIdx++) {
      if (cancelRef.current) break;

      const cat = categories[catIdx];
      setCurrentCategory(cat.name);
      setCategoryProgress(Math.round(((catIdx + 1) / categories.length) * 100));
      addLog(`Processing: ${cat.name} (${catIdx + 1}/${categories.length})`);

      for (let batch = 0; batch < batchesPerCategory; batch++) {
        if (cancelRef.current) break;
        if (totalDone >= target) break;

        try {
          const { data, error } = await supabase.functions.invoke("bulk-generate-products", {
            body: {
              category_id: cat.id,
              category_name: cat.name,
              batch_size: batchSize,
              offset: batch * batchSize,
            },
          });

          if (error) {
            addLog(`❌ Error in ${cat.name} batch ${batch + 1}: ${error.message}`);
            setTotalErrors(prev => prev + batchSize);
            continue;
          }

          if (data) {
            setTotalInserted(prev => prev + (data.inserted || 0));
            setTotalSkipped(prev => prev + (data.skipped || 0));
            setTotalErrors(prev => prev + (data.errors || 0));
            totalDone += data.inserted || 0;
            addLog(`✅ ${cat.name}: +${data.inserted} inserted, ${data.skipped} skipped`);
          }
        } catch (e: any) {
          addLog(`❌ Network error: ${e.message}`);
          setTotalErrors(prev => prev + 1);
        }

        // Small delay between batches
        await new Promise(r => setTimeout(r, 500));
      }

      if (totalDone >= target) {
        addLog(`🎉 Target reached: ${totalDone} products generated!`);
        break;
      }
    }

    setIsRunning(false);
    setCategoryProgress(100);
    refetchCount();
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    toast({
      title: cancelRef.current ? "Generation stopped" : "Bulk generation complete!",
      description: `Added ${totalDone} products to the database.`,
    });
  };

  const remaining = Math.max(0, parseInt(targetCount) - productCount);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-primary/10 via-accent/30 to-transparent p-1">
          <div className="bg-card rounded-[calc(var(--radius)-2px)] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Bulk Product Generator</h3>
                <p className="text-xs text-muted-foreground">
                  Generate thousands of real software products using AI across all categories
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <AnimatedNumber value={productCount} />
                <p className="text-xs text-muted-foreground mt-1">Current Products</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <AnimatedNumber value={totalInserted} />
                <p className="text-xs text-muted-foreground mt-1">Added This Session</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <AnimatedNumber value={remaining} />
                <p className="text-xs text-muted-foreground mt-1">Remaining to Target</p>
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Total Products</Label>
                <Input
                  type="number"
                  value={targetCount}
                  onChange={e => setTargetCount(e.target.value)}
                  className="h-11 bg-background/50"
                  disabled={isRunning}
                />
              </div>
              {!isRunning ? (
                <Button
                  onClick={startBulkGenerate}
                  disabled={categories.length === 0}
                  className="h-11 px-8 font-semibold shadow-md"
                  size="lg"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Generate {remaining.toLocaleString()} Products
                </Button>
              ) : (
                <Button
                  onClick={() => { cancelRef.current = true; }}
                  variant="destructive"
                  className="h-11 px-8"
                  size="lg"
                >
                  Stop Generation
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {(isRunning || totalInserted > 0) && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Progress</h3>
              {isRunning && currentCategory && (
                <p className="text-sm text-muted-foreground">
                  Processing: <span className="text-foreground font-medium">{currentCategory}</span>
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <StatPill icon={CheckCircle2} label="Inserted" value={totalInserted.toLocaleString()} />
              <StatPill icon={AlertCircle} label="Skipped" value={totalSkipped.toLocaleString()} />
            </div>
          </div>
          <Progress value={categoryProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{categoryProgress}% of categories processed</p>

          {log.length > 0 && (
            <div className="bg-muted/30 border border-border/50 rounded-lg p-3 max-h-48 overflow-auto">
              <div className="space-y-1">
                {log.map((entry, i) => (
                  <p key={i} className="text-xs font-mono text-muted-foreground">{entry}</p>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function AdminAIImportPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-start gap-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0"
        >
          <Sparkles className="h-6 w-6 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Product Data Generator</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Generate, scrape, enrich, and import real software product data
          </p>
        </div>
      </div>

      {/* Source badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card">
          <BrainCircuit className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs">Lovable AI</span>
        </Badge>
        <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card">
          <Search className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-xs">G2 & Capterra</span>
        </Badge>
        <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card">
          <Rocket className="h-3.5 w-3.5 text-[#DA552F]" />
          <span className="text-xs">Product Hunt</span>
        </Badge>
        <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card">
          <Globe className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs">Clearbit Logos</span>
        </Badge>
        <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card">
          <Upload className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-xs">Manual Upload</span>
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bulk" className="w-full">
        <TabsList className="bg-card border border-border/50 p-1 h-auto rounded-xl shadow-sm flex-wrap">
          <TabsTrigger
            value="bulk"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:shadow-sm text-sm"
          >
            <Zap className="h-4 w-4" /> Bulk Generate
          </TabsTrigger>
          <TabsTrigger
            value="generate"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:shadow-sm text-sm"
          >
            <Package className="h-4 w-4" /> AI Generate
          </TabsTrigger>
          <TabsTrigger
            value="scrape"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:shadow-sm text-sm"
          >
            <Search className="h-4 w-4" /> Scrape Real Data
          </TabsTrigger>
          <TabsTrigger
            value="reviews"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:shadow-sm text-sm"
          >
            <Star className="h-4 w-4" /> Reviews
          </TabsTrigger>
          <TabsTrigger
            value="images"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:shadow-sm text-sm"
          >
            <Image className="h-4 w-4" /> Images & Logos
          </TabsTrigger>
          <TabsTrigger
            value="enrich"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:shadow-sm text-sm"
          >
            <Wand2 className="h-4 w-4" /> Enrich
          </TabsTrigger>
          <TabsTrigger
            value="comparisons"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:shadow-sm text-sm"
          >
            <Layers className="h-4 w-4" /> Comparisons
          </TabsTrigger>
          <TabsTrigger
            value="producthunt"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:shadow-sm text-sm"
          >
            <Rocket className="h-4 w-4" /> Product Hunt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk" className="mt-6">
          <BulkGenerateTab />
        </TabsContent>
        <TabsContent value="generate" className="mt-6">
          <GenerateProductsTab />
        </TabsContent>
        <TabsContent value="scrape" className="mt-6">
          <ScrapeRealDataTab />
        </TabsContent>
        <TabsContent value="reviews" className="mt-6">
          <GenerateReviewsTab />
        </TabsContent>
        <TabsContent value="images" className="mt-6">
          <UploadImagesTab />
        </TabsContent>
        <TabsContent value="enrich" className="mt-6">
          <EnrichProductsTab />
        </TabsContent>
        <TabsContent value="producthunt" className="mt-6">
          <ProductHuntDiscoveryPanel />
        </TabsContent>
        <TabsContent value="comparisons" className="mt-6">
          <ComparisonContentPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
