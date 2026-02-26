import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { seedProducts, popularComparisons, type SeedProduct } from "@/lib/seed-products";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, SkipForward, Loader2, Play, Zap, BarChart3, Globe, BookOpen, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import G2DiscoveryPanel from "@/components/admin/G2DiscoveryPanel";
import CapterraDiscoveryPanel from "@/components/admin/CapterraDiscoveryPanel";

interface ScrapeResult {
  name: string;
  status: "success" | "error" | "skipped";
  reason?: string;
}

const BATCH_SIZE = 3;

function BulkAIGeneratePanel() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [genLog, setGenLog] = useState<{ cat: string; inserted: number; skipped: number; errors: number }[]>([]);
  const [currentCat, setCurrentCat] = useState("");
  const [progress, setProgress] = useState(0);
  const [batchSize, setBatchSize] = useState(50);

  const { data: categories } = useQuery({
    queryKey: ["all-categories-for-gen"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name, slug, product_count").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const totalInserted = genLog.reduce((s, l) => s + l.inserted, 0);

  const generateForCategory = async (catId: string, catName: string) => {
    setCurrentCat(catName);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-generate-products", {
        body: { category_id: catId, category_name: catName, batch_size: batchSize, offset: 0 },
      });
      if (error) {
        setGenLog((prev) => [...prev, { cat: catName, inserted: 0, skipped: 0, errors: 1 }]);
      } else if (data) {
        setGenLog((prev) => [...prev, { cat: catName, inserted: data.inserted || 0, skipped: data.skipped || 0, errors: data.errors || 0 }]);
      }
    } catch {
      setGenLog((prev) => [...prev, { cat: catName, inserted: 0, skipped: 0, errors: 1 }]);
    }
  };

  const generateAll = async () => {
    if (!categories?.length) return;
    setIsGenerating(true);
    setGenLog([]);
    setProgress(0);
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      setProgress(((i + 1) / categories.length) * 100);
      await generateForCategory(cat.id, cat.name);
    }
    setCurrentCat("");
    setIsGenerating(false);
    toast({ title: "Bulk generation complete", description: `Generated products across ${categories.length} categories.` });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Bulk Product Discovery</CardTitle>
          <CardDescription>
            Discover real software products via G2, Capterra & web scraping across all {categories?.length || 0} categories. Each batch discovers up to ~{batchSize} real products per category.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Products per category:</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm bg-background"
              disabled={isGenerating}
            >
              <option value={25}>25</option>
              <option value={50}>50 (recommended)</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-muted-foreground">
              ≈ {(categories?.length || 0) * batchSize} total products
            </span>
          </div>

          <div className="flex gap-3">
            <Button onClick={generateAll} disabled={isGenerating} size="lg">
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating... {Math.round(progress)}%</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Generate All ({categories?.length || 0} categories)</>
              )}
            </Button>
          </div>

          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">Processing: <strong>{currentCat}</strong></p>
            </div>
          )}

          {genLog.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <Badge variant="default">{totalInserted} inserted</Badge>
                <Badge variant="secondary">{genLog.reduce((s, l) => s + l.skipped, 0)} skipped</Badge>
                <Badge variant="destructive">{genLog.reduce((s, l) => s + l.errors, 0)} errors</Badge>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {genLog.map((l, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-medium">{l.cat}</span>
                    <div className="flex gap-2">
                      <span className="text-green-600">+{l.inserted}</span>
                      {l.skipped > 0 && <span className="text-amber-600">~{l.skipped}</span>}
                      {l.errors > 0 && <span className="text-destructive">✕{l.errors}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categories ({categories?.length || 0})</CardTitle>
          <CardDescription>Click any category to generate products individually.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {categories?.map((cat) => (
              <Button
                key={cat.id}
                variant="outline"
                size="sm"
                className="justify-between"
                disabled={isGenerating}
                onClick={() => generateForCategory(cat.id, cat.name)}
              >
                <span className="truncate">{cat.name}</span>
                <Badge variant="secondary" className="ml-2 text-xs">{cat.product_count || 0}</Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminSeedPage() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isCreatingComparisons, setIsCreatingComparisons] = useState(false);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [currentProduct, setCurrentProduct] = useState("");
  const [scrapingCategory, setScrapingCategory] = useState<string | null>(null);

  const totalProducts = seedProducts.length;
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const progress = totalBatches > 0 ? (currentBatch / totalBatches) * 100 : 0;

  const categorySlugs = [...new Set(seedProducts.map((p) => p.category_slug))];

  const runScrape = useCallback(async (productsToScrape: SeedProduct[], label?: string) => {
    setIsRunning(true);
    setResults([]);
    setCurrentBatch(0);
    setScrapingCategory(label || null);

    const batches: SeedProduct[][] = [];
    for (let i = 0; i < productsToScrape.length; i += BATCH_SIZE) {
      batches.push(productsToScrape.slice(i, i + BATCH_SIZE));
    }
    setTotalBatches(batches.length);

    for (let i = 0; i < batches.length; i++) {
      setCurrentBatch(i + 1);
      const batch = batches[i];
      setCurrentProduct(batch.map((p) => p.name).join(", "));

      try {
        const { data, error } = await supabase.functions.invoke("scrape-products", {
          body: { products: batch },
        });

        if (error) {
          const errorResults = batch.map((p) => ({
            name: p.name,
            status: "error" as const,
            reason: error.message,
          }));
          setResults((prev) => [...prev, ...errorResults]);
        } else if (data?.results) {
          setResults((prev) => [...prev, ...data.results]);
        }
      } catch (err) {
        const errorResults = batch.map((p) => ({
          name: p.name,
          status: "error" as const,
          reason: err instanceof Error ? err.message : "Network error",
        }));
        setResults((prev) => [...prev, ...errorResults]);
      }
    }

    setIsRunning(false);
    setCurrentProduct("");
    setScrapingCategory(null);
    toast({ title: "Scraping complete", description: label ? `${label} done.` : "All products processed." });
  }, [toast]);

  const startScraping = useCallback(() => runScrape(seedProducts), [runScrape]);

  const scrapeCategory = useCallback((slug: string) => {
    const catProducts = seedProducts.filter((p) => p.category_slug === slug);
    runScrape(catProducts, slug);
  }, [runScrape]);

  const createComparisons = useCallback(async () => {
    setIsCreatingComparisons(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-products", {
        body: { action: "create_comparisons", products: popularComparisons, comparisons: popularComparisons },
      });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        const successCount = data?.results?.filter((r: any) => r.status === "success").length || 0;
        toast({ title: "Comparisons created", description: `${successCount} comparisons added.` });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create comparisons", variant: "destructive" });
    }
    setIsCreatingComparisons(false);
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Seed Products Database</h1>
        <p className="text-muted-foreground mt-1">
          Populate your database with real product data from G2 and product websites.
        </p>
      </div>

      <Tabs defaultValue="discovery" className="space-y-6">
        <TabsList>
          <TabsTrigger value="discovery" className="gap-2">
            <Globe className="h-4 w-4" /> G2 Discovery
          </TabsTrigger>
          <TabsTrigger value="capterra" className="gap-2">
            <BookOpen className="h-4 w-4" /> Capterra Discovery
          </TabsTrigger>
          <TabsTrigger value="bulk-ai" className="gap-2">
            <Sparkles className="h-4 w-4" /> Bulk AI Generate
          </TabsTrigger>
          <TabsTrigger value="seed" className="gap-2">
            <Play className="h-4 w-4" /> Seed List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discovery">
          <G2DiscoveryPanel />
        </TabsContent>

        <TabsContent value="capterra">
          <CapterraDiscoveryPanel />
        </TabsContent>

        <TabsContent value="bulk-ai">
          <BulkAIGeneratePanel />
        </TabsContent>

        <TabsContent value="seed" className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-foreground">{totalProducts}</div>
            <div className="text-sm text-muted-foreground">Total Products</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{successCount}</div>
            <div className="text-sm text-muted-foreground">Scraped</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{skippedCount}</div>
            <div className="text-sm text-muted-foreground">Skipped</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-destructive">{errorCount}</div>
            <div className="text-sm text-muted-foreground">Errors</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Button onClick={startScraping} disabled={isRunning} size="lg">
          {isRunning && !scrapingCategory ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping All... Batch {currentBatch}/{totalBatches}
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Scrape All ({totalProducts} products)
            </>
          )}
        </Button>
        <Button
          onClick={createComparisons}
          disabled={isCreatingComparisons || isRunning}
          variant="secondary"
          size="lg"
        >
          {isCreatingComparisons ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Create Comparisons ({popularComparisons.length})
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      {isRunning && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {currentProduct && (
              <p className="text-sm text-muted-foreground">
                Currently processing: <span className="font-medium text-foreground">{currentProduct}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Results
            </CardTitle>
            <CardDescription>
              {successCount} scraped, {skippedCount} skipped, {errorCount} errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                    {r.status === "skipped" && <SkipForward className="h-4 w-4 text-amber-600" />}
                    <span className="font-medium">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={r.status === "success" ? "default" : r.status === "skipped" ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {r.status}
                    </Badge>
                    {r.reason && (
                      <span className="text-xs text-muted-foreground max-w-48 truncate">{r.reason}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product catalog preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Catalog ({totalProducts} products across {categorySlugs.length} categories)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categorySlugs.map((slug) => {
              const catProducts = seedProducts.filter((p) => p.category_slug === slug);
              const isScraping = isRunning && scrapingCategory === slug;
              return (
                <div key={slug} className="border rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-foreground">{slug}</div>
                    <Badge variant="secondary" className="text-xs">{catProducts.length}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex-1">
                    {catProducts.map((p) => p.name).join(", ")}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1"
                    disabled={isRunning}
                    onClick={() => scrapeCategory(slug)}
                  >
                    {isScraping ? (
                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Scraping...</>
                    ) : (
                      <><Play className="mr-1 h-3 w-3" /> Scrape {catProducts.length} products</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
