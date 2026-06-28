import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const PRICING_MODELS = ["free", "freemium", "paid", "subscription", "one-time"] as const;
const SPONSOR_TIERS = ["bronze", "silver", "gold"] as const;

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminProductEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState({
    name: "",
    slug: "",
    tagline: "",
    description: "",
    logo_url: "",
    website_url: "",
    demo_url: "",
    category_id: "",
    subcategory_id: "",
    pricing_model: "free" as string,
    pricing_description: "",
    starting_price: "",
    company_size: "",
    headquarters: "",
    founded_year: "",
    employee_count: "",
    total_users: "",
    monthly_visitors: "",
    pros_summary: "",
    cons_summary: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    canonical_url: "",
    meta_og_image: "",
    is_active: true,
    is_featured: false,
    is_sponsored: false,
    is_verified: false,
    is_claimed: false,
    sponsor_tier: "" as string,
    sponsor_start_date: "",
    sponsor_end_date: "",
  });

  const [autoSlug, setAutoSlug] = useState(true);

  // Fetch existing product for edit mode
  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ["admin-product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name, slug, parent_id").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const parentCategories = categories?.filter((c) => !c.parent_id) || [];
  const subcategories = categories?.filter((c) => c.parent_id === form.category_id) || [];

  // Populate form on edit
  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "",
        slug: product.slug || "",
        tagline: product.tagline || "",
        description: product.description || "",
        logo_url: product.logo_url || "",
        website_url: product.website_url || "",
        demo_url: product.demo_url || "",
        category_id: product.category_id || "",
        subcategory_id: product.subcategory_id || "",
        pricing_model: product.pricing_model || "free",
        pricing_description: product.pricing_description || "",
        starting_price: product.starting_price?.toString() || "",
        company_size: product.company_size || "",
        headquarters: product.headquarters || "",
        founded_year: product.founded_year?.toString() || "",
        employee_count: product.employee_count?.toString() || "",
        total_users: product.total_users?.toString() || "",
        monthly_visitors: product.monthly_visitors?.toString() || "",
        pros_summary: product.pros_summary || "",
        cons_summary: product.cons_summary || "",
        seo_title: product.seo_title || "",
        seo_description: product.seo_description || "",
        seo_keywords: product.seo_keywords || "",
        canonical_url: product.canonical_url || "",
        meta_og_image: product.meta_og_image || "",
        is_active: product.is_active ?? true,
        is_featured: product.is_featured ?? false,
        is_sponsored: product.is_sponsored ?? false,
        is_verified: product.is_verified ?? false,
        is_claimed: product.is_claimed ?? false,
        sponsor_tier: product.sponsor_tier || "",
        sponsor_start_date: product.sponsor_start_date || "",
        sponsor_end_date: product.sponsor_end_date || "",
      });
      setAutoSlug(false);
    }
  }, [product]);

  // Auto-generate slug from name
  useEffect(() => {
    if (autoSlug && form.name) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [form.name, autoSlug]);

  const update = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Product name is required");
      if (!form.slug.trim()) throw new Error("Slug is required");

      const payload: any = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        tagline: form.tagline.trim() || null,
        description: form.description.trim() || null,
        logo_url: form.logo_url.trim() || null,
        website_url: form.website_url.trim() || null,
        demo_url: form.demo_url.trim() || null,
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        pricing_model: form.pricing_model || null,
        pricing_description: form.pricing_description.trim() || null,
        starting_price: form.starting_price ? parseFloat(form.starting_price) : null,
        company_size: form.company_size.trim() || null,
        headquarters: form.headquarters.trim() || null,
        founded_year: form.founded_year ? parseInt(form.founded_year) : null,
        employee_count: form.employee_count ? parseInt(form.employee_count) : null,
        total_users: form.total_users ? parseInt(form.total_users) : null,
        monthly_visitors: form.monthly_visitors ? parseInt(form.monthly_visitors) : null,
        pros_summary: form.pros_summary.trim() || null,
        cons_summary: form.cons_summary.trim() || null,
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
        seo_keywords: form.seo_keywords.trim() || null,
        canonical_url: form.canonical_url.trim() || null,
        meta_og_image: form.meta_og_image.trim() || null,
        is_active: form.is_active,
        is_featured: form.is_featured,
        is_sponsored: form.is_sponsored,
        is_verified: form.is_verified,
        is_claimed: form.is_claimed,
        sponsor_tier: form.is_sponsored && form.sponsor_tier ? form.sponsor_tier : null,
        sponsor_start_date: form.is_sponsored && form.sponsor_start_date ? form.sponsor_start_date : null,
        sponsor_end_date: form.is_sponsored && form.sponsor_end_date ? form.sponsor_end_date : null,
      };

      if (isNew) {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", id!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(isNew ? "Product created" : "Product updated");
      navigate("/admin/products");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  if (!isNew && loadingProduct) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading product...</div>;
  }

  return (
    <>
      <SeoHead title={isNew ? "New Product - Admin" : `Edit ${form.name} - Admin`} robots="noindex, nofollow" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/products">
              <Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{isNew ? "New Product" : "Edit Product"}</h1>
              <p className="text-sm text-muted-foreground">{isNew ? "Create a new product listing" : `Editing: ${product?.name}`}</p>
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? "Create Product" : "Save Changes"}
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="details">Company Details</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="sponsorship">Sponsorship</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="flags">Flags</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <div className="product-card p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Slack" maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug *</Label>
                  <div className="flex gap-2">
                    <Input id="slug" value={form.slug} onChange={(e) => { setAutoSlug(false); update("slug", e.target.value); }} placeholder="e.g. slack" maxLength={200} />
                    {!autoSlug && !isNew && (
                      <Button variant="outline" size="sm" onClick={() => { setAutoSlug(true); update("slug", slugify(form.name)); }}>Auto</Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Short description in one sentence" maxLength={300} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={(e) => update("description", e.target.value)} rows={5} placeholder="Full product description..." maxLength={5000} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => { update("category_id", v); update("subcategory_id", ""); }}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {parentCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {subcategories.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Select value={form.subcategory_id} onValueChange={(v) => update("subcategory_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                      <SelectContent>
                        {subcategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div className="product-card p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Media & Links</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input id="logo_url" value={form.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://..." maxLength={2048} />
                  {form.logo_url && (
                    <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden mt-1">
                      <img decoding="async" loading="lazy" src={form.logo_url} alt="Logo preview" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input id="website_url" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://..." maxLength={2048} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo_url">Demo URL</Label>
                  <Input id="demo_url" value={form.demo_url} onChange={(e) => update("demo_url", e.target.value)} placeholder="https://..." maxLength={2048} />
                </div>
              </div>
            </div>

            <div className="product-card p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="pros_summary">Pros Summary</Label>
                  <Textarea id="pros_summary" value={form.pros_summary} onChange={(e) => update("pros_summary", e.target.value)} rows={3} placeholder="Key advantages..." maxLength={2000} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cons_summary">Cons Summary</Label>
                  <Textarea id="cons_summary" value={form.cons_summary} onChange={(e) => update("cons_summary", e.target.value)} rows={3} placeholder="Known limitations..." maxLength={2000} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Company Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="product-card p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="headquarters">Headquarters</Label>
                  <Input id="headquarters" value={form.headquarters} onChange={(e) => update("headquarters", e.target.value)} placeholder="e.g. San Francisco, CA" maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="founded_year">Founded Year</Label>
                  <Input id="founded_year" type="number" value={form.founded_year} onChange={(e) => update("founded_year", e.target.value)} placeholder="e.g. 2015" min={1900} max={2030} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_size">Company Size</Label>
                  <Input id="company_size" value={form.company_size} onChange={(e) => update("company_size", e.target.value)} placeholder="e.g. 1-50, 51-200" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_count">Employee Count</Label>
                  <Input id="employee_count" type="number" value={form.employee_count} onChange={(e) => update("employee_count", e.target.value)} placeholder="e.g. 150" min={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_users">Total Users</Label>
                  <Input id="total_users" type="number" value={form.total_users} onChange={(e) => update("total_users", e.target.value)} placeholder="e.g. 50000" min={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_visitors">Monthly Visitors</Label>
                  <Input id="monthly_visitors" type="number" value={form.monthly_visitors} onChange={(e) => update("monthly_visitors", e.target.value)} placeholder="e.g. 100000" min={0} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <div className="product-card p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Pricing</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="pricing_model">Pricing Model</Label>
                  <Select value={form.pricing_model} onValueChange={(v) => update("pricing_model", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRICING_MODELS.map((m) => (
                        <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="starting_price">Starting Price ($)</Label>
                  <Input id="starting_price" type="number" value={form.starting_price} onChange={(e) => update("starting_price", e.target.value)} placeholder="0.00" min={0} step={0.01} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricing_description">Pricing Description</Label>
                <Textarea id="pricing_description" value={form.pricing_description} onChange={(e) => update("pricing_description", e.target.value)} rows={3} placeholder="Describe pricing tiers and details..." maxLength={2000} />
              </div>
            </div>
          </TabsContent>

          {/* Sponsorship Tab */}
          <TabsContent value="sponsorship" className="space-y-6">
            <div className="product-card p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Sponsorship Settings</h2>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_sponsored} onCheckedChange={(v) => update("is_sponsored", v)} />
                <Label>Sponsored Product</Label>
              </div>
              {form.is_sponsored && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="sponsor_tier">Sponsor Tier</Label>
                    <Select value={form.sponsor_tier} onValueChange={(v) => update("sponsor_tier", v)}>
                      <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                      <SelectContent>
                        {SPONSOR_TIERS.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sponsor_start_date">Start Date</Label>
                    <Input id="sponsor_start_date" type="date" value={form.sponsor_start_date} onChange={(e) => update("sponsor_start_date", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sponsor_end_date">End Date</Label>
                    <Input id="sponsor_end_date" type="date" value={form.sponsor_end_date} onChange={(e) => update("sponsor_end_date", e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-6">
            <div className="product-card p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">SEO Metadata</h2>
              <div className="space-y-2">
                <Label htmlFor="seo_title">SEO Title</Label>
                <Input id="seo_title" value={form.seo_title} onChange={(e) => update("seo_title", e.target.value)} placeholder="Page title for search engines" maxLength={60} />
                <p className="text-xs text-muted-foreground">{form.seo_title.length}/60 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo_description">SEO Description</Label>
                <Textarea id="seo_description" value={form.seo_description} onChange={(e) => update("seo_description", e.target.value)} rows={3} placeholder="Meta description for search engines" maxLength={160} />
                <p className="text-xs text-muted-foreground">{form.seo_description.length}/160 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo_keywords">SEO Keywords</Label>
                <Input id="seo_keywords" value={form.seo_keywords} onChange={(e) => update("seo_keywords", e.target.value)} placeholder="keyword1, keyword2, keyword3" maxLength={500} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="canonical_url">Canonical URL</Label>
                  <Input id="canonical_url" value={form.canonical_url} onChange={(e) => update("canonical_url", e.target.value)} placeholder="https://..." maxLength={2048} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_og_image">OG Image URL</Label>
                  <Input id="meta_og_image" value={form.meta_og_image} onChange={(e) => update("meta_og_image", e.target.value)} placeholder="https://..." maxLength={2048} />
                </div>
              </div>

              {/* Google Preview */}
              {(form.seo_title || form.name) && (
                <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Google Preview</p>
                  <p className="text-[#1a0dab] text-lg font-medium leading-snug truncate">{form.seo_title || form.name}</p>
                  <p className="text-[#006621] text-sm truncate">example.com/product/{form.slug}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{form.seo_description || form.tagline || "No description set"}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Flags Tab */}
          <TabsContent value="flags" className="space-y-6">
            <div className="product-card p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Product Flags</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { field: "is_active", label: "Active", desc: "Product is visible on the site" },
                  { field: "is_featured", label: "Featured", desc: "Highlighted in featured sections" },
                  { field: "is_verified", label: "Verified", desc: "Product information has been verified" },
                  { field: "is_claimed", label: "Claimed", desc: "Vendor has claimed ownership" },
                ].map(({ field, label, desc }) => (
                  <div key={field} className="flex items-start gap-3 p-4 rounded-xl bg-muted/30">
                    <Switch
                      checked={(form as any)[field]}
                      onCheckedChange={(v) => update(field, v)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
