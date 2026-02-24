import { useState, useCallback } from "react";
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
  g2_url: string;
  g2_slug: string;
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

// G2 category mapping (mirrored from edge function)
const G2_CATEGORY_MAP: Record<string, string> = {
  "project-management": "project-management",
  "crm": "crm",
  "communication": "team-communication",
  "ecommerce": "e-commerce-platforms",
  "analytics": "analytics-platforms",
  "marketing": "marketing-automation",
  "help-desk": "help-desk",
  "hr": "hr-management-suites",
  "accounting": "accounting",
  "seo": "seo-tools",
  "social-media": "social-media-management",
  "cms": "content-management-system-cms",
  "development": "integrated-development-environment-ide",
  "security": "endpoint-protection-suites",
  "collaboration": "collaboration",
  "lms": "learning-management-system-lms",
  "time-tracking": "time-tracking",
  "video-conferencing": "video-conferencing",
  "email-marketing": "email-marketing",
  "live-chat": "live-chat",
  "no-code": "no-code-development-platforms",
  "ai-writing": "ai-writing-assistant",
  "ai-chatbots": "chatbots",
  "ai-code": "ai-code-generation",
  "ai-image-generators": "ai-image-generator",
  "cloud-hosting": "cloud-platform-as-a-service",
  "database-management": "database-management",
  "ci-cd": "continuous-integration",
  "bug-tracking": "bug-tracking",
  "api-management": "api-management",
  "erp": "erp-systems",
  "payroll": "payroll",
  "recruitment": "recruiting",
  "employee-engagement": "employee-engagement",
  "expense-management": "expense-management",
  "contract-management": "contract-management",
  "e-signature": "electronic-signature",
  "document-management": "document-management",
  "survey": "survey",
  "webinar": "webinar",
  "graphic-design": "graphic-design",
  "data-visualization": "data-visualization",
  "business-intelligence": "business-intelligence",
  "inventory-management": "inventory-management",
  "invoicing": "invoicing",
  "lead-generation": "lead-generation",
  "sales-engagement": "sales-engagement",
  "sales-intelligence": "sales-intelligence",
  "customer-success": "customer-success",
  "password-management": "password-manager",
  "antivirus": "antivirus",
  "vpn": "vpn",
  "backup": "backup",
  "supply-chain": "supply-chain-management",
  "tax": "tax-compliance",
  "text-to-speech": "text-to-speech",
  "proposal": "proposal",
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

export default function G2DiscoveryPanel() {
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

  const categoryEntries = Object.entries(G2_CATEGORY_MAP).sort((a, b) =>
    (CATEGORY_LABELS[a[0]] || a[0]).localeCompare(CATEGORY_LABELS[b[0]] || b[0])
  );

  const discoverProducts = useCallback(async (catSlug: string, page: number) => {
    setIsDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-products", {
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

    // Import in batches of 3
    const batchSize = 3;
    const batches: DiscoveredProduct[][] = [];
    for (let i = 0; i < products.length; i += batchSize) {
      batches.push(products.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      setImportProgress(((i + 1) / batches.length) * 100);

      try {
        const { data, error } = await supabase.functions.invoke("discover-products", {
          body: {
            action: "import",
            category_slug: selectedCategory,
            import_products: batches[i],
          },
        });

        if (error) {
          const errorResults = batches[i].map((p) => ({
            name: p.name,
            status: "error" as const,
            reason: error.message,
          }));
          setImportResults((prev) => [...prev, ...errorResults]);
        } else if (data?.results) {
          setImportResults((prev) => [...prev, ...data.results]);
        }
      } catch (err) {
        const errorResults = batches[i].map((p) => ({
          name: p.name,
          status: "error" as const,
          reason: err instanceof Error ? err.message : "Network error",
        }));
        setImportResults((prev) => [...prev, ...errorResults]);
      }
    }

    setIsImporting(false);
    toast({ title: "Import complete", description: `Processed ${products.length} products.` });
  }, [selectedCategory, selectedProducts, discoveredProducts, toast]);

  const newProductsCount = discoveredProducts.filter((p) => !p.already_exists).length;
  const successCount = importResults.filter((r) => r.status === "success").length;
  const errorCount = importResults.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      {/* Category selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            G2 Product Discovery
          </CardTitle>
          <CardDescription>
            Crawl G2 category pages to discover and import software products automatically.
            Select a category to start discovering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categoryEntries.map(([slug]) => (
              <Button
                key={slug}
                size="sm"
                variant={selectedCategory === slug ? "default" : "outline"}
                onClick={() => handleSelectCategory(slug)}
                disabled={isDiscovering || isImporting}
                className="text-xs"
              >
                {CATEGORY_LABELS[slug] || slug}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Discovery results */}
      {selectedCategory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Discovered Products — {CATEGORY_LABELS[selectedCategory] || selectedCategory}
                </CardTitle>
                <CardDescription>
                  {isDiscovering
                    ? "Crawling G2 category page..."
                    : `Found ${discoveredProducts.length} products (${newProductsCount} new). ${totalProducts > 0 ? `~${totalProducts} total on G2.` : ""}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {discoveredProducts.length > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={selectAllNew} disabled={isImporting}>
                      Select All New ({newProductsCount})
                    </Button>
                    <Button
                      size="sm"
                      onClick={importSelected}
                      disabled={isImporting || selectedProducts.size === 0}
                    >
                      {isImporting ? (
                        <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Importing...</>
                      ) : (
                        <><Download className="mr-1 h-3 w-3" /> Import {selectedProducts.size} Products</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isDiscovering && discoveredProducts.length === 0 && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Crawling G2 category page...
              </div>
            )}

            {discoveredProducts.length > 0 && (
              <>
                {isImporting && (
                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Import Progress</span>
                      <span className="font-medium">{Math.round(importProgress)}%</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </div>
                )}

                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {discoveredProducts.map((product) => {
                      const importResult = importResults.find((r) => r.name === product.name);
                      return (
                        <div
                          key={product.slug}
                          className={`flex items-center gap-3 py-2 px-3 rounded text-sm hover:bg-muted/50 ${
                            product.already_exists ? "opacity-50" : ""
                          }`}
                        >
                          <Checkbox
                            checked={selectedProducts.has(product.slug)}
                            onCheckedChange={() => toggleProduct(product.slug)}
                            disabled={product.already_exists || isImporting}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{product.name}</div>
                            {product.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {product.description}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {product.rating && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {product.rating.toFixed(1)}
                              </span>
                            )}
                            {product.review_count && (
                              <span className="text-xs text-muted-foreground">
                                {product.review_count} reviews
                              </span>
                            )}
                            {product.already_exists && (
                              <Badge variant="secondary" className="text-xs">Exists</Badge>
                            )}
                            {importResult && (
                              <>
                                {importResult.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                {importResult.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                                {importResult.status === "skipped" && <SkipForward className="h-4 w-4 text-amber-600" />}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {hasNextPage && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => discoverProducts(selectedCategory, currentPage + 1)}
                      disabled={isDiscovering || isImporting}
                    >
                      {isDiscovering ? (
                        <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Loading...</>
                      ) : (
                        <>Load More <ChevronRight className="ml-1 h-3 w-3" /></>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import results summary */}
      {importResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Import Results</CardTitle>
            <CardDescription>
              {successCount} imported, {errorCount} errors, {importResults.filter((r) => r.status === "skipped").length} skipped
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {importResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1 px-2 rounded text-sm hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                      {r.status === "skipped" && <SkipForward className="h-4 w-4 text-amber-600" />}
                      <span className="font-medium">{r.name}</span>
                    </div>
                    {r.reason && (
                      <span className="text-xs text-muted-foreground max-w-48 truncate">{r.reason}</span>
                    )}
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
