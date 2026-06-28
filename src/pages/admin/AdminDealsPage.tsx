import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Star, TrendingUp, Eye, EyeOff, Copy, MousePointerClick, Link2,
  Check, ChevronsUpDown, Download, Upload, ChevronLeft, ChevronRight, ArrowUpDown,
} from "lucide-react";
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
  review_status: string;
  click_count: number | null;
  created_at: string;
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

type SortColumn = "created_at" | "product_name" | "click_count" | "end_date";

const PAGE_SIZE = 25;

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

type BulkAction = "feature" | "unfeature" | "hide" | "show" | "delete" | "extend" | "set_category" | "approve" | "reject";

export default function AdminDealsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Deal> | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "featured" | "trending" | "expired" | "hidden" | "pending">("all");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Pagination & sorting
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<SortColumn>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [bulkCategory, setBulkCategory] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const dealsQuery = useQuery({
    queryKey: ["admin-deals", { search, filter, sortCol, sortDir, page }],
    queryFn: async () => {
      const now = new Date().toISOString();
      let q = supabase.from("deals" as any).select("*", { count: "exact" });

      if (search) q = q.or(`product_name.ilike.%${search}%,slug.ilike.%${search}%,coupon_code.ilike.%${search}%`);
      if (filter === "featured") q = q.eq("is_featured", true);
      if (filter === "trending") q = q.eq("is_trending", true);
      if (filter === "hidden") q = q.eq("is_visible", false);
      if (filter === "pending") q = q.eq("review_status", "pending_review");
      if (filter === "expired") q = q.lt("end_date", now).not("end_date", "is", null);

      q = q.order(sortCol, { ascending: sortDir === "asc", nullsFirst: false });
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Deal[], count: count ?? 0 };
    },
  });

  const deals = dealsQuery.data?.rows ?? [];
  const totalCount = dealsQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: products = [] } = useQuery({
    queryKey: ["admin-deals-products"],
    queryFn: async () => {
      const { data } = await (supabase as any)
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

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
    setPage(0);
  };

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
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean | string }) => {
      const { error } = await supabase.from("deals" as any).update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-deals"] }),
  });

  // ===== Bulk action =====
  const runBulk = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) return { ok: 0, failed: 0 };
      let ok = 0, failed = 0;

      const apply = async (p: any) => {
        const { error } = await p;
        if (error) failed++; else ok += ids.length;
      };

      switch (bulkAction) {
        case "feature":
          await apply((supabase.from("deals" as any) as any).update({ is_featured: true }).in("id", ids));
          break;
        case "unfeature":
          await apply((supabase.from("deals" as any) as any).update({ is_featured: false }).in("id", ids));
          break;
        case "hide":
          await apply((supabase.from("deals" as any) as any).update({ is_visible: false }).in("id", ids));
          break;
        case "show":
          await apply((supabase.from("deals" as any) as any).update({ is_visible: true }).in("id", ids));
          break;
        case "approve":
          await apply((supabase.from("deals" as any) as any).update({ review_status: "approved", is_visible: true }).in("id", ids));
          break;
        case "reject":
          await apply((supabase.from("deals" as any) as any).update({ review_status: "rejected", is_visible: false }).in("id", ids));
          break;
        case "delete":
          await apply((supabase.from("deals" as any) as any).delete().in("id", ids));
          break;
        case "set_category":
          await apply((supabase.from("deals" as any) as any).update({ category: bulkCategory || null }).in("id", ids));
          break;
        case "extend": {
          // Per-row: add N days to existing end_date, or set to now+N days if null
          ok = 0; failed = 0;
          for (const id of ids) {
            const row = deals.find((d) => d.id === id);
            const base = row?.end_date ? new Date(row.end_date) : new Date();
            base.setDate(base.getDate() + Number(extendDays || 0));
            const { error } = await supabase.from("deals" as any).update({ end_date: base.toISOString() }).eq("id", id);
            if (error) failed++; else ok++;
          }
          break;
        }
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      const label = bulkAction === "delete" ? "deleted" : "updated";
      if (failed === 0) toast.success(`${ok} deal(s) ${label}`);
      else toast.warning(`${ok} ${label}, ${failed} failed`);
      setSelected(new Set());
      setBulkAction(null);
      qc.invalidateQueries({ queryKey: ["admin-deals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ===== CSV =====
  const exportCSV = async () => {
    toast.info("Exporting all deals...");
    const { data, error } = await supabase.from("deals" as any).select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []) as unknown as Deal[];
    const cols: (keyof Deal)[] = [
      "id", "product_id", "product_name", "slug", "logo_url", "description", "deal_url",
      "discount_amount", "discount_type", "coupon_code", "category",
      "start_date", "end_date", "is_featured", "is_trending", "is_visible", "click_count",
    ];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => escape((r as any)[c])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `deals-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} deals`);
  };

  const importCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { toast.error("Empty CSV"); return; }

    const parseLine = (line: string) => {
      const out: string[] = []; let cur = ""; let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') q = false;
          else cur += c;
        } else {
          if (c === ",") { out.push(cur); cur = ""; }
          else if (c === '"') q = true;
          else cur += c;
        }
      }
      out.push(cur);
      return out;
    };

    const headers = parseLine(lines[0]).map((h) => h.trim());
    const required = ["product_name", "deal_url"];
    for (const r of required) {
      if (!headers.includes(r)) { toast.error(`Missing required column: ${r}`); return; }
    }

    const rows = lines.slice(1).map((l) => {
      const vals = parseLine(l);
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] === "" ? null : vals[i]; });
      return obj;
    });

    let inserted = 0, updated = 0, failed = 0;
    for (const row of rows) {
      const payload: any = {
        product_name: row.product_name,
        deal_url: row.deal_url,
        slug: row.slug || slugify(row.product_name || ""),
        logo_url: row.logo_url || null,
        description: row.description || null,
        discount_amount: row.discount_amount || null,
        discount_type: row.discount_type || "percent",
        coupon_code: row.coupon_code || null,
        category: row.category || null,
        start_date: row.start_date || null,
        end_date: row.end_date || null,
        is_featured: String(row.is_featured).toLowerCase() === "true",
        is_trending: String(row.is_trending).toLowerCase() === "true",
        is_visible: row.is_visible == null ? true : String(row.is_visible).toLowerCase() !== "false",
        product_id: row.product_id || null,
      };
      try {
        if (row.id) {
          const { error } = await supabase.from("deals" as any).update(payload).eq("id", row.id);
          if (error) throw error;
          updated++;
        } else {
          // upsert by slug
          const { error } = await supabase.from("deals" as any).upsert(payload, { onConflict: "slug" });
          if (error) throw error;
          inserted++;
        }
      } catch {
        failed++;
      }
    }
    toast.success(`Imported: ${inserted} added, ${updated} updated${failed ? `, ${failed} failed` : ""}`);
    qc.invalidateQueries({ queryKey: ["admin-deals"] });
  };

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

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === deals.length) setSelected(new Set());
    else setSelected(new Set(deals.map((d) => d.id)));
  };

  const selectedRows = deals.filter((d) => selected.has(d.id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Deals</h1>
          <p className="text-muted-foreground">Connect deals to live products and manage offers</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCSV(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Import CSV</Button>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Deal</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>All Deals ({totalCount})</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {(["all", "featured", "trending", "expired", "hidden", "pending"] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => { setFilter(f); setPage(0); }} className="capitalize">
                  {f === "pending" ? "Pending Review" : f}
                </Button>
              ))}
            </div>
          </div>
          <Input
            placeholder="Search by product, slug or coupon..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="max-w-md"
          />
        </CardHeader>
        <CardContent>
          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="sticky top-2 z-20 mb-3 flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 flex-wrap">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => setBulkAction("approve")}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("reject")}>Reject</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("feature")}><Star className="h-3.5 w-3.5 mr-1" /> Feature</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("unfeature")}>Unfeature</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("hide")}><EyeOff className="h-3.5 w-3.5 mr-1" /> Hide</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("show")}><Eye className="h-3.5 w-3.5 mr-1" /> Show</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("extend")}>Extend end date</Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("set_category")}>Set category</Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkAction("delete")}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 px-2 w-8">
                    <Checkbox checked={deals.length > 0 && selected.size === deals.length} onCheckedChange={toggleAll} />
                  </th>
                  <th className="py-2 px-2">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("product_name")}>
                      Product <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 px-2">Linked</th>
                  <th className="py-2 px-2">Discount</th>
                  <th className="py-2 px-2">Coupon</th>
                  <th className="py-2 px-2">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("end_date")}>
                      Ends <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 px-2">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("click_count")}>
                      Clicks <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dealsQuery.isLoading && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                )}
                {!dealsQuery.isLoading && deals.map((d) => {
                  const expired = d.end_date && new Date(d.end_date).getTime() < Date.now();
                  return (
                    <tr key={d.id} className="border-b hover:bg-muted/40">
                      <td className="py-3 px-2">
                        <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleRow(d.id)} />
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {d.logo_url ? <img decoding="async" loading="lazy" src={d.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-muted" /> : <div className="h-8 w-8 rounded bg-muted" />}
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
                          {d.review_status === "pending_review" && <Badge variant="outline" className="text-amber-600 border-amber-500/40 bg-amber-500/10">Pending</Badge>}
                          {d.review_status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                          {expired && <Badge variant="destructive">Expired</Badge>}
                          {d.is_featured && <Badge variant="secondary"><Star className="h-3 w-3" /></Badge>}
                          {d.is_trending && <Badge variant="secondary"><TrendingUp className="h-3 w-3" /></Badge>}
                          <Badge variant={d.is_visible ? "default" : "outline"}>{d.is_visible ? "Visible" : "Hidden"}</Badge>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => toggle.mutate({ id: d.id, field: "review_status", value: d.review_status === "pending_review" ? "approved" : "pending_review" })} title={d.review_status === "pending_review" ? "Approve" : "Set pending"}>
                            {d.review_status === "pending_review" ? <Check className="h-4 w-4 text-green-600" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle.mutate({ id: d.id, field: "is_featured", value: !d.is_featured })} title="Feature"><Star className={`h-4 w-4 ${d.is_featured ? "fill-primary text-primary" : ""}`} /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle.mutate({ id: d.id, field: "is_trending", value: !d.is_trending })} title="Trending"><TrendingUp className={`h-4 w-4 ${d.is_trending ? "text-primary" : ""}`} /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle.mutate({ id: d.id, field: "is_visible", value: !d.is_visible })} title="Toggle visibility">{d.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
                          <Button size="icon" variant="ghost" onClick={() => duplicate(d)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!dealsQuery.isLoading && deals.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No deals match</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">
              Page {page + 1} of {totalPages} · {totalCount} total
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete single confirm */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete deal?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDeleteId) del.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk confirm dialog */}
      <Dialog open={!!bulkAction} onOpenChange={(o) => !o && setBulkAction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "feature" && "Feature deals"}
              {bulkAction === "unfeature" && "Remove featured flag"}
              {bulkAction === "hide" && "Hide deals from site"}
              {bulkAction === "show" && "Make deals visible"}
              {bulkAction === "approve" && "Approve deals"}
              {bulkAction === "reject" && "Reject deals"}
              {bulkAction === "delete" && "Delete deals permanently"}
              {bulkAction === "extend" && "Extend end date"}
              {bulkAction === "set_category" && "Set category"}
            </DialogTitle>
            <DialogDescription>
              This will affect {selected.size} deal(s).
              {bulkAction === "delete" && " This cannot be undone."}
            </DialogDescription>
          </DialogHeader>

          {bulkAction === "extend" && (
            <div className="space-y-2">
              <Label>Add days to end date</Label>
              <Input type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">If a deal has no end date, it will be set to today + N days.</p>
            </div>
          )}

          {bulkAction === "set_category" && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} placeholder="e.g. CRM" />
              <p className="text-xs text-muted-foreground">Leave blank to clear category.</p>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 text-sm">
            {selectedRows.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="font-medium">{r.product_name}</span>
                <span className="text-xs text-muted-foreground">{r.slug}</span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button
              variant={bulkAction === "delete" ? "destructive" : "default"}
              disabled={runBulk.isPending}
              onClick={() => runBulk.mutate()}
            >
              {runBulk.isPending ? "Processing..." : `Confirm ${bulkAction === "delete" ? "delete" : "action"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor dialog */}
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
                          {selectedProduct.logo_url && <img decoding="async" loading="lazy" src={selectedProduct.logo_url} alt="" className="h-5 w-5 rounded object-contain" />}
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
                              {p.logo_url && <img decoding="async" loading="lazy" src={p.logo_url} alt="" className="h-5 w-5 rounded object-contain mr-2" />}
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
                  <Select value={editing.discount_type || "percent"} onValueChange={(v) => setEditing({ ...editing, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                      <SelectItem value="amount">Amount ($)</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
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
