import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Pencil, Trash2, Star, TrendingUp, Eye, EyeOff, Copy, MousePointerClick, Link2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

type Deal = {
  id: string;
  product_id: string | null;
  product_name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  deal_url: string;
  discount_amount: string | null;
  discount_type: string | null;
  coupon_code: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  is_featured: boolean;
  is_trending: boolean;
  is_visible: boolean;
  click_count: number | null;
};

type ProductLite = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  tagline: string | null;
  website_url: string | null;
  category_id: string | null;
};

const blankDeal: Partial<Deal> = {
  product_id: null,
  product_name: "",
  slug: "",
  logo_url: "",
  description: "",
  deal_url: "",
  discount_amount: "",
  discount_type: "percent",
  coupon_code: "",
  category: "",
  start_date: "",
  end_date: "",
  is_featured: false,
  is_trending: false,
  is_visible: true,
};

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminDealsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Deal> | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "featured" | "trending" | "expired" | "hidden">("all");
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: deals = [] } = useQuery({
    queryKey: ["admin-deals"],
    queryFn: async () => {
      const { data } = await supabase.from("deals" as any).select("*").order("created_at", { ascending: false });
      return (data ?? []) as unknown as Deal[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-deals-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,slug,logo_url,tagline,website_url,category_id")
        .eq("status", "approved")
        .order("name", { ascending: true })
        .limit(2000);
      return (data ?? []) as ProductLite[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-deals-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return deals.filter((d) => {
      if (search && !`${d.product_name} ${d.slug} ${d.coupon_code ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "featured") return d.is_featured;
      if (filter === "trending") return d.is_trending;
      if (filter === "hidden") return !d.is_visible;
      if (filter === "expired") return d.end_date && new Date(d.end_date).getTime() < now;
      return true;
    });
  }, [deals, search, filter]);

  const save = useMutation({
    mutationFn: async (deal: Partial<Deal>) => {
      const payload = {
        ...deal,
        slug: deal.slug || slugify(deal.product_name || ""),
        start_date: deal.start_date || null,
        end_date: deal.end_date || null,
      };
      if (deal.id) {
        const { error } = await supabase.from("deals" as any).update(payload).eq("id", deal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deals" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-deals"] });
      toast.success("Deal saved");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-deals"] });
      toast.success("Deleted");
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("deals" as any).update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-deals"] }),
  });

  const openNew = () => { setEditing(blankDeal); setOpen(true); };
  const openEdit = (d: Deal) => {
    setEditing({
      ...d,
      start_date: d.start_date ? d.start_date.slice(0, 16) : "",
      end_date: d.end_date ? d.end_date.slice(0, 16) : "",
    });
    setOpen(true);
  };
  const duplicate = (d: Deal) => {
    const { id, click_count, ...rest } = d;
    setEditing({
      ...rest,
      product_name: `${d.product_name} (copy)`,
      slug: `${d.slug}-copy`,
      start_date: d.start_date ? d.start_date.slice(0, 16) : "",
      end_date: d.end_date ? d.end_date.slice(0, 16) : "",
    });
    setOpen(true);
  };

  const selectProduct = (p: ProductLite) => {
    if (!editing) return;
    setEditing({
      ...editing,
      product_id: p.id,
      product_name: p.name,
      slug: p.slug,
      logo_url: p.logo_url ?? editing.logo_url ?? "",
      description: editing.description || p.tagline || "",
      deal_url: editing.deal_url || p.website_url || "",
      category: editing.category || categoryMap[p.category_id ?? ""] || "",
    });
    setPickerOpen(false);
  };

  const selectedProduct = products.find((p) => p.id === editing?.product_id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Deals</h1>
          <p className="text-muted-foreground">Connect deals to live products and manage offers</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Deal</Button>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>All Deals ({filtered.length})</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {(["all", "featured", "trending", "expired", "hidden"] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
                  {f}
                </Button>
              ))}
            </div>
          </div>
          <Input placeholder="Search by product, slug or coupon..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 px-2">Product</th>
                  <th className="py-2 px-2">Linked</th>
                  <th className="py-2 px-2">Discount</th>
                  <th className="py-2 px-2">Coupon</th>
                  <th className="py-2 px-2">Ends</th>
                  <th className="py-2 px-2">Clicks</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const expired = d.end_date && new Date(d.end_date).getTime() < Date.now();
                  return (
                    <tr key={d.id} className="border-b hover:bg-muted/40">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {d.logo_url ? <img src={d.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-muted" /> : <div className="h-8 w-8 rounded bg-muted" />}
                          <div>
                            <div className="font-medium">{d.product_name}</div>
                            <div className="text-xs text-muted-foreground">{d.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {d.product_id ? <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" /> Linked</Badge> : <span className="text-xs text-muted-foreground">Manual</span>}
                      </td>
                      <td className="py-3 px-2">{d.discount_amount ? `${d.discount_amount}${d.discount_type === "percent" ? "%" : ""}` : "—"}</td>
                      <td className="py-3 px-2">
                        {d.coupon_code ? (
                          <button className="font-mono text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70 inline-flex items-center gap-1" onClick={() => { navigator.clipboard.writeText(d.coupon_code!); toast.success("Coupon copied"); }}>
                            {d.coupon_code} <Copy className="h-3 w-3" />
                          </button>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-2">
                        {d.end_date ? (
                          <span className={expired ? "text-destructive" : ""}>{new Date(d.end_date).toLocaleDateString()}</span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-2"><span className="inline-flex items-center gap-1 text-muted-foreground"><MousePointerClick className="h-3 w-3" />{d.click_count ?? 0}</span></td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {expired && <Badge variant="destructive">Expired</Badge>}
                          {d.is_featured && <Badge variant="secondary"><Star className="h-3 w-3" /></Badge>}
                          {d.is_trending && <Badge variant="secondary"><TrendingUp className="h-3 w-3" /></Badge>}
                          <Badge variant={d.is_visible ? "default" : "outline"}>{d.is_visible ? "Visible" : "Hidden"}</Badge>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => toggle.mutate({ id: d.id, field: "is_featured", value: !d.is_featured })} title="Feature"><Star className={`h-4 w-4 ${d.is_featured ? "fill-primary text-primary" : ""}`} /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle.mutate({ id: d.id, field: "is_trending", value: !d.is_trending })} title="Trending"><TrendingUp className={`h-4 w-4 ${d.is_trending ? "text-primary" : ""}`} /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle.mutate({ id: d.id, field: "is_visible", value: !d.is_visible })} title="Toggle visibility">{d.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
                          <Button size="icon" variant="ghost" onClick={() => duplicate(d)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && del.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No deals match</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Deal" : "New Deal"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Link to Product</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {selectedProduct ? (
                        <span className="flex items-center gap-2">
                          {selectedProduct.logo_url && <img src={selectedProduct.logo_url} alt="" className="h-5 w-5 rounded object-contain" />}
                          {selectedProduct.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select a product from your catalog…</span>
                      )}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search products..." />
                      <CommandList>
                        <CommandEmpty>No products found</CommandEmpty>
                        <CommandGroup>
                          {products.slice(0, 200).map((p) => (
                            <CommandItem key={p.id} value={`${p.name} ${p.slug}`} onSelect={() => selectProduct(p)}>
                              <Check className={`mr-2 h-4 w-4 ${editing.product_id === p.id ? "opacity-100" : "opacity-0"}`} />
                              {p.logo_url && <img src={p.logo_url} alt="" className="h-5 w-5 rounded object-contain mr-2" />}
                              <div className="flex flex-col">
                                <span>{p.name}</span>
                                <span className="text-xs text-muted-foreground">{p.slug}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {editing.product_id && (
                  <button className="mt-1 text-xs text-muted-foreground hover:text-foreground underline" onClick={() => setEditing({ ...editing, product_id: null })}>
                    Unlink product (keep as manual deal)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Product Name *</Label>
                  <Input value={editing.product_name || ""} onChange={(e) => setEditing({ ...editing, product_name: e.target.value, slug: editing.slug || slugify(e.target.value) })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Logo URL</Label>
                <Input value={editing.logo_url || ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Deal URL *</Label>
                <Input value={editing.deal_url || ""} onChange={(e) => setEditing({ ...editing, deal_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Discount Amount</Label>
                  <Input value={editing.discount_amount || ""} onChange={(e) => setEditing({ ...editing, discount_amount: e.target.value })} placeholder="50" />
                </div>
                <div>
                  <Label>Discount Type</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-input bg-background" value={editing.discount_type || "percent"} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                    <option value="percent">Percent (%)</option>
                    <option value="amount">Amount ($)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label>Coupon Code</Label>
                  <Input value={editing.coupon_code || ""} onChange={(e) => setEditing({ ...editing, coupon_code: e.target.value })} placeholder="SAVE50" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Category</Label>
                  <Input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="CRM" />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input type="datetime-local" value={editing.start_date || ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="datetime-local" value={editing.end_date || ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-6 pt-2 flex-wrap">
                <div className="flex items-center gap-2"><Switch checked={!!editing.is_featured} onCheckedChange={(v) => setEditing({ ...editing, is_featured: v })} /><Label>Featured</Label></div>
                <div className="flex items-center gap-2"><Switch checked={!!editing.is_trending} onCheckedChange={(v) => setEditing({ ...editing, is_trending: v })} /><Label>Trending</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editing.is_visible !== false} onCheckedChange={(v) => setEditing({ ...editing, is_visible: v })} /><Label>Visible</Label></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending || !editing?.product_name || !editing?.deal_url}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
