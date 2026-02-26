import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Search, Trash2, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminGlossaryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [form, setForm] = useState({ term: "", slug: "", definition: "", extended_description: "", category: "", is_published: false });

  const { data: terms = [], isLoading } = useQuery({
    queryKey: ["admin-glossary"],
    queryFn: async () => {
      const { data } = await supabase.from("glossary_terms").select("*").order("term");
      return data || [];
    },
  });

  const filtered = search.trim() ? terms.filter((t: any) => t.term.toLowerCase().includes(search.toLowerCase())) : terms;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("glossary_terms").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("glossary_terms").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-glossary"] });
      setEditorOpen(false);
      setEditing(null);
      toast.success(editing ? "Term updated" : "Term created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("glossary_terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-glossary"] });
      setDeleteTarget(null);
      toast.success("Term deleted");
    },
  });

  const openEditor = (term?: any) => {
    if (term) {
      setEditing(term);
      setForm({ term: term.term, slug: term.slug, definition: term.definition, extended_description: term.extended_description || "", category: term.category || "", is_published: term.is_published });
    } else {
      setEditing(null);
      setForm({ term: "", slug: "", definition: "", extended_description: "", category: "", is_published: false });
    }
    setEditorOpen(true);
  };

  return (
    <>
      <SeoHead title="Glossary — Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-6 w-6" /> Glossary</h1>
            <p className="text-muted-foreground">{terms.length} terms</p>
          </div>
          <Button className="gap-1" onClick={() => openEditor()}><Plus className="h-4 w-4" /> Add Term</Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search terms..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="product-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Term</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Category</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t: any) => (
                <tr key={t.id} className="admin-table-row">
                  <td className="px-4 py-3"><span className="text-sm font-medium text-foreground">{t.term}</span></td>
                  <td className="px-4 py-3">{t.category && <Badge variant="secondary" className="text-xs">{t.category}</Badge>}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={t.is_published ? "default" : "outline"} className="text-xs">{t.is_published ? "Published" : "Draft"}</Badge></td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(t)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No terms found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Term" : "Add Term"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Term</Label><Input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value, slug: editing ? form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })} /></div>
            <div className="space-y-2"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            <div className="space-y-2"><Label>Definition</Label><Textarea value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Extended Description (HTML)</Label><Textarea value={form.extended_description} onChange={(e) => setForm({ ...form, extended_description: e.target.value })} rows={4} /></div>
            <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Cloud Computing" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} /><Label>Published</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.term || !form.slug || !form.definition || saveMutation.isPending} className="gap-1">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Term</AlertDialogTitle><AlertDialogDescription>Delete "{deleteTarget?.term}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
