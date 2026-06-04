import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Star, TrendingUp, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type Deal = {
  id: string;
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
};

const blankDeal: Partial<Deal> = {
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

  const { data: deals = [] } = useQuery({
    queryKey: ["admin-deals"],
    queryFn: async () => {
      const { data } = await supabase.from("deals" as any).select("*").order("created_at", { ascending: false });
      return (data ?? []) as unknown as Deal[];
    },
  });

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deals</h1>
          <p className="text-muted-foreground">Manage software deals and coupons</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Deal</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Deals ({deals.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 px-2">Product</th>
                  <th className="py-2 px-2">Discount</th>
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2">Ends</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-muted/40">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {d.logo_url && <img src={d.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-muted" />}
                        <div>
                          <div className="font-medium">{d.product_name}</div>
                          <div className="text-xs text-muted-foreground">{d.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">{d.discount_amount ? `${d.discount_amount}${d.discount_type === "percent" ? "%" : ""}` : "—"}</td>
                    <td className="py-3 px-2">{d.category || "—"}</td>
                    <td className="py-3 px-2">{d.end_date ? new Date(d.end_date).toLocaleDateString() : "—"}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1 flex-wrap">
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
                        <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && del.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {deals.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No deals yet</td></tr>
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
              <div className="flex gap-6 pt-2">
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
