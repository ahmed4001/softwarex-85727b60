import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle, Loader2, RefreshCw, Search, Trash2, Pencil, Plus, X, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type EntityType = "product" | "comparison" | "category" | "guide" | "glossary" | "blog";
type SourceFilter = "all" | "ai" | "manual" | "edited";

interface FaqItem { q: string; a: string }

interface FaqRow {
  id: string;
  entity_type: EntityType;
  entity_slug: string;
  items: FaqItem[];
  model: string | null;
  source: string;
  is_edited: boolean;
  edited_by: string | null;
  content_hash: string | null;
  generated_at: string;
  updated_at: string;
}

const ENTITY_TYPES: EntityType[] = ["product", "comparison", "category", "guide", "glossary", "blog"];

const ENTITY_VIEW_PATH: Record<EntityType, string> = {
  product: "/product/",
  comparison: "/compare/",
  category: "/category/",
  guide: "/guides/",
  glossary: "/glossary/",
  blog: "/blog/",
};

export default function AdminFaqCachePage() {
  const queryClient = useQueryClient();

  // filters
  const [entityType, setEntityType] = useState<"all" | EntityType>("all");
  const [slugSearch, setSlugSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [modelSearch, setModelSearch] = useState("");

  // dialogs
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [editItems, setEditItems] = useState<FaqItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<FaqRow | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-faq-cache"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("faq_cache")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FaqRow[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (entityType !== "all" && r.entity_type !== entityType) return false;
      if (slugSearch.trim() && !r.entity_slug.toLowerCase().includes(slugSearch.trim().toLowerCase())) return false;
      if (modelSearch.trim() && !(r.model ?? "").toLowerCase().includes(modelSearch.trim().toLowerCase())) return false;
      if (sourceFilter === "edited" && !r.is_edited) return false;
      if (sourceFilter === "ai" && (r.source !== "ai" || r.is_edited)) return false;
      if (sourceFilter === "manual" && r.source !== "manual") return false;
      return true;
    });
  }, [rows, entityType, slugSearch, modelSearch, sourceFilter]);

  // ----- Save edits -----
  const saveEdits = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("no row");
      const cleaned = editItems
        .map((it) => ({ q: it.q.trim(), a: it.a.trim() }))
        .filter((it) => it.q && it.a);
      if (cleaned.length === 0) throw new Error("At least one FAQ is required");

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("faq_cache")
        .update({
          items: cleaned,
          is_edited: true,
          edited_by: userData.user?.id ?? null,
          source: "manual",
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("FAQs saved");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin-faq-cache"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ----- Delete -----
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("faq_cache").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cached entry deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-faq-cache"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ----- Regenerate (force=true) -----
  async function regenerate(row: FaqRow) {
    setRegenerating(row.id);
    try {
      const context = await loadEntityContext(row.entity_type, row.entity_slug);
      const { data, error } = await supabase.functions.invoke("generate-faq", {
        body: {
          entity_type: row.entity_type,
          entity_slug: row.entity_slug,
          context,
          force: true,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("FAQs regenerated");
      queryClient.invalidateQueries({ queryKey: ["admin-faq-cache"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRegenerating(null);
    }
  }

  function openEditor(row: FaqRow) {
    setEditing(row);
    setEditItems(
      (Array.isArray(row.items) ? row.items : []).map((it) => ({ q: it.q, a: it.a })),
    );
  }

  return (
    <div className="space-y-6">
      <SeoHead title="FAQ Cache — Admin" description="Manage AI-generated FAQ cache" />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" /> FAQ Cache
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated FAQs per page. Edit to override, regenerate to refresh from latest content.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {rows.length} total · {rows.filter((r) => r.is_edited).length} edited
        </Badge>
      </header>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-4 p-4 rounded-xl border border-border bg-card">
        <div>
          <Label className="text-xs">Entity type</Label>
          <Select value={entityType} onValueChange={(v) => setEntityType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Slug contains</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={slugSearch} onChange={(e) => setSlugSearch(e.target.value)} placeholder="notion" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Source</Label>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ai">AI (not edited)</SelectItem>
              <SelectItem value="edited">Edited</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Model contains</Label>
          <Input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="gemini" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No cached FAQs match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left p-3 font-semibold">Entity</th>
                <th className="text-left p-3 font-semibold">Slug</th>
                <th className="text-left p-3 font-semibold">Source</th>
                <th className="text-left p-3 font-semibold">Items</th>
                <th className="text-left p-3 font-semibold">Model</th>
                <th className="text-left p-3 font-semibold">Generated</th>
                <th className="text-right p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs capitalize">{r.entity_type}</Badge>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    <a
                      href={`${ENTITY_VIEW_PATH[r.entity_type]}${r.entity_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary inline-flex items-center gap-1"
                    >
                      {r.entity_slug}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  </td>
                  <td className="p-3">
                    {r.is_edited ? (
                      <Badge className="text-xs bg-primary/10 text-primary border-0">edited</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">{r.source}</Badge>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{Array.isArray(r.items) ? r.items.length : 0}</td>
                  <td className="p-3 text-xs text-muted-foreground truncate max-w-[180px]">{r.model ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(r.generated_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditor(r)} title="Edit FAQs">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => regenerate(r)}
                        disabled={regenerating === r.id}
                        title="Regenerate from latest content"
                      >
                        {regenerating === r.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(r)}
                        title="Delete cached entry"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit FAQs — {editing?.entity_type}/{editing?.entity_slug}
            </DialogTitle>
            <DialogDescription>
              Saving marks this entry as <strong>edited</strong>; future content drift will not auto-regenerate it.
              Use Regenerate to opt back into AI refresh.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editItems.map((it, i) => (
              <div key={i} className="p-4 rounded-lg border border-border space-y-2 relative">
                <button
                  onClick={() => setEditItems((s) => s.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
                <div>
                  <Label className="text-xs">Question</Label>
                  <Input
                    value={it.q}
                    onChange={(e) =>
                      setEditItems((s) => s.map((x, idx) => (idx === i ? { ...x, q: e.target.value } : x)))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Answer</Label>
                  <Textarea
                    value={it.a}
                    rows={3}
                    onChange={(e) =>
                      setEditItems((s) => s.map((x, idx) => (idx === i ? { ...x, a: e.target.value } : x)))
                    }
                  />
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditItems((s) => [...s, { q: "", a: "" }])}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Add FAQ
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => saveEdits.mutate()} disabled={saveEdits.isPending}>
              {saveEdits.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cached FAQs?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.entity_type}/{deleteTarget?.entity_slug} — the next page view will regenerate fresh FAQs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && del.mutate(deleteTarget.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Reload the upstream entity so regenerate has the latest context.
 * Falls back to slug-only context if the entity row can't be fetched.
 */
async function loadEntityContext(type: EntityType, slug: string) {
  const sb = supabase as any;
  try {
    if (type === "product") {
      const { data } = await sb.from("products")
        .select("name, tagline, description, categories:category_id(name)").eq("slug", slug).maybeSingle();
      if (data) return { name: data.name, description: data.tagline || data.description, category: data.categories?.name };
    } else if (type === "comparison") {
      const { data } = await sb.from("comparisons").select("title, summary, winner_verdict").eq("slug", slug).maybeSingle();
      if (data) return { name: data.title, description: data.summary || data.winner_verdict };
    } else if (type === "category") {
      const { data } = await sb.from("categories").select("name, description").eq("slug", slug).maybeSingle();
      if (data) return { name: data.name, description: data.description };
    } else if (type === "guide") {
      const { data } = await sb.from("buyer_guides")
        .select("title, description, categories:category_id(name)").eq("slug", slug).maybeSingle();
      if (data) return { name: data.title, description: data.description, category: data.categories?.name };
    } else if (type === "glossary") {
      const { data } = await sb.from("glossary_terms").select("term, definition, category").eq("slug", slug).maybeSingle();
      if (data) return { name: data.term, description: data.definition, category: data.category };
    } else if (type === "blog") {
      const { data } = await sb.from("blog_posts").select("title, excerpt, seo_description, category").eq("slug", slug).maybeSingle();
      if (data) return { name: data.title, description: data.excerpt || data.seo_description, category: data.category };
    }
  } catch { /* fall through */ }
  return { name: slug };
}
