import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { seedProducts, popularComparisons, type SeedProduct } from "@/lib/seed-products";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, SkipForward, Loader2, Play, Zap, BarChart3, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import G2DiscoveryPanel from "@/components/admin/G2DiscoveryPanel";

interface ScrapeResult {
  name: string;
  status: "success" | "error" | "skipped";
  reason?: string;
}

const BATCH_SIZE = 3;

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
          <TabsTrigger value="seed" className="gap-2">
            <Play className="h-4 w-4" /> Seed List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discovery">
          <G2DiscoveryPanel />
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
