import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function VendorProductEditorPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState({
    tagline: "",
    description: "",
    logo_url: "",
    website_url: "",
    demo_url: "",
    pricing_description: "",
    headquarters: "",
    company_size: "",
    pros_summary: "",
    cons_summary: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    canonical_url: "",
    meta_og_image: "",
  });

  // Verify ownership via approved claim
  const { data: claim, isLoading: loadingClaim } = useQuery({
    queryKey: ["vendor-claim-check", user?.id, productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("id")
        .eq("user_id", user!.id)
        .eq("product_id", productId!)
        .eq("status", "approved")
        .single();
      return data;
    },
    enabled: !!user && !!productId,
  });

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ["vendor-product-edit", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!claim,
  });

  useEffect(() => {
    if (product) {
      setForm({
        tagline: product.tagline || "",
        description: product.description || "",
        logo_url: product.logo_url || "",
        website_url: product.website_url || "",
        demo_url: product.demo_url || "",
        pricing_description: product.pricing_description || "",
        headquarters: product.headquarters || "",
        company_size: product.company_size || "",
        pros_summary: product.pros_summary || "",
        cons_summary: product.cons_summary || "",
        seo_title: product.seo_title || "",
        seo_description: product.seo_description || "",
        seo_keywords: product.seo_keywords || "",
        canonical_url: product.canonical_url || "",
        meta_og_image: product.meta_og_image || "",
      });
    }
  }, [product]);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      Object.entries(form).forEach(([k, v]) => {
        payload[k] = (v as string).trim() || null;
      });
      const { error } = await supabase.from("products").update(payload).eq("id", productId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-claimed-products"] });
      toast.success("Product updated");
      navigate("/vendor/products");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  if (loadingClaim || loadingProduct) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  if (!claim) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-4">You don't have an approved claim for this product.</p>
        <Link to="/vendor/products"><Button variant="outline">Back to Products</Button></Link>
      </div>
    );
  }

  return (
    <>
      <SeoHead title={`Edit ${product?.name || "Product"} — Vendor`} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/vendor/products">
              <Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Edit Product</h1>
              <p className="text-sm text-muted-foreground">{product?.name}</p>
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="info">Basic Info</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="links">Links & Media</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Short description" maxLength={300} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={6} placeholder="Full product description..." maxLength={5000} />
              </div>
              <div className="space-y-2">
                <Label>Pricing Description</Label>
                <Textarea value={form.pricing_description} onChange={(e) => update("pricing_description", e.target.value)} rows={3} placeholder="Describe pricing tiers..." maxLength={2000} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Pros Summary</Label>
                  <Textarea value={form.pros_summary} onChange={(e) => update("pros_summary", e.target.value)} rows={3} maxLength={2000} />
                </div>
                <div className="space-y-2">
                  <Label>Cons Summary</Label>
                  <Textarea value={form.cons_summary} onChange={(e) => update("cons_summary", e.target.value)} rows={3} maxLength={2000} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="company" className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Headquarters</Label>
                  <Input value={form.headquarters} onChange={(e) => update("headquarters", e.target.value)} placeholder="e.g. San Francisco, CA" maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label>Company Size</Label>
                  <Input value={form.company_size} onChange={(e) => update("company_size", e.target.value)} placeholder="e.g. 51-200" maxLength={100} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="links" className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input value={form.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://..." maxLength={2048} />
                {form.logo_url && (
                  <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden mt-1">
                    <img src={form.logo_url} alt="Preview" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Website URL</Label>
                  <Input value={form.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://..." maxLength={2048} />
                </div>
                <div className="space-y-2">
                  <Label>Demo URL</Label>
                  <Input value={form.demo_url} onChange={(e) => update("demo_url", e.target.value)} placeholder="https://..." maxLength={2048} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seo" className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <div className="space-y-2">
                <Label>SEO Title</Label>
                <Input value={form.seo_title} onChange={(e) => update("seo_title", e.target.value)} placeholder="Custom title for search engines (max 60 chars)" maxLength={60} />
                <p className="text-xs text-muted-foreground">{form.seo_title.length}/60 characters</p>
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea value={form.seo_description} onChange={(e) => update("seo_description", e.target.value)} rows={3} placeholder="Description shown in search results (max 160 chars)" maxLength={160} />
                <p className="text-xs text-muted-foreground">{form.seo_description.length}/160 characters</p>
              </div>
              <div className="space-y-2">
                <Label>SEO Keywords</Label>
                <Input value={form.seo_keywords} onChange={(e) => update("seo_keywords", e.target.value)} placeholder="keyword1, keyword2, keyword3" maxLength={500} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Canonical URL</Label>
                  <Input value={form.canonical_url} onChange={(e) => update("canonical_url", e.target.value)} placeholder="https://..." maxLength={2048} />
                </div>
                <div className="space-y-2">
                  <Label>OG Image URL</Label>
                  <Input value={form.meta_og_image} onChange={(e) => update("meta_og_image", e.target.value)} placeholder="https://..." maxLength={2048} />
                </div>
              </div>
              {(form.seo_title || form.seo_description) && (
                <div className="rounded-lg border border-border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Search Preview</p>
                  <p className="text-primary text-sm font-medium truncate">{form.seo_title || product?.name || "Product Title"}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{form.seo_description || form.tagline || "No description set"}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
