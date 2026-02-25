import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Megaphone, Eye, MousePointer, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Ad = {
  id: string;
  name: string;
  type: "banner" | "sidebar" | "featured_slot";
  placement: "homepage" | "category" | "product" | "blog";
  target_url: string | null;
  image_url: string | null;
  alt_text: string | null;
  is_active: boolean | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
};

type AdType = "banner" | "sidebar" | "featured_slot";
type AdPlacement = "homepage" | "category" | "product" | "blog";

const EMPTY_AD: {
  id?: string;
  name: string;
  type: AdType;
  placement: AdPlacement;
  target_url: string;
  image_url: string;
  alt_text: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
} = {
  name: "",
  type: "banner",
  placement: "homepage",
  target_url: "",
  image_url: "",
  alt_text: "",
  is_active: true,
  start_date: "",
  end_date: "",
};

export default function AdminAdsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<typeof EMPTY_AD & { id?: string }>(EMPTY_AD);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("advertisements")
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as Ad[];
    },
  });

  const filtered = search.trim()
    ? ads.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : ads;

  const saveMutation = useMutation({
    mutationFn: async (ad: typeof editingAd) => {
      const payload = {
        name: ad.name,
        type: ad.type as any,
        placement: ad.placement as any,
        target_url: ad.target_url || null,
        image_url: ad.image_url || null,
        alt_text: ad.alt_text || null,
        is_active: ad.is_active,
        start_date: ad.start_date || null,
        end_date: ad.end_date || null,
      };
      if (ad.id) {
        const { error } = await supabase.from("advertisements").update(payload).eq("id", ad.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("advertisements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      setEditorOpen(false);
      toast.success(editingAd.id ? "Ad updated" : "Ad created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("advertisements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      setDeleteTarget(null);
      toast.success("Ad deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("advertisements").update({ is_active: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-ads"] }),
  });

  const openEditor = (ad?: Ad) => {
    if (ad) {
      setEditingAd({
        id: ad.id,
        name: ad.name,
        type: ad.type,
        placement: ad.placement,
        target_url: ad.target_url || "",
        image_url: ad.image_url || "",
        alt_text: ad.alt_text || "",
        is_active: ad.is_active ?? true,
        start_date: ad.start_date || "",
        end_date: ad.end_date || "",
      });
    } else {
      setEditingAd({ ...EMPTY_AD });
    }
    setEditorOpen(true);
  };

  const placementColor = (p: string) => {
    switch (p) {
      case "homepage": return "default";
      case "category": return "secondary";
      case "product": return "outline";
      default: return "outline";
    }
  };

  const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";

  return (
    <>
      <SeoHead title="Advertisements - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Advertisements</h1>
            <p className="text-muted-foreground">{ads.length} ads · {totalImpressions.toLocaleString()} impressions · {avgCtr}% CTR</p>
          </div>
          <Button className="gap-1" onClick={() => openEditor()}>
            <Plus className="h-4 w-4" /> New Ad
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Ads", value: ads.length, icon: Megaphone },
            { label: "Active", value: ads.filter((a) => a.is_active).length, icon: Eye },
            { label: "Total Impressions", value: totalImpressions.toLocaleString(), icon: Eye },
            { label: "Total Clicks", value: totalClicks.toLocaleString(), icon: MousePointer },
          ].map((s) => (
            <div key={s.label} className="product-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search ads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Ads Table */}
        <div className="product-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Placement</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Impressions</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Clicks</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">CTR</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Active</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ad) => (
                  <tr key={ad.id} className="admin-table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {ad.image_url ? (
                          <div className="h-9 w-16 rounded bg-muted overflow-hidden flex-shrink-0">
                            <img src={ad.image_url} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-9 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Megaphone className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-foreground">{ad.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] capitalize">{ad.type.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={placementColor(ad.placement) as any} className="text-[10px] capitalize">{ad.placement}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{(ad.impressions || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{(ad.clicks || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {ad.impressions ? ((ad.clicks || 0) / ad.impressions * 100).toFixed(1) + "%" : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={ad.is_active ?? false} onCheckedChange={(v) => toggleMutation.mutate({ id: ad.id, value: v })} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(ad)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ id: ad.id, name: ad.name })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No ads found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAd.id ? "Edit Ad" : "New Ad"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={editingAd.name} onChange={(e) => setEditingAd({ ...editingAd, name: e.target.value })} placeholder="Ad campaign name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={editingAd.type} onValueChange={(v) => setEditingAd({ ...editingAd, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                    <SelectItem value="featured_slot">Featured Slot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placement</Label>
                <Select value={editingAd.placement} onValueChange={(v) => setEditingAd({ ...editingAd, placement: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homepage">Homepage</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="blog">Blog</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Target URL</Label>
              <Input value={editingAd.target_url} onChange={(e) => setEditingAd({ ...editingAd, target_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input value={editingAd.image_url} onChange={(e) => setEditingAd({ ...editingAd, image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Alt Text</Label>
              <Input value={editingAd.alt_text} onChange={(e) => setEditingAd({ ...editingAd, alt_text: e.target.value })} placeholder="Descriptive alt text" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={editingAd.start_date} onChange={(e) => setEditingAd({ ...editingAd, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={editingAd.end_date} onChange={(e) => setEditingAd({ ...editingAd, end_date: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editingAd.is_active} onCheckedChange={(v) => setEditingAd({ ...editingAd, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(editingAd)} disabled={!editingAd.name || saveMutation.isPending}>
              {editingAd.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ad</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
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
    </>
  );
}
