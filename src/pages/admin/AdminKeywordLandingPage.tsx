import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, ExternalLink, AlertTriangle, Sparkles, RefreshCw, Clock, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { SeoErrorBoard, SocialPreview, type FixAction } from "@/components/admin/SeoErrorBoard";
import { SeoHighlights } from "@/components/admin/SeoHighlights";
import { RichTextEditor } from "@/components/RichTextEditor";

type PageType = "keyword" | "feature" | "use_case" | "industry" | "template";
type Status = "draft" | "in_progress" | "ready" | "published" | "needs_update";
type Intent = "high" | "medium" | "low";

const PATH_PREFIX: Record<PageType, string> = {
  keyword: "",
  feature: "/features",
  use_case: "/use-cases",
  industry: "/industry",
  template: "/templates",
};

const STATUS_COLORS: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ready: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  needs_update: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

const INTENT_COLORS: Record<Intent, string> = {
  high: "bg-primary/15 text-primary",
  medium: "bg-muted text-muted-foreground",
  low: "bg-muted/50 text-muted-foreground",
};

const TEMPLATE_SECTIONS = [
  { heading: "The Problem", body: "", bullets: [] as string[] },
  { heading: "The Solution", body: "", bullets: [] as string[] },
  { heading: "Key Features", body: "", bullets: [] as string[] },
  { heading: "How It Works", body: "", bullets: [] as string[] },
  { heading: "Benefits", body: "", bullets: [] as string[] },
  { heading: "Who Uses It", body: "", bullets: [] as string[] },
  { heading: "Get Started", body: "", bullets: [] as string[] },
];

interface FormState {
  id?: string;
  page_type: PageType;
  status: Status;
  intent: Intent;
  category: string;
  slug: string;
  h1: string;
  meta_title: string;
  meta_description: string;
  focus_keyword: string;
  hero_body: string;
  excerpt: string;
  featured_image: string;
  sections: { heading: string; body: string; bullets: string[] }[];
  faq: { q: string; a: string }[];
  related_keywords: string[];
  internal_links: { label: string; href: string }[];
  primary_product_id: string;
  related_product_ids: string;
  canonical_override: string;
}

const emptyForm = (): FormState => ({
  page_type: "keyword",
  status: "draft",
  intent: "medium",
  category: "",
  slug: "",
  h1: "",
  meta_title: "",
  meta_description: "",
  focus_keyword: "",
  hero_body: "",
  excerpt: "",
  featured_image: "",
  sections: TEMPLATE_SECTIONS.map((s) => ({ ...s, bullets: [...s.bullets] })),
  faq: [{ q: "", a: "" }],
  related_keywords: [],
  internal_links: [],
  primary_product_id: "",
  related_product_ids: "[]",
  canonical_override: "",
});

const STALE_DAYS = 60;

export default function AdminKeywordLandingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [filterIntent, setFilterIntent] = useState<Intent | "all">("all");
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin-keyword-landings"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("keyword_landing_pages")
        .select("*")
        .order("updated_at", { ascending: false });
      return data || [];
    },
  });

  // Mark "needs_update" if published > STALE_DAYS ago and not flagged
  const enrichedPages = useMemo(() => {
    const now = Date.now();
    return pages.map((p: any) => {
      const reviewed = p.last_reviewed_at ? new Date(p.last_reviewed_at).getTime() : null;
      const stale = p.status === "published" && reviewed && now - reviewed > STALE_DAYS * 24 * 3600 * 1000;
      return { ...p, _stale: !!stale };
    });
  }, [pages]);

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    pages.forEach((p: any) => {
      if (!p.focus_keyword) return;
      const k = p.focus_keyword.toLowerCase().trim();
      seen.set(k, (seen.get(k) || 0) + 1);
    });
    const set = new Set<string>();
    seen.forEach((c, k) => c > 1 && set.add(k));
    return set;
  }, [pages]);

  const filtered = enrichedPages.filter((p: any) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterIntent !== "all" && p.intent !== filterIntent) return false;
    if (search && !`${p.h1} ${p.slug} ${p.focus_keyword || ""} ${p.category || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: enrichedPages.length, draft: 0, in_progress: 0, ready: 0, published: 0, needs_update: 0 };
    enrichedPages.forEach((p: any) => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [enrichedPages]);

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: any = {
        page_type: form.page_type,
        status: form.status,
        intent: form.intent,
        category: form.category || null,
        slug: form.slug.trim(),
        h1: form.h1.trim(),
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        focus_keyword: form.focus_keyword || null,
        hero_body: form.hero_body || null,
        excerpt: form.excerpt || null,
        featured_image: form.featured_image || null,
        sections: form.sections,
        faq: form.faq.filter((f) => f.q || f.a),
        related_keywords: form.related_keywords,
        internal_links: form.internal_links,
        primary_product_id: form.primary_product_id || null,
        related_product_ids: safeJson(form.related_product_ids, []),
        canonical_override: form.canonical_override || null,
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
      setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["admin-keyword-landings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const patch: any = { status };
      if (status === "published") patch.last_reviewed_at = new Date().toISOString();
      const { error } = await (supabase as any).from("keyword_landing_pages").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-keyword-landings"] }),
  });

  const refreshReviewed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("keyword_landing_pages")
        .update({ last_reviewed_at: new Date().toISOString(), status: "published" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked as just-reviewed"); qc.invalidateQueries({ queryKey: ["admin-keyword-landings"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("keyword_landing_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-keyword-landings"] }); },
  });

  const openEdit = (p: any) => {
    const sections = Array.isArray(p.sections) && p.sections.length > 0
      ? p.sections.map((s: any) => ({ heading: s.heading || "", body: s.body || "", bullets: Array.isArray(s.bullets) ? s.bullets : [] }))
      : TEMPLATE_SECTIONS.map((s) => ({ ...s, bullets: [...s.bullets] }));
    setForm({
      id: p.id,
      page_type: p.page_type,
      status: p.status || "draft",
      intent: p.intent || "medium",
      category: p.category || "",
      slug: p.slug,
      h1: p.h1,
      meta_title: p.meta_title || "",
      meta_description: p.meta_description || "",
      focus_keyword: p.focus_keyword || "",
      hero_body: p.hero_body || "",
      excerpt: p.excerpt || "",
      featured_image: p.featured_image || "",
      sections,
      faq: Array.isArray(p.faq) && p.faq.length ? p.faq : [{ q: "", a: "" }],
      related_keywords: Array.isArray(p.related_keywords) ? p.related_keywords : [],
      internal_links: Array.isArray(p.internal_links) ? p.internal_links : [],
      primary_product_id: p.primary_product_id || "",
      related_product_ids: JSON.stringify(p.related_product_ids || [], null, 2),
      canonical_override: p.canonical_override || "",
    });
    setOpen(true);
  };

  const generate = async () => {
    if (!form.focus_keyword) { toast.error("Add a focus keyword first"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-keyword-page", {
        body: { keyword: form.focus_keyword, category: form.category || undefined },
      });
      if (error) throw error;
      const c: any = data;
      setForm({
        ...form,
        h1: c.h1 || form.h1,
        meta_title: c.meta_title || form.meta_title,
        meta_description: c.meta_description || form.meta_description,
        hero_body: c.hero_body || form.hero_body,
        sections: Array.isArray(c.sections) && c.sections.length ? c.sections : form.sections,
        faq: Array.isArray(c.faq) && c.faq.length ? c.faq : form.faq,
        related_keywords: Array.isArray(c.related_keywords) ? c.related_keywords : form.related_keywords,
        status: form.status === "draft" ? "ready" : form.status,
      });
      toast.success("Content generated — review and save");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const updateSection = (i: number, patch: Partial<FormState["sections"][number]>) => {
    const next = [...form.sections];
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, sections: next });
  };

  const updateFaq = (i: number, patch: Partial<{ q: string; a: string }>) => {
    const next = [...form.faq];
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, faq: next });
  };

  return (
    <>
      <SeoHead title="SEO Landing Pages — Admin" description="Programmatic SEO landing page management" />
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">SEO Landing Pages</h1>
            <p className="text-muted-foreground text-sm">
              Programmatic keyword landing pages · 8-section template · pipeline + 60-day refresh
            </p>
          </div>
          <Button onClick={() => { setForm(emptyForm()); setOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> New page
          </Button>
        </div>

        {/* Pipeline tabs */}
        <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <TabsList className="flex-wrap h-auto">
            {(["all", "draft", "in_progress", "ready", "published", "needs_update"] as const).map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize gap-2">
                {s.replace("_", " ")} <span className="text-xs opacity-60">{counts[s] || 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-wrap">
          <Input placeholder="Search keyword, slug, category…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={filterIntent} onValueChange={(v) => setFilterIntent(v as any)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Intent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All intents</SelectItem>
              <SelectItem value="high">High intent</SelectItem>
              <SelectItem value="medium">Medium intent</SelectItem>
              <SelectItem value="low">Low intent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No pages match filters.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p: any) => {
              const isDupe = p.focus_keyword && duplicates.has(p.focus_keyword.toLowerCase().trim());
              const path = `${PATH_PREFIX[p.page_type as PageType] || ""}/${p.slug}`;
              const status: Status = p._stale ? "needs_update" : p.status;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(p)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{p.h1}</p>
                        <Badge variant="outline" className="text-[10px]">{p.page_type}</Badge>
                        <Badge className={`text-[10px] ${INTENT_COLORS[p.intent as Intent] || ""}`} variant="secondary">{p.intent} intent</Badge>
                        {isDupe && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> dupe keyword
                          </Badge>
                        )}
                        {p._stale && (
                          <Badge className="text-[10px] gap-1 bg-rose-500/15 text-rose-700 dark:text-rose-400" variant="secondary">
                            <Clock className="h-3 w-3" /> 60d+ stale
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">{path}</span>
                        {p.focus_keyword && <span>· kw: {p.focus_keyword}</span>}
                        {p.category && <span>· {p.category}</span>}
                        <span>· {p.view_count} views</span>
                      </div>
                    </div>
                    <Select value={p.status} onValueChange={(v) => setStatus.mutate({ id: p.id, status: v as Status })}>
                      <SelectTrigger className={`w-36 h-8 text-xs ${STATUS_COLORS[status]}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="needs_update">Needs update</SelectItem>
                      </SelectContent>
                    </Select>
                    {p._stale && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Mark reviewed" onClick={() => refreshReviewed.mutate(p.id)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Link to={path} target="_blank">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-3.5 w-3.5" /></Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this landing page?")) del.mutate(p.id); }}>
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
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.id ? "Edit" : "New"} SEO landing page
              <Badge className={STATUS_COLORS[form.status]} variant="secondary">{form.status.replace("_", " ")}</Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="meta">
            <TabsList>
              <TabsTrigger value="meta">Metadata</TabsTrigger>
              <TabsTrigger value="content">Content (8 sections)</TabsTrigger>
              <TabsTrigger value="faq">FAQ</TabsTrigger>
              <TabsTrigger value="links">Internal links</TabsTrigger>
              <TabsTrigger value="seo">SEO Score</TabsTrigger>
            </TabsList>

            <TabsContent value="meta" className="grid gap-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
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
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="needs_update">Needs update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Intent</Label>
                  <Select value={form.intent} onValueChange={(v) => setForm({ ...form, intent: v as Intent })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Focus keyword *</Label>
                  <Input value={form.focus_keyword} onChange={(e) => setForm({ ...form, focus_keyword: e.target.value })} placeholder="employee monitoring software" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Time Tracking" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Slug *</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="employee-monitoring-software" />
                </div>
                <div>
                  <Label>Primary product ID</Label>
                  <Input value={form.primary_product_id} onChange={(e) => setForm({ ...form, primary_product_id: e.target.value })} placeholder="uuid" />
                </div>
              </div>
              <div>
                <Label>H1 *</Label>
                <Input value={form.h1} onChange={(e) => setForm({ ...form, h1: e.target.value })} />
              </div>
              <div>
                <Label>Meta title</Label>
                <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">{form.meta_title.length}/60 chars</p>
              </div>
              <div>
                <Label>Meta description</Label>
                <Textarea rows={2} value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">{form.meta_description.length}/160 chars</p>
              </div>
              <div>
                <Label>Related keywords (comma-separated)</Label>
                <Input
                  value={form.related_keywords.join(", ")}
                  onChange={(e) => setForm({ ...form, related_keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Canonical override</Label>
                  <Input value={form.canonical_override} onChange={(e) => setForm({ ...form, canonical_override: e.target.value })} />
                </div>
                <div>
                  <Label>Related product IDs (JSON)</Label>
                  <Input className="font-mono text-xs" value={form.related_product_ids} onChange={(e) => setForm({ ...form, related_product_ids: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="content" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">8-section template — Problem → Solution → Features → How → Benefits → Use cases → CTA</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={generate} disabled={generating || !form.focus_keyword}>
                  <Sparkles className="h-3.5 w-3.5" /> {generating ? "Generating…" : "AI generate"}
                </Button>
              </div>
              {/* Custom excerpt */}
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                placeholder="Add a custom excerpt…"
                rows={1}
                className="w-full text-base text-muted-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40 resize-none"
              />

              {/* Featured image (upload or URL) */}
              {form.featured_image ? (
                <div className="relative rounded-xl overflow-hidden group border border-border">
                  <img src={form.featured_image} alt="Feature" className="w-full h-auto" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, featured_image: "" })}
                    className="absolute top-3 right-3 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-6 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingImage(true);
                        try {
                          const ext = file.name.split(".").pop() || "png";
                          const path = `keyword-pages/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                          const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
                          if (error) throw error;
                          const { data } = supabase.storage.from("product-images").getPublicUrl(path);
                          setForm((f) => ({ ...f, featured_image: data.publicUrl }));
                          toast.success("Image uploaded");
                        } catch (err: any) {
                          toast.error(err.message || "Upload failed");
                        } finally {
                          setUploadingImage(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">{uploadingImage ? "Uploading…" : "Upload feature image"}</span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = window.prompt("Or paste image URL:");
                      if (url) setForm({ ...form, featured_image: url });
                    }}
                  >
                    Use URL
                  </Button>
                </div>
              )}

              {/* Hero body — rich editor */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hero body</Label>
                <RichTextEditor
                  value={form.hero_body}
                  onChange={(html) => setForm({ ...form, hero_body: html })}
                  placeholder="Write your hero introduction…"
                  className="min-h-[260px] bg-transparent mt-2"
                />
              </div>
              {form.sections.map((s, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <Input value={s.heading} onChange={(e) => updateSection(i, { heading: e.target.value })} className="font-semibold" />
                    <Textarea rows={2} placeholder="Body (markdown)" value={s.body} onChange={(e) => updateSection(i, { body: e.target.value })} />
                    <Textarea
                      rows={3}
                      placeholder="Bullets (one per line)"
                      value={s.bullets.join("\n")}
                      onChange={(e) => updateSection(i, { bullets: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
                    />
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="faq" className="mt-4 space-y-3">
              {form.faq.map((f, i) => (
                <Card key={i}>
                  <CardContent className="p-3 space-y-2">
                    <Input placeholder="Question" value={f.q} onChange={(e) => updateFaq(i, { q: e.target.value })} />
                    <Textarea rows={2} placeholder="Answer" value={f.a} onChange={(e) => updateFaq(i, { a: e.target.value })} />
                    <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => setForm({ ...form, faq: form.faq.filter((_, j) => j !== i) })}>
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, faq: [...form.faq, { q: "", a: "" }] })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add FAQ
              </Button>
            </TabsContent>

            <TabsContent value="links" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">Internal links: link to /product/:slug, /compare/:slug, /alternatives/:slug, related feature pages.</p>
              {form.internal_links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Label" value={l.label} onChange={(e) => {
                    const next = [...form.internal_links]; next[i] = { ...next[i], label: e.target.value }; setForm({ ...form, internal_links: next });
                  }} />
                  <Input placeholder="/product/foo" value={l.href} onChange={(e) => {
                    const next = [...form.internal_links]; next[i] = { ...next[i], href: e.target.value }; setForm({ ...form, internal_links: next });
                  }} />
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setForm({ ...form, internal_links: form.internal_links.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, internal_links: [...form.internal_links, { label: "", href: "" }] })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add link
              </Button>
            </TabsContent>

            <TabsContent value="seo" className="mt-4 grid lg:grid-cols-2 gap-4">
              <SeoErrorBoard
                title={form.meta_title || form.h1}
                seoTitle={form.meta_title}
                metaDescription={form.meta_description}
                slug={form.slug}
                body={buildSeoBody(form)}
                focusKeyword={form.focus_keyword}
                featuredImage={form.featured_image}
                onFix={(a: FixAction) => {
                  if (a.type === "apply-title") setForm((f) => ({ ...f, meta_title: a.value }));
                  else if (a.type === "apply-meta") setForm((f) => ({ ...f, meta_description: a.value }));
                }}
              />
              <SocialPreview
                title={form.meta_title || form.h1}
                description={form.meta_description || form.excerpt}
                slug={form.slug}
                image={form.featured_image}
              />
              <div className="lg:col-span-2">
                <SeoHighlights
                  title={form.h1 || form.meta_title}
                  slug={form.slug}
                  body={buildSeoBody(form)}
                  focusKeyword={form.focus_keyword}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.slug || !form.h1 || !form.focus_keyword}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}

function buildSeoBody(f: FormState): string {
  const parts: string[] = [];
  if (f.h1) parts.push(`<h1>${f.h1}</h1>`);
  if (f.hero_body) parts.push(`<p>${f.hero_body}</p>`);
  f.sections.forEach((s) => {
    if (s.heading) parts.push(`<h2>${s.heading}</h2>`);
    if (s.body) parts.push(`<p>${s.body}</p>`);
    if (s.bullets?.length) parts.push(`<ul>${s.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`);
  });
  f.faq.forEach((q) => {
    if (q.q) parts.push(`<h3>${q.q}</h3>`);
    if (q.a) parts.push(`<p>${q.a}</p>`);
  });
  f.internal_links.forEach((l) => {
    if (l.href) parts.push(`<a href="${l.href}">${l.label || l.href}</a>`);
  });
  return parts.join("\n");
}
