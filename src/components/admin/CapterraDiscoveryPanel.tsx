import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, SkipForward, Loader2, Search, Download,
  ChevronRight, Globe, Star, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiscoveredProduct {
  name: string;
  slug: string;
  capterra_url: string;
  capterra_slug: string;
  rating?: number;
  review_count?: number;
  description?: string;
  already_exists?: boolean;
}

interface ImportResult {
  name: string;
  status: "success" | "error" | "skipped";
  reason?: string;
}

const CAPTERRA_CATEGORY_MAP: Record<string, string> = {
  "project-management": "project-management-software",
  "crm": "customer-relationship-management-software",
  "communication": "business-instant-messaging-software",
  "ecommerce": "e-commerce-software",
  "analytics": "business-analytics-software",
  "marketing": "marketing-automation-software",
  "help-desk": "help-desk-software",
  "hr": "human-resource-software",
  "accounting": "accounting-software",
  "seo": "seo-software",
  "social-media": "social-media-management-software",
  "cms": "content-management-software",
  "development": "integrated-development-environment-software",
  "security": "endpoint-protection-software",
  "collaboration": "collaboration-software",
  "lms": "learning-management-system-software",
  "time-tracking": "time-tracking-software",
  "video-conferencing": "video-conferencing-software",
  "email-marketing": "email-marketing-software",
  "live-chat": "live-chat-software",
  "no-code": "no-code-platform-software",
  "ai-writing": "ai-writing-software",
  "ai-chatbots": "chatbot-software",
  "ai-code": "ai-code-generation-software",
  "ai-image-generators": "ai-art-generator-software",
  "cloud-hosting": "cloud-management-software",
  "database-management": "database-management-software",
  "ci-cd": "continuous-integration-software",
  "bug-tracking": "bug-tracking-software",
  "api-management": "api-management-software",
  "erp": "erp-software",
  "payroll": "payroll-software",
  "recruitment": "recruiting-software",
  "employee-engagement": "employee-engagement-software",
  "expense-management": "expense-report-software",
  "contract-management": "contract-management-software",
  "e-signature": "electronic-signature-software",
  "document-management": "document-management-software",
  "survey": "survey-software",
  "webinar": "webinar-software",
  "graphic-design": "graphic-design-software",
  "data-visualization": "data-visualization-software",
  "business-intelligence": "business-intelligence-software",
  "inventory-management": "inventory-management-software",
  "invoicing": "invoicing-software",
  "lead-generation": "lead-generation-software",
  "sales-engagement": "sales-enablement-software",
  "sales-intelligence": "sales-intelligence-software",
  "customer-success": "customer-success-software",
  "password-management": "password-manager-software",
  "antivirus": "antivirus-software",
  "vpn": "vpn-software",
  "backup": "backup-software",
  "supply-chain": "supply-chain-management-software",
  "tax": "tax-software",
  "text-to-speech": "text-to-speech-software",
  "proposal": "proposal-software",
};

const CATEGORY_LABELS: Record<string, string> = {
  "project-management": "Project Management",
  "crm": "CRM Software",
  "communication": "Communication",
  "ecommerce": "E-Commerce",
  "analytics": "Analytics & BI",
  "marketing": "Marketing Automation",
  "help-desk": "Help Desk",
  "hr": "HR Software",
  "accounting": "Accounting",
  "seo": "SEO Tools",
  "social-media": "Social Media",
  "cms": "CMS",
  "development": "Developer Tools",
  "security": "Cybersecurity",
  "collaboration": "Collaboration",
  "lms": "LMS",
  "time-tracking": "Time Tracking",
  "video-conferencing": "Video Conferencing",
  "email-marketing": "Email Marketing",
  "live-chat": "Live Chat",
  "no-code": "No-Code",
  "ai-writing": "AI Writing",
  "ai-chatbots": "AI Chatbots",
  "ai-code": "AI Code",
  "ai-image-generators": "AI Image Gen",
  "cloud-hosting": "Cloud Hosting",
  "database-management": "Database",
  "ci-cd": "CI/CD",
  "bug-tracking": "Bug Tracking",
  "api-management": "API Management",
  "erp": "ERP",
  "payroll": "Payroll",
  "recruitment": "Recruitment",
  "employee-engagement": "Employee Engagement",
  "expense-management": "Expense Management",
  "contract-management": "Contract Management",
  "e-signature": "E-Signature",
  "document-management": "Document Management",
  "survey": "Survey",
  "webinar": "Webinar",
  "graphic-design": "Graphic Design",
  "data-visualization": "Data Visualization",
  "business-intelligence": "Business Intelligence",
  "inventory-management": "Inventory Management",
  "invoicing": "Invoicing",
  "lead-generation": "Lead Generation",
  "sales-engagement": "Sales Engagement",
  "sales-intelligence": "Sales Intelligence",
  "customer-success": "Customer Success",
  "password-management": "Password Management",
  "antivirus": "Antivirus",
  "vpn": "VPN",
  "backup": "Backup",
  "supply-chain": "Supply Chain",
  "tax": "Tax",
  "text-to-speech": "Text to Speech",
  "proposal": "Proposal",
};

export default function CapterraDiscoveryPanel() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [discoveredProducts, setDiscoveredProducts] = useState<DiscoveredProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [quickImportMode, setQuickImportMode] = useState(true);

  // Auto-discover state
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoCurrentCategory, setAutoCurrentCategory] = useState<string | null>(null);
  const [autoCategoryIndex, setAutoCategoryIndex] = useState(0);
  const [autoTotalImported, setAutoTotalImported] = useState(0);
  const [autoTotalSkipped, setAutoTotalSkipped] = useState(0);
  const [autoTotalErrors, setAutoTotalErrors] = useState(0);
  const [autoCategoryResults, setAutoCategoryResults] = useState<Array<{ slug: string; imported: number; skipped: number; errors: number }>>([]);
  const autoCancelRef = useRef(false);

  const MAX_RETRIES = 2;

  const invokeWithRetry = useCallback(async (body: any, retries = MAX_RETRIES): Promise<{ data: any; error: any }> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("discover-capterra", { body });
        if (!error) return { data, error: null };
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return { data: null, error };
      } catch (err) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return { data: null, error: err };
      }
    }
    return { data: null, error: new Error("Max retries exceeded") };
  }, []);

  const categoryEntries = Object.entries(CAPTERRA_CATEGORY_MAP).sort((a, b) =>
    (CATEGORY_LABELS[a[0]] || a[0]).localeCompare(CATEGORY_LABELS[b[0]] || b[0])
  );

  const discoverProducts = useCallback(async (catSlug: string, page: number) => {
    setIsDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-capterra", {
        body: { action: "discover", category_slug: catSlug, page },
      });

      if (error) {
        toast({ title: "Discovery failed", description: error.message, variant: "destructive" });
        return;
      }

      if (data?.products) {
        if (page === 1) {
          setDiscoveredProducts(data.products);
        } else {
          setDiscoveredProducts((prev) => [...prev, ...data.products]);
        }
        setHasNextPage(data.has_next_page ?? false);
        setTotalProducts(data.total_products || 0);
        setCurrentPage(page);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to discover products", variant: "destructive" });
    }
    setIsDiscovering(false);
  }, [toast]);

  const handleSelectCategory = useCallback((slug: string) => {
    setSelectedCategory(slug);
    setDiscoveredProducts([]);
    setSelectedProducts(new Set());
    setImportResults([]);
    setCurrentPage(1);
    discoverProducts(slug, 1);
  }, [discoverProducts]);

  const toggleProduct = (slug: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const selectAllNew = () => {
    const newProducts = discoveredProducts.filter((p) => !p.already_exists).map((p) => p.slug);
    setSelectedProducts(new Set(newProducts));
  };

  const importSelected = useCallback(async () => {
    if (!selectedCategory || selectedProducts.size === 0) return;

    setIsImporting(true);
    setImportResults([]);
    setImportProgress(0);

    const products = discoveredProducts.filter((p) => selectedProducts.has(p.slug));
    const batchSize = quickImportMode ? 10 : 3;
    const batches: DiscoveredProduct[][] = [];
    for (let i = 0; i < products.length; i += batchSize) {
      batches.push(products.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      setImportProgress(((i + 1) / batches.length) * 100);

      const { data, error } = await invokeWithRetry({
        action: "import",
        category_slug: selectedCategory,
        import_products: batches[i],
        quick_import: quickImportMode,
      });

      if (error) {
        const errorResults = batches[i].map((p) => ({ name: p.name, status: "error" as const, reason: error.message || "Network error" }));
        setImportResults((prev) => [...prev, ...errorResults]);
      } else if (data?.results) {
        setImportResults((prev) => [...prev, ...data.results]);
      }
    }

    setIsImporting(false);
    toast({ title: "Import complete", description: `Processed ${products.length} products.` });
  }, [selectedCategory, selectedProducts, discoveredProducts, toast, quickImportMode, invokeWithRetry]);

  const autoDiscoverAll = useCallback(async () => {
    autoCancelRef.current = false;
    setIsAutoRunning(true);
    setAutoTotalImported(0);
    setAutoTotalSkipped(0);
    setAutoTotalErrors(0);
    setAutoCategoryResults([]);

    const allSlugs = categoryEntries.map(([slug]) => slug);

    for (let i = 0; i < allSlugs.length; i++) {
      if (autoCancelRef.current) break;

      const catSlug = allSlugs[i];
      setAutoCategoryIndex(i + 1);
      setAutoCurrentCategory(catSlug);

      let discovered: DiscoveredProduct[] = [];
      const maxPages = 10;
      for (let page = 1; page <= maxPages; page++) {
        if (autoCancelRef.current) break;
        try {
          const { data, error } = await invokeWithRetry({
            action: "discover", category_slug: catSlug, page,
          });
          if (!error && data?.products) {
            const newOnes = data.products.filter((p: any) => !p.already_exists);
            discovered.push(...newOnes);
          }
          if (!data?.has_next_page) break;
        } catch {
          break;
        }
      }

      if (autoCancelRef.current) break;

      if (discovered.length === 0) {
        setAutoCategoryResults((prev) => [...prev, { slug: catSlug, imported: 0, skipped: 0, errors: 0 }]);
        continue;
      }

      let catImported = 0, catSkipped = 0, catErrors = 0;
      const batchSize = quickImportMode ? 10 : 3;
      for (let j = 0; j < discovered.length; j += batchSize) {
        if (autoCancelRef.current) break;
        const batch = discovered.slice(j, j + batchSize);
        const { data, error } = await invokeWithRetry({
          action: "import",
          category_slug: catSlug,
          import_products: batch,
          quick_import: quickImportMode,
        });
        if (!error && data?.results) {
          for (const r of data.results) {
            if (r.status === "success") catImported++;
            else if (r.status === "skipped") catSkipped++;
            else catErrors++;
          }
        } else {
          catErrors += batch.length;
        }
      }

      setAutoTotalImported((prev) => prev + catImported);
      setAutoTotalSkipped((prev) => prev + catSkipped);
      setAutoTotalErrors((prev) => prev + catErrors);
      setAutoCategoryResults((prev) => [...prev, { slug: catSlug, imported: catImported, skipped: catSkipped, errors: catErrors }]);
    }

    setIsAutoRunning(false);
    setAutoCurrentCategory(null);
    const wasCancelled = autoCancelRef.current;
    toast({ title: wasCancelled ? "Auto-discovery stopped" : "Auto-discovery complete", description: wasCancelled ? "Stopped by user." : "All categories have been processed." });
  }, [categoryEntries, toast, quickImportMode, invokeWithRetry]);

  const cancelAutoDiscover = useCallback(() => {
    autoCancelRef.current = true;
  }, []);

  const newProductsCount = discoveredProducts.filter((p) => !p.already_exists).length;
  const successCount = importResults.filter((r) => r.status === "success").length;
  const errorCount = importResults.filter((r) => r.status === "error").length;
  const autoProgress = categoryEntries.length > 0 ? (autoCategoryIndex / categoryEntries.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Auto-discover all */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Capterra Product Discovery
              </CardTitle>
              <CardDescription>
                Crawl Capterra category pages to discover and import software products automatically.
              </CardDescription>
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  id="quick-import"
                  checked={quickImportMode}
                  onCheckedChange={(v) => setQuickImportMode(v === true)}
                />
                <label htmlFor="quick-import" className="text-sm text-muted-foreground cursor-pointer">
                  Quick Import (skip per-product scraping — faster, fewer errors, uses discovered data only)
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="lg"
                onClick={autoDiscoverAll}
                disabled={isAutoRunning || isDiscovering || isImporting}
              >
                {isAutoRunning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Discovering {autoCategoryIndex}/{categoryEntries.length}...</>
                ) : (
                  <><ArrowRight className="mr-2 h-4 w-4" /> Auto-Discover All ({categoryEntries.length} categories)</>
                )}
              </Button>
              {isAutoRunning && (
                <Button size="lg" variant="destructive" onClick={cancelAutoDiscover}>
                  <XCircle className="mr-2 h-4 w-4" /> Stop
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {isAutoRunning && (
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Processing: <span className="font-medium text-foreground">{CATEGORY_LABELS[autoCurrentCategory || ""] || autoCurrentCategory}</span>
              </span>
              <span className="font-medium">{Math.round(autoProgress)}%</span>
            </div>
            <Progress value={autoProgress} className="h-2" />
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 dark:text-green-400">{autoTotalImported} imported</span>
              <span className="text-muted-foreground">{autoTotalSkipped} skipped</span>
              <span className="text-destructive">{autoTotalErrors} errors</span>
            </div>
          </CardContent>
        )}
        {!isAutoRunning && autoCategoryResults.length > 0 && (
          <CardContent>
            <div className="text-sm mb-3 font-medium">
              Completed: {autoTotalImported} imported, {autoTotalSkipped} skipped, {autoTotalErrors} errors
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {autoCategoryResults.map((r) => (
                  <div key={r.slug} className="flex items-center justify-between py-1 px-2 rounded text-sm hover:bg-muted/50">
                    <span className="font-medium">{CATEGORY_LABELS[r.slug] || r.slug}</span>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="text-green-600 dark:text-green-400">{r.imported} new</span>
                      <span>{r.skipped} skipped</span>
                      {r.errors > 0 && <span className="text-destructive">{r.errors} errors</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        )}
      </Card>

      {/* Category selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Or discover by category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categoryEntries.map(([slug]) => (
              <Button
                key={slug}
                size="sm"
                variant={selectedCategory === slug ? "default" : autoCurrentCategory === slug ? "secondary" : "outline"}
                onClick={() => handleSelectCategory(slug)}
                disabled={isDiscovering || isImporting || isAutoRunning}
                className="text-xs"
              >
                {CATEGORY_LABELS[slug] || slug}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Discovered products */}
      {selectedCategory && discoveredProducts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Discovered from Capterra: {CATEGORY_LABELS[selectedCategory] || selectedCategory}
                </CardTitle>
                <CardDescription>
                  Found {discoveredProducts.length} products ({newProductsCount} new) — Page {currentPage}
                  {totalProducts > 0 && ` of ~${Math.ceil(totalProducts / 20)}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selectAllNew} disabled={isImporting}>
                  Select All New ({newProductsCount})
                </Button>
                <Button
                  size="sm"
                  onClick={importSelected}
                  disabled={selectedProducts.size === 0 || isImporting}
                >
                  {isImporting ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Importing...</>
                  ) : (
                    <><Download className="mr-1 h-3 w-3" /> Import {selectedProducts.size} Selected</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isImporting && (
              <div className="mb-4">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{Math.round(importProgress)}% complete</p>
              </div>
            )}
            <ScrollArea className="h-80">
              <div className="space-y-1">
                {discoveredProducts.map((product) => (
                  <div
                    key={product.slug}
                    className={`flex items-center gap-3 py-2 px-2 rounded text-sm hover:bg-muted/50 ${product.already_exists ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      checked={selectedProducts.has(product.slug)}
                      onCheckedChange={() => toggleProduct(product.slug)}
                      disabled={product.already_exists || isImporting}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{product.name}</span>
                        {product.already_exists && (
                          <Badge variant="secondary" className="text-xs">exists</Badge>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      {product.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          {product.rating.toFixed(1)}
                        </span>
                      )}
                      {product.review_count && <span>{product.review_count} reviews</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {hasNextPage && (
              <div className="mt-3 text-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => discoverProducts(selectedCategory, currentPage + 1)}
                  disabled={isDiscovering}
                >
                  {isDiscovering ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Loading...</>
                  ) : (
                    <><ChevronRight className="mr-1 h-3 w-3" /> Load More (Page {currentPage + 1})</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import results */}
      {importResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Results</CardTitle>
            <CardDescription>
              {successCount} imported, {importResults.filter((r) => r.status === "skipped").length} skipped, {errorCount} errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {importResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                      {r.status === "skipped" && <SkipForward className="h-4 w-4 text-amber-600" />}
                      <span className="font-medium">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "success" ? "default" : r.status === "skipped" ? "secondary" : "destructive"} className="text-xs">
                        {r.status}
                      </Badge>
                      {r.reason && <span className="text-xs text-muted-foreground max-w-48 truncate">{r.reason}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {isDiscovering && discoveredProducts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Discovering products from Capterra...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
