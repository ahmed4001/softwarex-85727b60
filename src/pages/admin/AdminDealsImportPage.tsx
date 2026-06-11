import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Globe, Link2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

type ExtractedDeal = {
  product_name: string;
  description?: string;
  discount_amount?: string;
  discount_type?: string;
  coupon_code?: string | null;
  deal_url: string;
  merchant_domain?: string;
  end_date?: string | null;
  category?: string;
  source_url?: string;
  domain?: string | null;
  matched_product_id?: string | null;
  matched_product_name?: string | null;
  matched_logo_url?: string | null;
  already_exists?: boolean;
  _selected?: boolean;
};

export default function AdminDealsImportPage() {
  const [mode, setMode] = useState<"scrape" | "crawl">("scrape");
  const [urlsText, setUrlsText] = useState("");
  const [crawlLimit, setCrawlLimit] = useState(20);
  const [defaultActive, setDefaultActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deals, setDeals] = useState<ExtractedDeal[]>([]);
  const [pagesScraped, setPagesScraped] = useState(0);

  const extract = async () => {
    const urls = urlsText.split("\n").map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
    if (!urls.length) { toast.error("Enter at least one valid URL"); return; }
    if (mode === "crawl" && urls.length > 1) toast.message("Crawl mode uses only the first URL");

    setLoading(true);
    setDeals([]);
    try {
      const { data, error } = await supabase.functions.invoke("import-deals-from-url", {
        body: { action: "extract", urls, mode, crawl_limit: crawlLimit },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Extraction failed");
      const enriched = (data.deals as ExtractedDeal[]).map((d) => ({ ...d, _selected: !d.already_exists }));
      setDeals(enriched);
      setPagesScraped(data.pages_scraped || 0);
      toast.success(`Extracted ${enriched.length} deals from ${data.pages_scraped} page(s)`);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const updateDeal = (i: number, patch: Partial<ExtractedDeal>) => {
    setDeals((prev) => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  };

  const toggleAll = (checked: boolean) => {
    setDeals((prev) => prev.map((d) => ({ ...d, _selected: checked && !d.already_exists })));
  };

  const importSelected = async () => {
    const selected = deals.filter((d) => d._selected);
    if (!selected.length) { toast.error("Select at least one deal"); return; }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-deals-from-url", {
        body: { action: "import", deals: selected, is_visible: defaultActive },
      });
      if (error) throw error;
      toast.success(`Imported ${data.inserted} deals${data.skipped ? `, skipped ${data.skipped}` : ""}`);
      if (data.errors?.length) toast.error(`${data.errors.length} errors`);
      setDeals((prev) => prev.filter((d) => !d._selected));
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = deals.filter((d) => d._selected).length;
  const matchedCount = deals.filter((d) => d.matched_product_id).length;

  return (
    <>
      <SeoHead title="Import Deals from URL - Admin" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Import Deals from URL
          </h1>
          <p className="text-muted-foreground">Scrape any page or crawl a whole site to bulk-import deals. AI extracts deal data and auto-links to your products by domain.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
            <CardDescription>Choose how to fetch content. Imported deals are auto-linked to existing products when their website domain matches.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList>
                <TabsTrigger value="scrape"><Link2 className="h-4 w-4 mr-2" />Scrape URLs</TabsTrigger>
                <TabsTrigger value="crawl"><Globe className="h-4 w-4 mr-2" />Crawl Website</TabsTrigger>
              </TabsList>
              <TabsContent value="scrape" className="space-y-2 pt-4">
                <label className="text-sm font-medium">One URL per line (max 10)</label>
                <Textarea rows={5} value={urlsText} onChange={(e) => setUrlsText(e.target.value)} placeholder={"https://example.com/black-friday-saas-deals\nhttps://otherblog.com/best-deals"} />
              </TabsContent>
              <TabsContent value="crawl" className="space-y-2 pt-4">
                <label className="text-sm font-medium">Starting URL</label>
                <Input value={urlsText} onChange={(e) => setUrlsText(e.target.value)} placeholder="https://example.com/deals" />
                <label className="text-sm font-medium pt-2 block">Page limit</label>
                <Input type="number" min={1} max={100} value={crawlLimit} onChange={(e) => setCrawlLimit(Number(e.target.value))} className="w-32" />
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox id="active" checked={defaultActive} onCheckedChange={(c) => setDefaultActive(!!c)} />
              <label htmlFor="active" className="text-sm">Make imported deals <strong>active</strong> (visible to public) immediately</label>
            </div>

            <Button onClick={extract} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {loading ? "Extracting..." : "Extract Deals"}
            </Button>
          </CardContent>
        </Card>

        {deals.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Review & Import ({deals.length} found)</CardTitle>
                  <CardDescription>
                    {pagesScraped} page(s) scraped · {matchedCount} auto-linked to products · {deals.filter(d=>d.already_exists).length} duplicates
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleAll(true)}>Select all</Button>
                  <Button size="sm" variant="outline" onClick={() => toggleAll(false)}>Clear</Button>
                  <Button size="sm" onClick={importSelected} disabled={importing || !selectedCount} className="gap-2">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Import {selectedCount} selected
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deals.map((d, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${d.already_exists ? "opacity-60 bg-muted/30" : "bg-background"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={!!d._selected} disabled={d.already_exists} onCheckedChange={(c) => updateDeal(i, { _selected: !!c })} className="mt-1" />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 text-sm">
                        <Input className="md:col-span-3" value={d.product_name} onChange={(e) => updateDeal(i, { product_name: e.target.value })} placeholder="Product name" />
                        <Input className="md:col-span-2" value={d.discount_amount || ""} onChange={(e) => updateDeal(i, { discount_amount: e.target.value })} placeholder="Discount (30%)" />
                        <Input className="md:col-span-2" value={d.coupon_code || ""} onChange={(e) => updateDeal(i, { coupon_code: e.target.value })} placeholder="Coupon code" />
                        <Input className="md:col-span-2" value={d.category || ""} onChange={(e) => updateDeal(i, { category: e.target.value })} placeholder="Category" />
                        <Input className="md:col-span-3" type="datetime-local" value={d.end_date ? new Date(d.end_date).toISOString().slice(0,16) : ""} onChange={(e) => updateDeal(i, { end_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                        <Input className="md:col-span-12" value={d.deal_url} onChange={(e) => updateDeal(i, { deal_url: e.target.value })} placeholder="Deal URL" />
                        <Textarea className="md:col-span-12" rows={2} value={d.description || ""} onChange={(e) => updateDeal(i, { description: e.target.value })} placeholder="Description" />
                        <div className="md:col-span-12 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {d.domain && <Badge variant="outline">{d.domain}</Badge>}
                          {d.matched_product_name ? (
                            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Linked: {d.matched_product_name}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No product match</Badge>
                          )}
                          {d.already_exists && (
                            <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Already exists</Badge>
                          )}
                          {d.source_url && <span className="truncate">from {d.source_url}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
