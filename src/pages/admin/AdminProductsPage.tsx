import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Eye, CheckSquare, Square, ImageDown, Loader2, Monitor, Sparkles } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { PaginationControls } from "@/components/PaginationControls";

const PAGE_SIZE = 50;

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [mediaFilter, setMediaFilter] = useState<"all" | "missing_logo" | "missing_screenshot">("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFetchingLogos, setIsFetchingLogos] = useState(false);
  const [isFetchingScreenshots, setIsFetchingScreenshots] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ processed: 0, succeeded: 0, failed: 0, total: 0 });
  const [activeFetchMode, setActiveFetchMode] = useState<"logo" | "screenshot" | null>(null);
  const abortRef = useRef(false);
  const queryClient = useQueryClient();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!products) return;
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p: any) => p.id)));
    }
  };

  const bulkMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("products").update({ [field]: value }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setSelectedIds(new Set());
      toast.success("Bulk update applied");
    },
    onError: () => toast.error("Bulk update failed"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setSelectedIds(new Set());
      toast.success("Products deleted");
    },
    onError: () => toast.error("Bulk delete failed"),
  });

  const bulkFetchMedia = useCallback(async (mode: "logo" | "screenshot" | "both") => {
    const setLoading = mode === "screenshot" ? setIsFetchingScreenshots : setIsFetchingLogos;
    setLoading(true);
    setActiveFetchMode(mode === "screenshot" ? "screenshot" : "logo");
    abortRef.current = false;

    // Get total count of products needing processing
    let countQuery = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (mode === "logo" || mode === "both") {
      countQuery = countQuery.or("logo_url.ilike.%clearbit%,logo_url.is.null,logo_url.eq.");
    } else {
      countQuery = countQuery.not("website_url", "is", null).neq("website_url", "");
      countQuery = countQuery.or("screenshots.is.null,screenshots.eq.[]");
    }
    const { count: totalCount } = await countQuery;
    const total = totalCount || 0;

    setFetchProgress({ processed: 0, succeeded: 0, failed: 0, total });
    let offset = 0;
    const batchSize = mode === "screenshot" ? 5 : 20;
    let totalProcessed = 0, totalSucceeded = 0, totalFailed = 0;

    try {
      while (!abortRef.current) {
        const { data, error } = await supabase.functions.invoke("bulk-selfhost-logos", {
          body: { batchSize, offset, mode },
        });
        if (error) throw error;
        totalProcessed += data.processed || 0;
        totalSucceeded += data.succeeded || 0;
        totalFailed += data.failed || 0;
        setFetchProgress({ processed: totalProcessed, succeeded: totalSucceeded, failed: totalFailed, total });

        if (data.done || data.processed === 0) break;
        offset = data.nextOffset;
      }
      const label = mode === "screenshot" ? "screenshots" : "logos";
      toast.success(`Done! ${totalSucceeded} ${label} fetched, ${totalFailed} failed`);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e: any) {
      toast.error(`Fetch stopped: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
      setActiveFetchMode(null);
    }
  }, [queryClient]);

  // Reset page when filters change
  const handleSearch = (val: string) => { setSearch(val); setPage(0); };
  const handleMediaFilter = (val: "all" | "missing_logo" | "missing_screenshot") => { setMediaFilter(val); setPage(0); };

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["admin-products", search, mediaFilter, page],
    queryFn: async () => {
      let countQuery = supabase.from("products").select("*", { count: "exact", head: true });
      if (search) countQuery = countQuery.ilike("name", `%${search}%`);
      if (mediaFilter === "missing_logo") countQuery = countQuery.or("logo_url.is.null,logo_url.eq.,logo_url.ilike.%clearbit%");
      else if (mediaFilter === "missing_screenshot") countQuery = countQuery.or("screenshots.is.null,screenshots.eq.[]");
      const { count } = await countQuery;

      let query = supabase.from("products").select("*, categories!products_category_id_fkey(name)").order("created_at", { ascending: false });
      if (search) query = query.ilike("name", `%${search}%`);
      if (mediaFilter === "missing_logo") query = query.or("logo_url.is.null,logo_url.eq.,logo_url.ilike.%clearbit%");
      else if (mediaFilter === "missing_screenshot") query = query.or("screenshots.is.null,screenshots.eq.[]");
      const { data } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      return { products: data || [], total: count || 0 };
    },
  });

  const products = productsData?.products;
  const totalPages = Math.ceil((productsData?.total || 0) / PAGE_SIZE);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("products").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Updated"); },
    onError: () => toast.error("Failed to update"),
  });

  const tierMutation = useMutation({
    mutationFn: async ({ id, tier }: { id: string; tier: string | null }) => {
      const { error } = await supabase.from("products").update({ sponsor_tier: tier as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Tier updated"); },
    onError: () => toast.error("Failed to update tier"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete product"),
  });

  return (
    <>
      <SeoHead title="Products - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Products</h1>
            <p className="text-muted-foreground">{productsData?.total || 0} products total</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={isFetchingLogos ? () => { abortRef.current = true; } : () => bulkFetchMedia("logo")}
            >
              {isFetchingLogos ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {fetchProgress.processed > 0 ? `${fetchProgress.succeeded} logos...` : "Starting..."}
                </>
              ) : (
                <>
                  <ImageDown className="h-4 w-4" />
                  Fetch Logos
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={isFetchingScreenshots ? () => { abortRef.current = true; } : () => bulkFetchMedia("screenshot")}
            >
              {isFetchingScreenshots ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {fetchProgress.processed > 0 ? `${fetchProgress.succeeded} screenshots...` : "Starting..."}
                </>
              ) : (
                <>
                  <Monitor className="h-4 w-4" />
                  Fetch Screenshots
                </>
              )}
            </Button>
            <Link to="/admin/products/new"><Button className="gap-1"><Plus className="h-4 w-4" />Add Product</Button></Link>
          </div>
        </div>

        {activeFetchMode && fetchProgress.total > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {activeFetchMode === "screenshot" ? "Fetching Screenshots" : "Fetching Logos"}
              </span>
              <span className="text-muted-foreground">
                {fetchProgress.processed} / {fetchProgress.total} processed · {fetchProgress.total - fetchProgress.processed} remaining
              </span>
            </div>
            <Progress value={fetchProgress.total > 0 ? (fetchProgress.processed / fetchProgress.total) * 100 : 0} className="h-2" />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="text-primary">✓ {fetchProgress.succeeded} succeeded</span>
              <span className="text-destructive">✗ {fetchProgress.failed} failed</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={mediaFilter} onValueChange={(v) => handleMediaFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="missing_logo">Missing Logo</SelectItem>
              <SelectItem value="missing_screenshot">Missing Screenshot</SelectItem>
            </SelectContent>
          </Select>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => bulkMutation.mutate({ field: "is_active", value: true })}>Activate</Button>
              <Button variant="outline" size="sm" onClick={() => bulkMutation.mutate({ field: "is_active", value: false })}>Deactivate</Button>
              <Button variant="outline" size="sm" onClick={() => bulkMutation.mutate({ field: "is_featured", value: true })}>Feature</Button>
              <Button variant="destructive" size="sm" onClick={() => bulkDeleteMutation.mutate()}>Delete</Button>
            </div>
          )}
        </div>

        <div className="product-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 w-10">
                    <Checkbox checked={products?.length ? selectedIds.size === products.length : false} onCheckedChange={toggleAll} />
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Product</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Category</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Website</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Rating</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Reviews</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Active</th>
                   <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Featured</th>
                   <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Sponsored</th>
                   <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((p: any) => (
                  <tr key={p.id} className="admin-table-row">
                    <td className="px-4 py-3">
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-primary">{p.name.charAt(0)}</span>}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.pricing_model}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.categories?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                      {p.website_url ? (
                        <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
                      ) : <span className="text-destructive">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">★ {Number(p.avg_rating).toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.total_reviews}</td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={p.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, field: "is_active", value: v })} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={p.is_featured} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, field: "is_featured", value: v })} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Switch checked={p.is_sponsored} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, field: "is_sponsored", value: v })} />
                        {p.is_sponsored && (
                          <Select value={p.sponsor_tier || ""} onValueChange={(v) => tierMutation.mutate({ id: p.id, tier: v || null })}>
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue placeholder="Tier" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bronze">Bronze</SelectItem>
                              <SelectItem value="silver">Silver</SelectItem>
                              <SelectItem value="gold">Gold</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/product/${p.slug}`}><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button></Link>
                        <Link to={`/admin/products/${p.id}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ id: p.id, name: p.name })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoading && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
                {!isLoading && products?.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No products found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Product</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone. All associated reviews and data will remain but the product listing will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
