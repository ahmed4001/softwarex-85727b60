import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FileText, Search, Eye, Globe } from "lucide-react";
import { toast } from "sonner";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  is_active: boolean | null;
  show_in_nav: boolean | null;
  show_in_footer: boolean | null;
  seo_title: string | null;
  seo_description: string | null;
  template: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const EMPTY_PAGE = {
  title: "",
  slug: "",
  body: "",
  is_active: true,
  show_in_nav: false,
  show_in_footer: false,
  seo_title: "",
  seo_description: "",
};

export default function AdminPagesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<typeof EMPTY_PAGE & { id?: string }>(EMPTY_PAGE);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin-pages"],
    queryFn: async () => {
      const { data } = await supabase.from("pages").select("*").order("created_at", { ascending: false });
      return (data || []) as PageRow[];
    },
  });

  const filtered = search.trim()
    ? pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : pages;

  const saveMutation = useMutation({
    mutationFn: async (page: typeof editingPage) => {
      const payload = {
        title: page.title,
        slug: page.slug || page.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        body: page.body || null,
        is_active: page.is_active,
        show_in_nav: page.show_in_nav,
        show_in_footer: page.show_in_footer,
        seo_title: page.seo_title || null,
        seo_description: page.seo_description || null,
      };
      if (page.id) {
        const { error } = await supabase.from("pages").update(payload).eq("id", page.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      setEditorOpen(false);
      toast.success(editingPage.id ? "Page updated" : "Page created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      setDeleteTarget(null);
      toast.success("Page deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const openEditor = (page?: PageRow) => {
    if (page) {
      setEditingPage({
        id: page.id,
        title: page.title,
        slug: page.slug,
        body: page.body || "",
        is_active: page.is_active ?? true,
        show_in_nav: page.show_in_nav ?? false,
        show_in_footer: page.show_in_footer ?? false,
        seo_title: page.seo_title || "",
        seo_description: page.seo_description || "",
      });
    } else {
      setEditingPage({ ...EMPTY_PAGE });
    }
    setEditorOpen(true);
  };

  return (
    <>
      <SeoHead title="Pages - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pages</h1>
            <p className="text-muted-foreground">{pages.length} static pages</p>
          </div>
          <Button className="gap-1" onClick={() => openEditor()}>
            <Plus className="h-4 w-4" /> New Page
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search pages..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="product-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Title</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Slug</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Nav</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Footer</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((page) => (
                <tr key={page.id} className="admin-table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{page.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">/{page.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={page.is_active ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {page.show_in_nav ? <Globe className="h-3.5 w-3.5 text-primary mx-auto" /> : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {page.show_in_footer ? <Globe className="h-3.5 w-3.5 text-primary mx-auto" /> : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(page)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ id: page.id, title: page.title })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No pages found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage.id ? "Edit Page" : "New Page"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={editingPage.title} onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={editingPage.slug} onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })} placeholder="auto-generated" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Body (HTML)</Label>
              <Textarea value={editingPage.body} onChange={(e) => setEditingPage({ ...editingPage, body: e.target.value })} rows={10} placeholder="Page content..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>SEO Title</Label>
                <Input value={editingPage.seo_title} onChange={(e) => setEditingPage({ ...editingPage, seo_title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>SEO Description</Label>
                <Input value={editingPage.seo_description} onChange={(e) => setEditingPage({ ...editingPage, seo_description: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={editingPage.is_active} onCheckedChange={(v) => setEditingPage({ ...editingPage, is_active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingPage.show_in_nav} onCheckedChange={(v) => setEditingPage({ ...editingPage, show_in_nav: v })} />
                <Label>Show in Nav</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingPage.show_in_footer} onCheckedChange={(v) => setEditingPage({ ...editingPage, show_in_footer: v })} />
                <Label>Show in Footer</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(editingPage)} disabled={!editingPage.title || saveMutation.isPending}>
              {editingPage.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.
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
