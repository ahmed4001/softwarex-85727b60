import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, Loader2, Search, Download,
  Globe, ArrowRight, Rocket, SkipForward,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiscoveredProduct {
  name: string;
  slug: string;
  ph_url: string;
  tagline?: string;
  website_url?: string;
  description?: string;
  already_exists?: boolean;
}

interface ImportResult {
  name: string;
  status: "success" | "error" | "skipped";
  reason?: string;
}

const PH_TOPICS = [
  { slug: "artificial-intelligence", label: "Artificial Intelligence" },
  { slug: "developer-tools", label: "Developer Tools" },
  { slug: "saas", label: "SaaS" },
  { slug: "productivity", label: "Productivity" },
  { slug: "marketing", label: "Marketing" },
  { slug: "design-tools", label: "Design Tools" },
  { slug: "fintech", label: "Fintech" },
  { slug: "analytics", label: "Analytics" },
  { slug: "e-commerce", label: "E-Commerce" },
  { slug: "education", label: "Education" },
  { slug: "health-fitness", label: "Health & Fitness" },
  { slug: "social-media-tools", label: "Social Media Tools" },
  { slug: "web-app", label: "Web Apps" },
  { slug: "browser-extensions", label: "Browser Extensions" },
  { slug: "open-source", label: "Open Source" },
  { slug: "no-code", label: "No-Code" },
  { slug: "crypto-web3", label: "Crypto & Web3" },
  { slug: "writing-tools", label: "Writing Tools" },
];

export default function ProductHuntDiscoveryPanel() {
  const { toast } = useToast();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [discoveredProducts, setDiscoveredProducts] = useState<DiscoveredProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);

  const discoverProducts = useCallback(async (topic?: string) => {
    setIsDiscovering(true);
    setDiscoveredProducts([]);
    setSelectedProducts(new Set());
    setImportResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("discover-producthunt", {
        body: { action: "discover", topic },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.products) {
        setDiscoveredProducts(data.products);
        // Auto-select new products
        const newSlugs = data.products
          .filter((p: DiscoveredProduct) => !p.already_exists)
          .map((p: DiscoveredProduct) => p.slug);
        setSelectedProducts(new Set(newSlugs));
        toast({ title: "Discovery complete", description: `Found ${data.products.length} products` });
      }
    } catch (err: any) {
      toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
    }
    setIsDiscovering(false);
  }, [toast]);

  const handleTopicClick = (topicSlug: string) => {
    setSelectedTopic(topicSlug);
    discoverProducts(topicSlug);
  };

  const handleDiscoverDaily = () => {
    setSelectedTopic(null);
    discoverProducts();
  };

  const toggleProduct = (slug: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const selectAllNew = () => {
    const newSlugs = discoveredProducts.filter((p) => !p.already_exists).map((p) => p.slug);
    setSelectedProducts(new Set(newSlugs));
  };

  const importSelected = useCallback(async () => {
    if (selectedProducts.size === 0) return;

    setIsImporting(true);
    setImportResults([]);
    setImportProgress(0);

    const products = discoveredProducts.filter((p) => selectedProducts.has(p.slug));
    const batchSize = 5;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      setImportProgress(Math.round(((i + batchSize) / products.length) * 100));

      try {
        const { data, error } = await supabase.functions.invoke("discover-producthunt", {
          body: { action: "import", import_products: batch },
        });

        if (error) {
          const errorResults = batch.map((p) => ({ name: p.name, status: "error" as const, reason: error.message }));
          setImportResults((prev) => [...prev, ...errorResults]);
        } else if (data?.results) {
          setImportResults((prev) => [...prev, ...data.results]);
        }
      } catch (err: any) {
        const errorResults = batch.map((p) => ({ name: p.name, status: "error" as const, reason: err.message }));
        setImportResults((prev) => [...prev, ...errorResults]);
      }
    }

    setIsImporting(false);
    setImportProgress(100);
    toast({ title: "Import complete", description: `Processed ${products.length} products` });
  }, [selectedProducts, discoveredProducts, toast]);

  const newProductsCount = discoveredProducts.filter((p) => !p.already_exists).length;
  const successCount = importResults.filter((r) => r.status === "success").length;
  const errorCount = importResults.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Rocket className="h-5 w-5 text-[#DA552F]" />
                Product Hunt Discovery
              </CardTitle>
              <CardDescription>
                Scrape Product Hunt topics and daily leaderboard to discover new products.
              </CardDescription>
            </div>
            <Button onClick={handleDiscoverDaily} disabled={isDiscovering || isImporting}>
              {isDiscovering ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scraping...</>
              ) : (
                <><ArrowRight className="mr-2 h-4 w-4" /> Today's Leaderboard</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Browse by topic:</p>
          <div className="flex flex-wrap gap-2">
            {PH_TOPICS.map((t) => (
              <Button
                key={t.slug}
                variant={selectedTopic === t.slug ? "default" : "outline"}
                size="sm"
                className="text-xs h-7"
                onClick={() => handleTopicClick(t.slug)}
                disabled={isDiscovering || isImporting}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Discovered Products */}
      {discoveredProducts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {discoveredProducts.length} Products Found
                </CardTitle>
                <CardDescription>
                  {newProductsCount} new · {discoveredProducts.length - newProductsCount} already in database
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllNew}>
                  Select All New ({newProductsCount})
                </Button>
                <Button
                  size="sm"
                  onClick={importSelected}
                  disabled={isImporting || selectedProducts.size === 0}
                >
                  {isImporting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Importing...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-1.5" /> Import {selectedProducts.size}</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isImporting && (
              <div className="mb-4 space-y-1.5">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{importProgress}%</p>
              </div>
            )}

            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {discoveredProducts.map((p) => (
                  <div
                    key={p.slug}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      p.already_exists
                        ? "bg-muted/30 opacity-60"
                        : selectedProducts.has(p.slug)
                        ? "border-primary/30 bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      checked={selectedProducts.has(p.slug)}
                      onCheckedChange={() => toggleProduct(p.slug)}
                      disabled={p.already_exists}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{p.name}</span>
                        {p.already_exists && (
                          <Badge variant="secondary" className="text-[10px]">Exists</Badge>
                        )}
                      </div>
                      {p.tagline && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.tagline}</p>
                      )}
                    </div>
                    <a
                      href={p.ph_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <Globe className="h-3 w-3" /> PH
                    </a>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Results</CardTitle>
            <CardDescription>
              <span className="text-primary">{successCount} imported</span>
              {errorCount > 0 && <> · <span className="text-destructive">{errorCount} errors</span></>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-1">
                {importResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-1">
                    {r.status === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    ) : r.status === "skipped" ? (
                      <SkipForward className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                    )}
                    <span className="truncate">{r.name}</span>
                    {r.reason && <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{r.reason}</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
