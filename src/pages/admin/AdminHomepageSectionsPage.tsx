import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, X, Plus, Search, Trash2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Section {
  key: string;
  label: string;
  is_enabled: boolean;
  sort_order: number;
}
interface SectionProduct {
  id: string;
  section_key: string;
  product_id: string;
  position: number;
  product?: { name: string; slug: string; logo_url: string | null };
}

export default function AdminHomepageSectionsPage() {
  const qc = useQueryClient();
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "remove" | "add";
    sectionKey: string;
    ids: string[];
    count: number;
  } | null>(null);

  const { data: sections } = useQuery({
    queryKey: ["admin-homepage-sections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("homepage_sections" as any)
        .select("*")
        .order("sort_order");
      return (data as any as Section[]) || [];
    },
  });

  const { data: items, refetch: refetchItems } = useQuery({
    queryKey: ["admin-homepage-section-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("homepage_section_products" as any)
        .select("id, section_key, product_id, position")
        .order("position");
      const rows = (data as any as SectionProduct[]) || [];
      const ids = Array.from(new Set(rows.map((r) => r.product_id)));
      if (ids.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, name, slug, logo_url")
          .in("id", ids);
        const map = new Map((prods || []).map((p: any) => [p.id, p]));
        rows.forEach((r) => (r.product = map.get(r.product_id)));
      }
      return rows;
    },
  });

  async function toggleEnabled(key: string, next: boolean) {
    const { error } = await supabase
      .from("homepage_sections" as any)
      .update({ is_enabled: next, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    toast({ title: next ? "Section enabled" : "Section disabled" });
    qc.invalidateQueries({ queryKey: ["admin-homepage-sections"] });
    qc.invalidateQueries({ queryKey: ["homepage-section"] });
  }

  async function removeItems(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from("homepage_section_products" as any).delete().in("id", ids);
    if (error) return toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    refetchItems();
    qc.invalidateQueries({ queryKey: ["homepage-section"] });
  }

  async function move(item: SectionProduct, dir: -1 | 1) {
    const sameSection = (items || []).filter((i) => i.section_key === item.section_key).sort((a, b) => a.position - b.position);
    const idx = sameSection.findIndex((i) => i.id === item.id);
    const swap = sameSection[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("homepage_section_products" as any).update({ position: swap.position }).eq("id", item.id),
      supabase.from("homepage_section_products" as any).update({ position: item.position }).eq("id", swap.id),
    ]);
    refetchItems();
    qc.invalidateQueries({ queryKey: ["homepage-section"] });
  }

  async function addProducts(sectionKey: string, productIds: string[]) {
    if (!productIds.length) return;
    const existing = (items || []).filter((i) => i.section_key === sectionKey);
    let nextPos = existing.length ? Math.max(...existing.map((i) => i.position)) + 1 : 0;
    const toInsert = productIds.map((pid) => ({
      section_key: sectionKey,
      product_id: pid,
      position: nextPos++,
    }));
    const { error } = await supabase.from("homepage_section_products" as any).insert(toInsert);
    if (error) return toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    refetchItems();
    qc.invalidateQueries({ queryKey: ["homepage-section"] });
  }

  const toggleSelection = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInSection = (sectionKey: string, checked: boolean) => {
    const ids = (items || []).filter((i) => i.section_key === sectionKey).map((i) => i.id);
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setConfirmOpen(false);
    if (confirmAction.type === "remove") {
      await removeItems(confirmAction.ids);
    } else {
      await addProducts(confirmAction.sectionKey, confirmAction.ids);
    }
    setConfirmAction(null);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Homepage Sections</h1>
        <p className="text-muted-foreground mt-1">Enable/disable homepage product sections and pick which products appear (in order).</p>
      </div>
      {sections?.map((s) => {
        const sectionItems = (items || []).filter((i) => i.section_key === s.key).sort((a, b) => a.position - b.position);
        const sectionSelectedCount = sectionItems.filter((i) => selectedItemIds.has(i.id)).length;
        const allSectionSelected = sectionItems.length > 0 && sectionSelectedCount === sectionItems.length;
        return (
          <Card key={s.key}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {s.label}
                  {s.is_enabled ? <Badge variant="default">Enabled</Badge> : <Badge variant="secondary">Hidden</Badge>}
                </CardTitle>
                <CardDescription>
                  {sectionItems.length > 0
                    ? `${sectionItems.length} curated products (overrides auto selection)`
                    : "No curated products — section uses automatic selection"}
                </CardDescription>
              </div>
              <Switch checked={s.is_enabled} onCheckedChange={(v) => toggleEnabled(s.key, v)} />
            </CardHeader>
            <CardContent className="space-y-3">
              {sectionItems.length > 0 && (
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSectionSelected}
                      onCheckedChange={(v) => selectAllInSection(s.key, !!v)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {sectionSelectedCount > 0 ? `${sectionSelectedCount} selected` : "Select all"}
                    </span>
                  </div>
                  {sectionSelectedCount > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const ids = sectionItems.filter((i) => selectedItemIds.has(i.id)).map((i) => i.id);
                        setConfirmAction({ type: "remove", sectionKey: s.key, ids, count: ids.length });
                        setConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Remove selected ({sectionSelectedCount})
                    </Button>
                  )}
                </div>
              )}
              <div className="space-y-2">
                {sectionItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 border border-border rounded-lg">
                    <Checkbox
                      checked={selectedItemIds.has(item.id)}
                      onCheckedChange={() => toggleSelection(item.id)}
                    />
                    {item.product?.logo_url ? (
                      <img src={item.product.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-muted" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product?.name || item.product_id}</p>
                      <p className="text-xs text-muted-foreground truncate">/{item.product?.slug}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => move(item, -1)} disabled={idx === 0}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => move(item, 1)} disabled={idx === sectionItems.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setConfirmAction({ type: "remove", sectionKey: s.key, ids: [item.id], count: 1 }); setConfirmOpen(true); }}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <ProductPicker existingIds={sectionItems.map((i) => i.product_id)} onPickMultiple={(ids) => { setConfirmAction({ type: "add", sectionKey: s.key, ids, count: ids.length }); setConfirmOpen(true); }} />
            </CardContent>
          </Card>
        );
      })}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "remove"
                ? `Remove ${confirmAction?.count} product${confirmAction?.count !== 1 ? "s" : ""}?`
                : `Add ${confirmAction?.count} product${confirmAction?.count !== 1 ? "s" : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "remove"
                ? `This will permanently remove ${confirmAction?.count} curated product${confirmAction?.count !== 1 ? "s" : ""} from the section.`
                : `This will add ${confirmAction?.count} product${confirmAction?.count !== 1 ? "s" : ""} to the curated list.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirm}>
              {confirmAction?.type === "remove" ? "Remove" : "Add"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductPicker({ existingIds, onPickMultiple }: { existingIds: string[]; onPickMultiple: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const debounced = useDebounce(search, 250);

  useEffect(() => {
    setSelectedProductIds(new Set());
  }, [debounced]);

  const { data: results } = useQuery({
    queryKey: ["product-picker", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url")
        .ilike("name", `%${debounced}%`)
        .eq("is_active", true)
        .limit(8);
      return data || [];
    },
  });

  const filtered = useMemo(() => (results || []).filter((p: any) => !existingIds.includes(p.id)), [results, existingIds]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    const ids = Array.from(selectedProductIds);
    if (!ids.length) return;
    onPickMultiple(ids);
    setSelectedProductIds(new Set());
    setSearch("");
  };

  return (
    <div className="border-t border-border pt-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products to add..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {filtered.length > 0 && (
        <div className="mt-2 space-y-1">
          {filtered.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center gap-2 w-full p-2 text-left hover:bg-muted rounded-md text-sm"
            >
              <Checkbox
                checked={selectedProductIds.has(p.id)}
                onCheckedChange={() => toggleProduct(p.id)}
              />
              {p.logo_url ? <img src={p.logo_url} alt="" className="h-6 w-6 rounded object-contain bg-muted" /> : <div className="h-6 w-6 rounded bg-muted" />}
              <span className="flex-1 truncate">{p.name}</span>
            </div>
          ))}
          {selectedProductIds.size > 0 && (
            <Button size="sm" className="mt-2 w-full" onClick={addSelected}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add {selectedProductIds.size} selected
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
