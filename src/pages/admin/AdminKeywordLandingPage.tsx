import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type PageType = "keyword" | "feature" | "use_case" | "industry" | "template";

const PATH_PREFIX: Record<PageType, string> = {
  keyword: "",
  feature: "/features",
  use_case: "/use-cases",
  industry: "/industry",
  template: "/templates",
};

const emptyForm = {
  id: "" as string | undefined,
  page_type: "keyword" as PageType,
  slug: "",
  h1: "",
  meta_title: "",
  meta_description: "",
  focus_keyword: "",
  hero_body: "",
  sections: "[]",
  faq: "[]",
  primary_product_id: "",
  related_product_ids: "[]",
  canonical_override: "",
  is_published: false,
};

export default function AdminKeywordLandingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin-keyword-landings"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("keyword_landing_pages")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Detect duplicate focus keywords across commercial pages
  const duplicates = new Set<string>();
  const seen = new Map<string, number>();
  pages.forEach((p: any) => {
    if (!p.focus_keyword) return;
    const k = p.focus_keyword.toLowerCase().trim();
    seen.set(k, (seen.get(k) || 0) + 1);
  });
  seen.forEach((count, k) => { if (count > 1) duplicates.add(k); });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: any = {
        page_type: form.page_type,
        slug: form.slug.trim(),
        h1: form.h1.trim(),
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        focus_keyword: form.focus_keyword || null,
        hero_body: form.hero_body || null,
        sections: safeJson(form.sections, []),
        faq: safeJson(form.faq, []),
        primary_product_id: form.primary_product_id || null,
        related_product_ids: safeJson(form.related_product_ids, []),
        canonical_override: form.canonical_override || null,
        is_published: form.is_published,
      };
      if (form.id) {
        const { error } = await (supabase as any).from("keyword_landing_pages").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("keyword_landing_pages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["admin-keyword-landings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await (supabase as any).from("keyword_landing_pages").update({ is_published: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-keyword-landings"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("keyword_landing_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-keyword-landings"] });
    },
  });

  const openEdit = (p: any) => {
    setForm({
      id: p.id,
      page_type: p.page_type,
      slug: p.slug,
      h1: p.h1,
      meta_title: p.meta_title || "",
      meta_description: p.meta_description || "",
      focus_keyword: p.focus_keyword || "",
      hero_body: p.hero_body || "",
      sections: JSON.stringify(p.sections || [], null, 2),
      faq: JSON.stringify(p.faq || [], null, 2),
      primary_product_id: p.primary_product_id || "",
      related_product_ids: JSON.stringify(p.related_product_ids || [], null, 2),
      canonical_override: p.canonical_override || "",
      is_published: p.is_published,
    });
    setOpen(true);
  };

  return (
    <>
      <SeoHead title="Keyword Landing Pages - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Keyword Landing Pages</h1>
            <p className="text-muted-foreground text-sm">
              {pages.length} pages · Apploye-style root SEO + programmatic features/use-cases/industry/templates
            </p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> New page
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : pages.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No pages yet. Create one to start ranking.</div>
        ) : (
          <div className="space-y-3">
            {pages.map((p: any) => {
              const isDupe = p.focus_keyword && duplicates.has(p.focus_keyword.toLowerCase().trim());
              const path = `${PATH_PREFIX[p.page_type as PageType] || ""}/${p.slug}`;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(p)}>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{p.h1}</p>
                        <Badge variant="secondary" className="text-[10px]">{p.page_type}</Badge>
                        {isDupe && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> dupe keyword
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{path}</span>
                        {p.focus_keyword && <span>· kw: {p.focus_keyword}</span>}
                        <span>· {p.view_count} views</span>
                      </div>
                    </div>
                    <Switch checked={p.is_published} onCheckedChange={(v) => togglePublish.mutate({ id: p.id, value: v })} />
                    <Link to={path} target="_blank">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-3.5 w-3.5" /></Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del.mutate(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} landing page</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.page_type} onValueChange={(v) => setForm({ ...form, page_type: v as PageType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keyword">keyword (root /slug)</SelectItem>
                    <SelectItem value="feature">feature (/features/:slug)</SelectItem>
                    <SelectItem value="use_case">use_case (/use-cases/:slug)</SelectItem>
                    <SelectItem value="industry">industry (/industry/:slug)</SelectItem>
                    <SelectItem value="template">template (/templates/:slug)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="employee-monitoring-software" />
              </div>
            </div>
            <div>
              <Label>H1</Label>
              <Input value={form.h1} onChange={(e) => setForm({ ...form, h1: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Meta title</Label>
                <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} />
              </div>
              <div>
                <Label>Focus keyword</Label>
                <Input value={form.focus_keyword} onChange={(e) => setForm({ ...form, focus_keyword: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Meta description</Label>
              <Textarea rows={2} value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} />
            </div>
            <div>
              <Label>Hero body (markdown)</Label>
              <Textarea rows={4} value={form.hero_body} onChange={(e) => setForm({ ...form, hero_body: e.target.value })} />
            </div>
            <div>
              <Label>Sections (JSON array of {`{heading, body, bullets?}`})</Label>
              <Textarea rows={6} className="font-mono text-xs" value={form.sections} onChange={(e) => setForm({ ...form, sections: e.target.value })} />
            </div>
            <div>
              <Label>FAQ (JSON array of {`{q, a}`})</Label>
              <Textarea rows={4} className="font-mono text-xs" value={form.faq} onChange={(e) => setForm({ ...form, faq: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Primary product ID</Label>
                <Input value={form.primary_product_id} onChange={(e) => setForm({ ...form, primary_product_id: e.target.value })} placeholder="uuid" />
              </div>
              <div>
                <Label>Canonical override (optional)</Label>
                <Input value={form.canonical_override} onChange={(e) => setForm({ ...form, canonical_override: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Related product IDs (JSON array of uuids)</Label>
              <Textarea rows={2} className="font-mono text-xs" value={form.related_product_ids} onChange={(e) => setForm({ ...form, related_product_ids: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              <Label>Published</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.slug || !form.h1}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}
