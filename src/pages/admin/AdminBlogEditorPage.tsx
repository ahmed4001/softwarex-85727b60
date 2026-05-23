import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { RichTextEditor } from "@/components/RichTextEditor";
import { FocusKeywordAnalyzer } from "@/components/FocusKeywordAnalyzer";
import { BlogSeoScorePanel } from "@/components/admin/BlogSeoScorePanel";
import { InternalLinksSuggestionPanel } from "@/components/admin/InternalLinksSuggestionPanel";
import { SeoErrorBoard, SocialPreview, type FixAction } from "@/components/admin/SeoErrorBoard";
import { SeoHighlights } from "@/components/admin/SeoHighlights";
import { computeSeoScore } from "@/lib/blog-seo-score";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ArrowLeft, Save, Eye, Loader2, X, Settings, Globe, Clock, Tag, Image, Search, Gauge, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const wordCount = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function wordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text.split(" ").filter(Boolean).length;
}

interface BlogForm {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: string;
  featured_image: string;
  status: string;
  is_featured: boolean;
  is_pinned: boolean;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  canonical_url: string;
  og_image: string;
  tags: string[];
  scheduled_at: string;
}

const emptyForm: BlogForm = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  category: "",
  featured_image: "",
  status: "draft",
  is_featured: false,
  is_pinned: false,
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  canonical_url: "",
  og_image: "",
  tags: [],
  scheduled_at: "",
};

export default function AdminBlogEditorPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BlogForm>(emptyForm);
  const [autoSlug, setAutoSlug] = useState(true);
  const [tagInput, setTagInput] = useState("");
  const [settingsTab, setSettingsTab] = useState<"general" | "seo" | "score" | "links">("general");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const uploadFeaturedImage = useCallback(async (file: File) => {
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((f) => ({ ...f, featured_image: data.publicUrl }));
      toast({ title: "Image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const { data: existing, isLoading: loadingPost } = useQuery({
    queryKey: ["admin-blog-post", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["all-blog-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("blog_posts").select("tags");
      const tagSet = new Set<string>();
      data?.forEach((p) => {
        if (Array.isArray(p.tags)) {
          (p.tags as string[]).forEach((t) => tagSet.add(t));
        }
      });
      return Array.from(tagSet).sort();
    },
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title || "",
        slug: existing.slug || "",
        excerpt: existing.excerpt || "",
        body: existing.body || "",
        category: existing.category || "",
        featured_image: existing.featured_image || "",
        status: existing.status || "draft",
        is_featured: existing.is_featured || false,
        is_pinned: existing.is_pinned || false,
        seo_title: existing.seo_title || "",
        seo_description: existing.seo_description || "",
        seo_keywords: existing.seo_keywords || "",
        canonical_url: existing.canonical_url || "",
        og_image: existing.og_image || "",
        tags: Array.isArray(existing.tags) ? (existing.tags as string[]) : [],
        scheduled_at: existing.scheduled_at || "",
      });
      setAutoSlug(false);
    }
  }, [existing]);

  const updateField = useCallback(<K extends keyof BlogForm>(key: K, value: BlogForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && autoSlug) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  }, [autoSlug]);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      updateField("tags", [...form.tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    updateField("tags", form.tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const filteredSuggestions = tagInput.length > 0
    ? allTags.filter((t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !form.tags.includes(t)).slice(0, 5)
    : [];

  const saveMutation = useMutation({
    mutationFn: async (opts?: { status?: string; exit?: boolean }) => {
      const finalStatus = opts?.status || form.status;
      const readingTime = estimateReadingTime(form.body);
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt || null,
        body: form.body || null,
        category: form.category || null,
        featured_image: form.featured_image || null,
        status: finalStatus as any,
        is_featured: form.is_featured,
        is_pinned: form.is_pinned,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_keywords: form.seo_keywords || null,
        canonical_url: form.canonical_url || null,
        og_image: form.og_image || null,
        reading_time: readingTime,
        tags: form.tags as any,
        scheduled_at: finalStatus === "scheduled" && form.scheduled_at ? form.scheduled_at : null,
        published_at: finalStatus === "published" ? new Date().toISOString() : existing?.published_at || null,
      };

      const effectiveId = id || createdId;
      if (effectiveId) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", effectiveId);
        if (error) throw error;
        return { id: effectiveId, isNew: false, exit: !!opts?.exit, status: finalStatus };
      } else {
        const { data, error } = await supabase.from("blog_posts").insert(payload).select("id").single();
        if (error) throw error;
        return { id: data.id, isNew: true, exit: !!opts?.exit, status: finalStatus };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      setLastSavedAt(new Date());
      if (result.isNew && !id) setCreatedId(result.id);
      if (result.exit || result.status === "published" || result.status === "scheduled") {
        toast({ title: result.status === "published" ? "Post published" : "Post saved" });
        navigate("/admin/blog");
      } else {
        toast({ title: "Saved" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error saving post", description: err.message, variant: "destructive" });
    },
  });

  // ---- AUTO-SAVE ----
  // Debounced silent save of drafts. Skips published/scheduled posts (require explicit user action).
  useEffect(() => {
    if (!form.title.trim() || !form.slug.trim()) return;
    if (form.status !== "draft") return;
    const handle = setTimeout(async () => {
      setAutoSaving(true);
      try {
        const readingTime = estimateReadingTime(form.body);
        const payload: any = {
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt || null,
          body: form.body || null,
          category: form.category || null,
          featured_image: form.featured_image || null,
          status: "draft",
          is_featured: form.is_featured,
          is_pinned: form.is_pinned,
          seo_title: form.seo_title || null,
          seo_description: form.seo_description || null,
          seo_keywords: form.seo_keywords || null,
          canonical_url: form.canonical_url || null,
          og_image: form.og_image || null,
          reading_time: readingTime,
          tags: form.tags as any,
        };
        const effectiveId = id || createdId;
        if (effectiveId) {
          await supabase.from("blog_posts").update(payload).eq("id", effectiveId);
        } else {
          const { data } = await supabase.from("blog_posts").insert(payload).select("id").single();
          if (data?.id) setCreatedId(data.id);
        }
        setLastSavedAt(new Date());
      } catch {
        // silent — manual save will surface errors
      } finally {
        setAutoSaving(false);
      }
    }, 2500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const handleSave = () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!form.slug.trim()) {
      toast({ title: "Slug is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({});
  };

  const handlePublish = () => {
    if (!form.title.trim() || !form.slug.trim()) {
      toast({ title: "Title and slug are required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ status: "published" });
  };

  if (isEdit && loadingPost) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  const readingTime = estimateReadingTime(form.body);
  const words = wordCount(form.body);
  const statusLabel = form.status === "published" ? "Published" : form.status === "scheduled" ? "Scheduled" : "Draft";
  const seoScore = computeSeoScore({
    title: form.title,
    seoTitle: form.seo_title,
    metaDescription: form.seo_description,
    slug: form.slug,
    body: form.body,
    focusKeyword: form.seo_keywords.split(",")[0]?.trim(),
    featuredImage: form.featured_image,
  });
  const scoreColor = seoScore.level === "good" ? "bg-emerald-500" : seoScore.level === "warn" ? "bg-amber-500" : "bg-destructive";

  return (
    <>
      <SeoHead title={`${isEdit ? "Edit" : "New"} Post - Admin`} />

      {/* Ghost-style top bar — minimal, fixed-feel */}
      <div className="flex items-center justify-between gap-4 mb-0 -mt-2 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link to="/admin/blog">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn(
              "inline-block h-2 w-2 rounded-full",
              form.status === "published" ? "bg-emerald-500" : form.status === "scheduled" ? "bg-amber-500" : "bg-muted-foreground/40"
            )} />
            <span>{statusLabel}</span>
            {words > 0 && (
              <>
                <span className="text-border">·</span>
                <span>{words} words</span>
                <span className="text-border">·</span>
                <span>{readingTime} min read</span>
              </>
            )}
            {(autoSaving || lastSavedAt) && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  {autoSaving ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                  ) : (
                    <>Saved {lastSavedAt!.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* SEO score chip */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-xs"
            title={`SEO: ${seoScore.score}/100`}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", scoreColor)} />
            <span className="font-semibold text-foreground">{seoScore.score}</span>
            <Gauge className="h-3 w-3 text-muted-foreground" />
          </div>
          {form.slug && (
            <Link to={`/blog/${form.slug}`} target="_blank">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
            </Link>
          )}

          {/* Settings sidebar trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-base font-semibold">Post settings</SheetTitle>
              </SheetHeader>

              {/* Settings tabs inside the sheet */}
              <div className="grid grid-cols-4 gap-1 mt-4 mb-5 p-0.5 bg-muted rounded-lg">
                {([
                  ["general", "General"],
                  ["seo", "SEO"],
                  ["score", "Score"],
                  ["links", "Links"],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSettingsTab(val)}
                    className={cn(
                      "text-xs font-medium py-1.5 rounded-md transition-colors",
                      settingsTab === val ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {settingsTab === "general" && (
                <div className="space-y-5">
                  {/* Slug */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Post URL</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/blog/</span>
                      <Input
                        value={form.slug}
                        onChange={(e) => { setAutoSlug(false); updateField("slug", slugify(e.target.value)); }}
                        className="font-mono text-xs h-8"
                      />
                    </div>
                  </div>

                  {/* Excerpt */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Excerpt</Label>
                    <Textarea
                      value={form.excerpt}
                      onChange={(e) => updateField("excerpt", e.target.value)}
                      placeholder="A brief summary…"
                      rows={3}
                      className="text-sm resize-none"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</Label>
                    <Input
                      value={form.category}
                      onChange={(e) => updateField("category", e.target.value)}
                      placeholder="e.g. Tutorials, News"
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs rounded-md">
                          {tag}
                          <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="relative">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Add tag…"
                        className="h-8 text-sm"
                      />
                      {filteredSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                          {filteredSuggestions.map((s) => (
                            <button key={s} onClick={() => addTag(s)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Featured image */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Feature image</Label>
                    <Input
                      value={form.featured_image}
                      onChange={(e) => updateField("featured_image", e.target.value)}
                      placeholder="https://… or upload below"
                      className="h-8 text-sm"
                    />
                    <label className="flex items-center justify-center gap-2 py-2 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFeaturedImage(f);
                          e.target.value = "";
                        }}
                      />
                      {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
                      <span>{uploadingImage ? "Uploading…" : "Upload image"}</span>
                    </label>
                    {form.featured_image && (
                      <div className="rounded-lg border border-border overflow-hidden mt-2">
                        <img src={form.featured_image} alt="Preview" className="w-full h-auto" />
                      </div>
                    )}
                  </div>


                  <div className="border-t border-border pt-4 space-y-3">
                    {/* Status */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                      <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.status === "scheduled" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Publish at</Label>
                        <Input
                          type="datetime-local"
                          value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ""}
                          onChange={(e) => updateField("scheduled_at", e.target.value ? new Date(e.target.value).toISOString() : "")}
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">Featured</span>
                      <Switch checked={form.is_featured} onCheckedChange={(v) => updateField("is_featured", v)} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">Pinned</span>
                      <Switch checked={form.is_pinned} onCheckedChange={(v) => updateField("is_pinned", v)} />
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === "seo" && (
                <div className="space-y-5">
                  <FocusKeywordAnalyzer
                    keywords={form.seo_keywords}
                    onKeywordsChange={(v) => updateField("seo_keywords", v)}
                    placeholder="Primary keyword"
                    checks={[
                      { label: "In SEO title", content: form.seo_title || form.title },
                      { label: "In meta description", content: form.seo_description },
                      { label: "In URL slug", content: form.slug, slugMatch: true },
                      { label: "In body content", content: form.body },
                    ]}
                  />

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SEO title</Label>
                    <Input
                      value={form.seo_title}
                      onChange={(e) => updateField("seo_title", e.target.value)}
                      placeholder="Title for search engines"
                      className="h-8 text-sm"
                    />
                    <p className={cn("text-[11px]", (form.seo_title || form.title).length > 60 ? "text-destructive" : "text-muted-foreground")}>
                      {(form.seo_title || form.title).length}/60
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meta description</Label>
                    <Textarea
                      value={form.seo_description}
                      onChange={(e) => updateField("seo_description", e.target.value)}
                      placeholder="Description for search results"
                      rows={3}
                      className="text-sm resize-none"
                    />
                    <p className={cn("text-[11px]", form.seo_description.length > 160 ? "text-destructive" : "text-muted-foreground")}>
                      {form.seo_description.length}/160
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Keywords</Label>
                    <Input
                      value={form.seo_keywords}
                      onChange={(e) => updateField("seo_keywords", e.target.value)}
                      placeholder="keyword1, keyword2"
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Canonical URL</Label>
                    <Input
                      value={form.canonical_url}
                      onChange={(e) => updateField("canonical_url", e.target.value)}
                      placeholder="https://…"
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">OG image</Label>
                    <Input
                      value={form.og_image}
                      onChange={(e) => updateField("og_image", e.target.value)}
                      placeholder="https://…"
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Google preview */}
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Search preview</p>
                    <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-0.5">
                      <p className="text-sm font-medium text-primary truncate">
                        {form.seo_title || form.title || "Post Title"}
                      </p>
                      <p className="text-[11px] text-emerald-600 truncate font-mono">
                        yoursite.com/blog/{form.slug || "post-slug"}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {form.seo_description || form.excerpt || "Description…"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === "score" && (
                <BlogSeoScorePanel
                  title={form.title}
                  seoTitle={form.seo_title}
                  metaDescription={form.seo_description}
                  slug={form.slug}
                  body={form.body}
                  focusKeyword={form.seo_keywords.split(",")[0]?.trim()}
                  featuredImage={form.featured_image}
                />
              )}

              {settingsTab === "links" && (
                <InternalLinksSuggestionPanel
                  currentId={id || createdId || undefined}
                  slug={form.slug}
                  title={form.title}
                  tags={form.tags}
                  category={form.category}
                  body={form.body}
                  onInsert={(html) => updateField("body", (form.body || "") + html)}
                />
              )}
            </SheetContent>
          </Sheet>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-1.5 h-8 text-xs"
          >
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={saveMutation.isPending}
            className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Globe className="h-3 w-3" />
            {form.status === "published" ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Ghost-style distraction-free writing area + SEO board */}
      <div className="max-w-6xl mx-auto py-10 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="min-w-0">
          {/* Title — large, serif, no border */}
          <input
            id="blog-title-input"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Post title"
            className="w-full text-4xl font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40 mb-2"
            style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
          />

          {/* Subtitle / excerpt inline */}
          <textarea
            value={form.excerpt}
            onChange={(e) => updateField("excerpt", e.target.value)}
            placeholder="Add a custom excerpt…"
            rows={1}
            className="w-full text-lg text-muted-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/30 resize-none mb-8"
          />

          {/* Featured image (Ghost-style click to add) */}
          {form.featured_image ? (
            <div id="blog-featured-block" className="relative rounded-xl overflow-hidden mb-8 group">
              <img src={form.featured_image} alt="Feature" className="w-full h-auto" />
              <button
                onClick={() => updateField("featured_image", "")}
                className="absolute top-3 right-3 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div id="blog-featured-block" className="flex items-stretch gap-2 mb-8">
              <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-6 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFeaturedImage(f);
                    e.target.value = "";
                  }}
                />
                {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Image className="h-5 w-5" />}
                <span className="text-sm font-medium">{uploadingImage ? "Uploading…" : "Upload feature image"}</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const url = window.prompt("Or paste image URL:");
                  if (url) updateField("featured_image", url);
                }}
                className="px-4 border-2 border-dashed border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                Use URL
              </button>
            </div>
          )}


          {/* Rich text editor — clean, minimal */}
          <div id="blog-body-block">
            <RichTextEditor
              value={form.body}
              onChange={(html) => updateField("body", html)}
              placeholder="Begin writing your post…"
              className="min-h-[400px] bg-transparent ghost-editor"
            />
          </div>

          {/* Inline meta inputs for quick SEO Fix actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="blog-seo-title" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                SEO title <span className="text-[10px] normal-case">({(form.seo_title || form.title).length}/60)</span>
              </Label>
              <Input
                id="blog-seo-title"
                value={form.seo_title}
                onChange={(e) => updateField("seo_title", e.target.value)}
                placeholder={form.title || "Search engine title"}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blog-focus-keyword" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Focus keyword</Label>
              <Input
                id="blog-focus-keyword"
                value={form.seo_keywords}
                onChange={(e) => updateField("seo_keywords", e.target.value)}
                placeholder="primary keyword, secondary, …"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="blog-seo-desc" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Meta description <span className="text-[10px] normal-case">({form.seo_description.length}/160)</span>
              </Label>
              <Textarea
                id="blog-seo-desc"
                value={form.seo_description}
                onChange={(e) => updateField("seo_description", e.target.value)}
                placeholder="Description shown in search results (140–160 chars)…"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="blog-slug" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">/blog/</span>
                <Input
                  id="blog-slug"
                  value={form.slug}
                  onChange={(e) => { setAutoSlug(false); updateField("slug", slugify(e.target.value)); }}
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SEO Error Board — sticky sidebar */}
        <aside className="lg:sticky lg:top-4 self-start space-y-4">
          <SeoErrorBoard
            title={form.title}
            seoTitle={form.seo_title}
            metaDescription={form.seo_description}
            slug={form.slug}
            body={form.body}
            focusKeyword={form.seo_keywords.split(",")[0]?.trim()}
            featuredImage={form.featured_image}
            onFix={(action: FixAction) => {
              if (action.type === "apply-title") {
                updateField("seo_title", action.value);
                if (!form.title) updateField("title", action.value);
                return;
              }
              if (action.type === "apply-meta") {
                updateField("seo_description", action.value);
                return;
              }
              const map: Record<string, string> = {
                "focus-title": "blog-title-input",
                "focus-meta": "blog-seo-desc",
                "focus-keyword": "blog-focus-keyword",
                "focus-slug": "blog-slug",
                "focus-featured": "blog-featured-block",
                "focus-body": "blog-body-block",
              };
              const el = document.getElementById(map[action.type]);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                (el as HTMLInputElement).focus?.();
              }
            }}
          />
          <SocialPreview
            title={form.seo_title || form.title}
            description={form.seo_description}
            slug={form.slug}
            image={form.featured_image}
          />
          <SeoHighlights
            title={form.title}
            slug={form.slug}
            body={form.body}
            focusKeyword={form.seo_keywords.split(",")[0]?.trim()}
          />
        </aside>
      </div>
    </>
  );
}
