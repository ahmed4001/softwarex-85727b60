import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { RichTextEditor } from "@/components/RichTextEditor";
import { FocusKeywordAnalyzer } from "@/components/FocusKeywordAnalyzer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Eye, Loader2, X, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const { data: existing, isLoading: loadingPost } = useQuery({
    queryKey: ["admin-blog-post", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  // Fetch existing tags for autocomplete
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

  const updateField = <K extends keyof BlogForm>(key: K, value: BlogForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && autoSlug) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  };

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
    mutationFn: async (status?: string) => {
      const finalStatus = status || form.status;
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

      if (isEdit) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blog_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      toast({ title: isEdit ? "Post updated" : "Post created" });
      navigate("/admin/blog");
    },
    onError: (err: any) => {
      toast({ title: "Error saving post", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!form.slug.trim()) {
      toast({ title: "Slug is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate(undefined);
  };

  const handlePublish = () => {
    if (!form.title.trim() || !form.slug.trim()) {
      toast({ title: "Title and slug are required", variant: "destructive" });
      return;
    }
    saveMutation.mutate("published");
  };

  const handleSchedule = () => {
    if (!form.title.trim() || !form.slug.trim()) {
      toast({ title: "Title and slug are required", variant: "destructive" });
      return;
    }
    if (!form.scheduled_at) {
      toast({ title: "Please set a scheduled date/time", variant: "destructive" });
      return;
    }
    saveMutation.mutate("scheduled");
  };

  if (isEdit && loadingPost) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>;
  }

  const readingTime = estimateReadingTime(form.body);

  return (
    <>
      <SeoHead title={`${isEdit ? "Edit" : "New"} Blog Post - Admin`} />
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/admin/blog">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">{isEdit ? "Edit Post" : "New Post"}</h1>
              <p className="text-xs text-muted-foreground">
                {isEdit ? `Editing: ${existing?.title}` : "Create a new blog post"}
                {form.body && <span className="ml-2">• ~{readingTime} min read</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {form.slug && (
              <Link to={`/blog/${form.slug}`} target="_blank">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Save Draft</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSchedule} disabled={saveMutation.isPending}>
              Schedule
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={saveMutation.isPending}>
              Publish
            </Button>
          </div>
        </div>

        <Tabs defaultValue="content" className="space-y-4">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="seo">SEO & Meta</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-5">
            <div className="product-card space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Enter post title..."
                  className="text-lg font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/blog/</span>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => {
                      setAutoSlug(false);
                      updateField("slug", slugify(e.target.value));
                    }}
                    placeholder="post-slug"
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={form.excerpt}
                  onChange={(e) => updateField("excerpt", e.target.value)}
                  placeholder="A brief summary of the post..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Body</Label>
                <RichTextEditor
                  value={form.body}
                  onChange={(html) => updateField("body", html)}
                  placeholder="Write your blog post content..."
                  className="min-h-[300px]"
                />
                <p className="text-xs text-muted-foreground">~{readingTime} min read</p>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
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
                    placeholder="Add tag and press Enter..."
                    className="text-sm"
                  />
                  {filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      {filteredSuggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => addTag(s)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    placeholder="e.g. Tutorials, News"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="featured_image">Featured Image URL</Label>
                  <Input
                    id="featured_image"
                    value={form.featured_image}
                    onChange={(e) => updateField("featured_image", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {form.featured_image && (
                <div className="rounded-lg border border-border overflow-hidden max-w-sm">
                  <img src={form.featured_image} alt="Preview" className="w-full h-auto" />
                </div>
              )}
            </div>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-5">
            <div className="product-card space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Search Engine Optimization</h2>

              <FocusKeywordAnalyzer
                keywords={form.seo_keywords}
                onKeywordsChange={(v) => updateField("seo_keywords", v)}
                placeholder="Primary keyword for this post"
                checks={[
                  { label: "In SEO title", content: form.seo_title || form.title },
                  { label: "In meta description", content: form.seo_description },
                  { label: "In URL slug", content: form.slug, slugMatch: true },
                  { label: "In body content", content: form.body },
                ]}
              />

              <div className="space-y-2">
                <Label htmlFor="seo_title">SEO Title</Label>
                <Input
                  id="seo_title"
                  value={form.seo_title}
                  onChange={(e) => updateField("seo_title", e.target.value)}
                  placeholder="Title for search engines (defaults to post title)"
                />
                <p className={`text-xs ${(form.seo_title || form.title).length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                  {(form.seo_title || form.title).length}/60 characters
                  {(form.seo_title || form.title).length > 60 && " — too long, may be truncated"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo_description">Meta Description</Label>
                <Textarea
                  id="seo_description"
                  value={form.seo_description}
                  onChange={(e) => updateField("seo_description", e.target.value)}
                  placeholder="Description for search results..."
                  rows={3}
                />
                <p className={`text-xs ${form.seo_description.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.seo_description.length}/160 characters
                  {form.seo_description.length > 160 && " — too long, may be truncated"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo_keywords">All Keywords</Label>
                <Input
                  id="seo_keywords"
                  value={form.seo_keywords}
                  onChange={(e) => updateField("seo_keywords", e.target.value)}
                  placeholder="keyword1, keyword2, keyword3"
                />
                <p className="text-xs text-muted-foreground">Comma-separated. First keyword is used for focus analysis above.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="canonical_url">Canonical URL</Label>
                  <Input
                    id="canonical_url"
                    value={form.canonical_url}
                    onChange={(e) => updateField("canonical_url", e.target.value)}
                    placeholder="https://... (leave empty to use default)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="og_image">OG Image URL</Label>
                  <Input
                    id="og_image"
                    value={form.og_image}
                    onChange={(e) => updateField("og_image", e.target.value)}
                    placeholder="https://... (social share image)"
                  />
                </div>
              </div>

              {/* Google Search Preview */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Google Search Preview</p>
                <div className="rounded-xl border border-border p-4 bg-muted/30 space-y-1">
                  <p className="text-sm font-medium text-primary truncate">
                    {form.seo_title || form.title || "Post Title"} | SoftwareHub
                  </p>
                  <p className="text-xs text-emerald-700 truncate">
                    yoursite.com › blog › {form.slug || "post-slug"}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {form.seo_description || form.excerpt || "Post description will appear here..."}
                  </p>
                </div>
              </div>

              {/* Social Share Preview */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social Share Preview</p>
                <div className="rounded-xl border border-border overflow-hidden max-w-sm bg-muted/30">
                  {(form.og_image || form.featured_image) && (
                    <div className="aspect-[1.91/1] bg-muted overflow-hidden">
                      <img src={form.og_image || form.featured_image} alt="OG Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3 space-y-0.5">
                    <p className="text-[11px] text-muted-foreground uppercase">yoursite.com</p>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{form.seo_title || form.title || "Post Title"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{form.seo_description || form.excerpt || "Description..."}</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-5">
            <div className="product-card space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Post Settings</h2>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger className="w-[200px]">
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
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Publish Date & Time</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ""}
                    onChange={(e) => updateField("scheduled_at", e.target.value ? new Date(e.target.value).toISOString() : "")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Post will be automatically published at this time.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Featured Post</p>
                  <p className="text-xs text-muted-foreground">Show this post in featured sections</p>
                </div>
                <Switch checked={form.is_featured} onCheckedChange={(v) => updateField("is_featured", v)} />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Pinned Post</p>
                  <p className="text-xs text-muted-foreground">Pin this post to the top of the blog</p>
                </div>
                <Switch checked={form.is_pinned} onCheckedChange={(v) => updateField("is_pinned", v)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
