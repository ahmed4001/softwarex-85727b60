import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Save, Loader2, Globe, Palette, Shield, Mail, Search } from "lucide-react";
import { toast } from "sonner";

type SettingRow = {
  id: string;
  key: string;
  value: any;
  label: string | null;
  description: string | null;
  group: string | null;
};

const DEFAULT_SETTINGS: Record<string, { label: string; description: string; group: string; defaultValue: any }> = {
  site_name: { label: "Site Name", description: "The name of your site", group: "general", defaultValue: "SoftwareHub" },
  site_tagline: { label: "Tagline", description: "Short description shown in SEO", group: "general", defaultValue: "Find & Compare the Best Business Software" },
  contact_email: { label: "Contact Email", description: "Public contact email address", group: "general", defaultValue: "" },
  reviews_require_approval: { label: "Reviews Require Approval", description: "New reviews must be approved before appearing", group: "moderation", defaultValue: true },
  allow_anonymous_reviews: { label: "Allow Anonymous Reviews", description: "Allow reviews without sign-in", group: "moderation", defaultValue: false },
  max_reviews_per_user_per_product: { label: "Max Reviews Per User Per Product", description: "Limit duplicate reviews", group: "moderation", defaultValue: "1" },
  primary_color: { label: "Primary Color (HSL)", description: "Main brand color in HSL", group: "appearance", defaultValue: "142 76% 36%" },
  footer_text: { label: "Footer Copyright Text", description: "Text shown in footer", group: "appearance", defaultValue: "© 2026 SoftwareHub. All rights reserved." },
  smtp_from_email: { label: "From Email", description: "Default sender email", group: "email", defaultValue: "" },
  smtp_from_name: { label: "From Name", description: "Default sender name", group: "email", defaultValue: "SoftwareHub" },
  seo_default_title: { label: "Default Meta Title", description: "Fallback title for pages without a custom one (max 60 chars)", group: "seo", defaultValue: "SoftwareHub — Find & Compare Business Software" },
  seo_default_description: { label: "Default Meta Description", description: "Fallback meta description (max 160 chars)", group: "seo", defaultValue: "Discover, compare, and review the best business software. Honest reviews from real users." },
  seo_default_keywords: { label: "Default Keywords", description: "Comma-separated global keywords", group: "seo", defaultValue: "software reviews, SaaS comparison, business tools" },
  seo_default_og_image: { label: "Default OG Image", description: "Fallback Open Graph image URL", group: "seo", defaultValue: "" },
  seo_google_verification: { label: "Google Site Verification", description: "Google Search Console verification meta tag content", group: "seo", defaultValue: "" },
  seo_bing_verification: { label: "Bing Site Verification", description: "Bing Webmaster verification meta tag content", group: "seo", defaultValue: "" },
  robots_txt: { label: "robots.txt Content", description: "Custom robots.txt directives", group: "seo", defaultValue: "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /vendor/\nDisallow: /login\n\nSitemap: /sitemap.xml" },
  sitemap_include_products: { label: "Include Products in Sitemap", description: "Add all active products to sitemap.xml", group: "seo", defaultValue: true },
  sitemap_include_categories: { label: "Include Categories in Sitemap", description: "Add all active categories to sitemap.xml", group: "seo", defaultValue: true },
  sitemap_include_blog: { label: "Include Blog Posts in Sitemap", description: "Add published blog posts to sitemap.xml", group: "seo", defaultValue: true },
  sitemap_include_comparisons: { label: "Include Comparisons in Sitemap", description: "Add published comparisons to sitemap.xml", group: "seo", defaultValue: true },
};

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["admin-site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      return (data || []) as SettingRow[];
    },
  });

  useEffect(() => {
    const merged: Record<string, any> = {};
    Object.entries(DEFAULT_SETTINGS).forEach(([key, def]) => {
      const existing = settings.find((s) => s.key === key);
      merged[key] = existing?.value ?? def.defaultValue;
    });
    setForm(merged);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
        const existing = settings.find((s) => s.key === key);
        const value = form[key];
        if (existing) {
          await supabase.from("site_settings").update({ value: value as any }).eq("id", existing.id);
        } else {
          await supabase.from("site_settings").insert({
            key,
            value: value as any,
            label: def.label,
            description: def.description,
            group: def.group,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site-settings"] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const updateField = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const renderField = (key: string) => {
    const def = DEFAULT_SETTINGS[key];
    const val = form[key];
    if (typeof def.defaultValue === "boolean") {
      return (
        <div key={key} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{def.label}</p>
            <p className="text-xs text-muted-foreground">{def.description}</p>
          </div>
          <Switch checked={!!val} onCheckedChange={(v) => updateField(key, v)} />
        </div>
      );
    }
    // Multiline fields
    if (key === "robots_txt") {
      return (
        <div key={key} className="space-y-1.5">
          <Label>{def.label}</Label>
          <Textarea value={val || ""} onChange={(e) => updateField(key, e.target.value)} rows={8} className="font-mono text-xs" placeholder={def.description} />
          <p className="text-[11px] text-muted-foreground">{def.description}</p>
        </div>
      );
    }
    return (
      <div key={key} className="space-y-1.5">
        <Label>{def.label}</Label>
        <Input value={val || ""} onChange={(e) => updateField(key, e.target.value)} placeholder={def.description} />
        <p className="text-[11px] text-muted-foreground">{def.description}</p>
      </div>
    );
  };

  const groups = [
    { id: "general", label: "General", icon: Globe, keys: ["site_name", "site_tagline", "contact_email"] },
    { id: "moderation", label: "Moderation", icon: Shield, keys: ["reviews_require_approval", "allow_anonymous_reviews", "max_reviews_per_user_per_product"] },
    { id: "appearance", label: "Appearance", icon: Palette, keys: ["primary_color", "footer_text"] },
    { id: "email", label: "Email", icon: Mail, keys: ["smtp_from_email", "smtp_from_name"] },
    { id: "seo", label: "SEO", icon: Search, keys: ["seo_default_title", "seo_default_description", "seo_default_keywords", "seo_default_og_image", "seo_google_verification", "seo_bing_verification", "robots_txt", "sitemap_include_products", "sitemap_include_categories", "sitemap_include_blog", "sitemap_include_comparisons"] },
  ];

  return (
    <>
      <SeoHead title="Settings - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Settings className="h-6 w-6" /> Site Settings
            </h1>
            <p className="text-muted-foreground">Manage global configuration</p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : (
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="bg-muted/50">
              {groups.map((g) => (
                <TabsTrigger key={g.id} value={g.id} className="gap-1.5">
                  <g.icon className="h-3.5 w-3.5" /> {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {groups.map((g) => (
              <TabsContent key={g.id} value={g.id}>
                <div className="glass-card p-6 space-y-5">
                  {g.keys.map((key) => renderField(key))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </>
  );
}
