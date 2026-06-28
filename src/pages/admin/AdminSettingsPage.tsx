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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Save, Loader2, Globe, Palette, Shield, Mail, Search, Eye, ListOrdered, Paintbrush, RotateCcw, Image as ImageIcon, Upload, Award, Plus, Trash2 } from "lucide-react";
const logoAsset = { url: "/reviewhunts-logo.png" };
import { toast } from "sonner";
import { applyTheme, normalizeColor } from "@/lib/theme-config";
import { DEFAULT_FOOTER_BADGES, type FooterBadgeItem, FooterBadge } from "@/components/FooterBadge";

type SettingRow = {
  id: string;
  key: string;
  value: any;
  label: string | null;
  description: string | null;
  group: string | null;
};

const DEFAULT_SETTINGS: Record<string, { label: string; description: string; group: string; defaultValue: any }> = {
  site_name: { label: "Site Name", description: "The name of your site", group: "general", defaultValue: "ReviewHunts" },
  site_tagline: { label: "Tagline", description: "Short description shown in SEO", group: "general", defaultValue: "Find & Compare the Best Business Software" },
  contact_email: { label: "Contact Email", description: "Public contact email address", group: "general", defaultValue: "" },
  reviews_require_approval: { label: "Reviews Require Approval", description: "New reviews must be approved before appearing", group: "moderation", defaultValue: true },
  allow_anonymous_reviews: { label: "Allow Anonymous Reviews", description: "Allow reviews without sign-in", group: "moderation", defaultValue: false },
  max_reviews_per_user_per_product: { label: "Max Reviews Per User Per Product", description: "Limit duplicate reviews", group: "moderation", defaultValue: "1" },
  primary_color: { label: "Primary Color", description: "Main brand color", group: "theme", defaultValue: "190 75% 42%" },
  secondary_color: { label: "Secondary Color", description: "Secondary accent color", group: "theme", defaultValue: "175 55% 45%" },
  button_color: { label: "Button Color", description: "Color used for primary buttons (overrides primary on buttons)", group: "theme", defaultValue: "190 75% 42%" },
  background_color: { label: "Background Color", description: "Page background color", group: "theme", defaultValue: "200 50% 98%" },
  footer_text: { label: "Footer Copyright Text", description: "Text shown in footer", group: "appearance", defaultValue: "© 2026 ReviewHunts. All rights reserved." },
  smtp_from_email: { label: "From Email", description: "Default sender email", group: "email", defaultValue: "" },
  smtp_from_name: { label: "From Name", description: "Default sender name", group: "email", defaultValue: "ReviewHunts" },
  seo_default_title: { label: "Default Meta Title", description: "Fallback title for pages without a custom one (max 60 chars)", group: "seo", defaultValue: "ReviewHunts — Find & Compare Business Software" },
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
  real_first_enabled: { label: "Prioritize Real Products", description: "Show real / full-info products first and push seeded ones to the end across categories, search, and feeds.", group: "listings", defaultValue: true },
  real_first_min_score: { label: "Minimum Real info_score", description: "Products with info_score at or above this value rank as 'real'. Range 0-5 (default 4).", group: "listings", defaultValue: "4" },
  logo_height_mobile: { label: "Logo Height — Mobile (px)", description: "Logo height on screens below 768px. Recommended 80–140.", group: "branding", defaultValue: "112" },
  logo_height_desktop: { label: "Logo Height — Desktop (px)", description: "Logo height on screens 768px and up. Recommended 100–180.", group: "branding", defaultValue: "160" },
  logo_max_width_mobile: { label: "Logo Max Width — Mobile (px)", description: "Prevents overflow on small screens.", group: "branding", defaultValue: "200" },
  logo_max_width_desktop: { label: "Logo Max Width — Desktop (px)", description: "Caps logo width on large screens.", group: "branding", defaultValue: "320" },
  upload_max_size_mb: { label: "Max Upload Size (MB)", description: "Maximum allowed size per uploaded file.", group: "uploads", defaultValue: "10" },
  upload_image_quality: { label: "Image Compression Quality (1–100)", description: "JPEG/WebP quality used when compressing uploads. Lower = smaller files.", group: "uploads", defaultValue: "82" },
  footer_badges: { label: "Footer Badges", description: "Directory/award badges shown in the public footer.", group: "badges", defaultValue: DEFAULT_FOOTER_BADGES },
};

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [seoPreview, setSeoPreview] = useState<{ open: boolean; title: string; content: string; loading: boolean }>({
    open: false, title: "", content: "", loading: false,
  });

  const fetchSeoFile = async (type: "robots" | "sitemap") => {
    setSeoPreview({ open: true, title: type === "robots" ? "robots.txt" : "sitemap.xml", content: "", loading: true });
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seo-files?type=${type}${type === "sitemap" ? `&base_url=${encodeURIComponent(window.location.origin)}` : ""}`;
      const res = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setSeoPreview((p) => ({ ...p, content: text, loading: false }));
    } catch (err: any) {
      setSeoPreview((p) => ({ ...p, content: `Error: ${err.message}`, loading: false }));
    }
  };

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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site-settings"] });
      const { loadProductOrderConfig } = await import("@/lib/product-order");
      await loadProductOrderConfig();
      applyThemeFromForm();
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const THEME_KEYS = ["primary_color", "secondary_color", "button_color", "background_color"] as const;
  const isThemeKey = (k: string): k is typeof THEME_KEYS[number] => (THEME_KEYS as readonly string[]).includes(k);

  const applyThemeFromForm = () => {
    applyTheme({
      primary: form.primary_color,
      secondary: form.secondary_color,
      button: form.button_color,
      background: form.background_color,
    });
  };

  // Live preview as the admin edits color fields
  useEffect(() => { applyThemeFromForm(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [form.primary_color, form.secondary_color, form.button_color, form.background_color]);

  const updateField = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const renderField = (key: string) => {
    const def = DEFAULT_SETTINGS[key];
    const val = form[key];
    if (key === "footer_badges") {
      return renderBadgesField();
    }
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
    // Color picker fields
    if (isThemeKey(key)) {
      return renderColorField(key);
    }
    return (
      <div key={key} className="space-y-1.5">
        <Label>{def.label}</Label>
        <Input value={val || ""} onChange={(e) => updateField(key, e.target.value)} placeholder={def.description} />
        <p className="text-[11px] text-muted-foreground">{def.description}</p>
      </div>
    );
  };

  const hslToHex = (hsl: string): string => {
    const m = (hsl || "").trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
    if (!m) return "#000000";
    const h = parseFloat(m[1]) / 360;
    const s = parseFloat(m[2]) / 100;
    const l = parseFloat(m[3]) / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r: number, g: number, b: number;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const renderColorField = (key: string) => {
    const def = DEFAULT_SETTINGS[key];
    const val = form[key] || def.defaultValue;
    const normalized = normalizeColor(val) || def.defaultValue;
    const hex = hslToHex(normalized);
    return (
      <div key={key} className="space-y-1.5">
        <Label>{def.label}</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={hex}
            onChange={(e) => updateField(key, e.target.value)}
            className="h-10 w-14 rounded-md border border-border bg-transparent cursor-pointer"
            aria-label={`${def.label} picker`}
          />
          <Input
            value={val || ""}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder="#1ea7c4 or 190 75% 42%"
            className="font-mono text-xs"
          />
          <div
            className="h-10 w-10 rounded-md border border-border shrink-0"
            style={{ backgroundColor: `hsl(${normalized})` }}
            aria-hidden
          />
        </div>
        <p className="text-[11px] text-muted-foreground">{def.description}</p>
      </div>
    );
  };

  const resetTheme = () => {
    THEME_KEYS.forEach((k) => updateField(k, DEFAULT_SETTINGS[k].defaultValue));
  };

  const renderBadgesField = () => {
    const badges: FooterBadgeItem[] = Array.isArray(form.footer_badges) ? form.footer_badges : DEFAULT_FOOTER_BADGES;
    const updateBadge = (idx: number, patch: Partial<FooterBadgeItem>) => {
      const next = badges.map((b, i) => (i === idx ? { ...b, ...patch } : b));
      updateField("footer_badges", next);
    };
    const removeBadge = (idx: number) => updateField("footer_badges", badges.filter((_, i) => i !== idx));
    const addBadge = () =>
      updateField("footer_badges", [...badges, { name: "New Badge", href: "https://", src: "" }]);
    const resetBadges = () => updateField("footer_badges", DEFAULT_FOOTER_BADGES);
    return (
      <div key="footer_badges" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Footer Badges</p>
            <p className="text-xs text-muted-foreground">Add, edit, remove, or reorder the directory badges shown in the footer. Provide a dark-mode source for theme-aware swapping.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetBadges} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={addBadge} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add badge
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {badges.map((b, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-md bg-foreground/95 p-3 flex items-center justify-center min-w-[180px] min-h-[64px]">
                  <FooterBadge badge={b} />
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name (alt text)</Label>
                    <Input value={b.name} onChange={(e) => updateBadge(idx, { name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Link URL</Label>
                    <Input value={b.href} onChange={(e) => updateBadge(idx, { href: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Image URL (light)</Label>
                    <Input value={b.src} onChange={(e) => updateBadge(idx, { src: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Image URL (dark, optional)</Label>
                    <Input value={b.srcDark || ""} onChange={(e) => updateBadge(idx, { srcDark: e.target.value || undefined })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Width</Label>
                      <Input type="number" value={b.width ?? ""} onChange={(e) => updateBadge(idx, { width: e.target.value ? Number(e.target.value) : undefined })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Height</Label>
                      <Input type="number" value={b.height ?? ""} onChange={(e) => updateBadge(idx, { height: e.target.value ? Number(e.target.value) : undefined })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">rel attribute (optional)</Label>
                    <Input value={b.rel || ""} placeholder="noopener noreferrer" onChange={(e) => updateBadge(idx, { rel: e.target.value || undefined })} />
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeBadge(idx)} aria-label={`Remove ${b.name}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const groups = [
    { id: "general", label: "General", icon: Globe, keys: ["site_name", "site_tagline", "contact_email"] },
    { id: "branding", label: "Branding", icon: ImageIcon, keys: ["logo_height_mobile", "logo_height_desktop", "logo_max_width_mobile", "logo_max_width_desktop"] },
    { id: "badges", label: "Badges", icon: Award, keys: ["footer_badges"] },
    { id: "uploads", label: "Uploads", icon: Upload, keys: ["upload_max_size_mb", "upload_image_quality"] },
    { id: "theme", label: "Theme", icon: Paintbrush, keys: ["primary_color", "secondary_color", "button_color", "background_color"] },
    { id: "listings", label: "Listings", icon: ListOrdered, keys: ["real_first_enabled", "real_first_min_score"] },
    { id: "moderation", label: "Moderation", icon: Shield, keys: ["reviews_require_approval", "allow_anonymous_reviews", "max_reviews_per_user_per_product"] },
    { id: "appearance", label: "Appearance", icon: Palette, keys: ["footer_text"] },
    { id: "email", label: "Email", icon: Mail, keys: ["smtp_from_email", "smtp_from_name"] },
    { id: "seo", label: "SEO", icon: Search, keys: ["seo_default_title", "seo_default_description", "seo_default_keywords", "seo_default_og_image", "seo_google_verification", "seo_bing_verification", "robots_txt", "sitemap_include_products", "sitemap_include_categories", "sitemap_include_blog", "sitemap_include_comparisons"] },
  ];

  return (
    <>
      <SeoHead title="Settings - Admin" robots="noindex, nofollow" />
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
                  {g.id === "branding" && (
                    <div className="pt-4 border-t border-border space-y-4">
                      <p className="text-sm font-medium text-foreground">Live Preview</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mobile</p>
                          <div className="flex items-center justify-center bg-muted/40 rounded-lg p-4 min-h-[140px]">
                            <img decoding="async" loading="lazy"
                              src={logoAsset.url}
                              alt="Logo preview mobile"
                              className="w-auto object-contain"
                              style={{
                                height: `${parseInt(form.logo_height_mobile) || 112}px`,
                                maxWidth: `${parseInt(form.logo_max_width_mobile) || 200}px`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Desktop</p>
                          <div className="flex items-center justify-center bg-muted/40 rounded-lg p-4 min-h-[200px]">
                            <img decoding="async" loading="lazy"
                              src={logoAsset.url}
                              alt="Logo preview desktop"
                              className="w-auto object-contain"
                              style={{
                                height: `${parseInt(form.logo_height_desktop) || 160}px`,
                                maxWidth: `${parseInt(form.logo_max_width_desktop) || 320}px`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Click "Save All" to apply across the site header.</p>
                    </div>
                  )}
                  {g.id === "seo" && (
                    <div className="flex gap-3 pt-2 border-t border-border">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => fetchSeoFile("robots")}>
                        <Eye className="h-3.5 w-3.5" /> Preview robots.txt
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => fetchSeoFile("sitemap")}>
                        <Eye className="h-3.5 w-3.5" /> Preview sitemap.xml
                      </Button>
                    </div>
                  )}
                  {g.id === "theme" && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">Live Preview</p>
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={resetTheme}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
                        </Button>
                      </div>
                      <div
                        className="rounded-xl border border-border p-6 space-y-4"
                        style={{ backgroundColor: `hsl(${normalizeColor(form.background_color) || "200 50% 98%"})` }}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            className="px-4 py-2 rounded-md text-white text-sm font-medium shadow"
                            style={{ backgroundColor: `hsl(${normalizeColor(form.button_color) || "190 75% 42%"})` }}
                          >Primary Button</button>
                          <button
                            className="px-4 py-2 rounded-md text-white text-sm font-medium shadow"
                            style={{ backgroundColor: `hsl(${normalizeColor(form.secondary_color) || "175 55% 45%"})` }}
                          >Secondary Button</button>
                          <span
                            className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: `hsl(${normalizeColor(form.primary_color) || "190 75% 42%"})` }}
                          >Primary Badge</span>
                        </div>
                        <div className="flex gap-3">
                          {(["primary_color","secondary_color","button_color","background_color"] as const).map((k) => (
                            <div key={k} className="flex-1">
                              <div className="h-12 rounded-md border border-border" style={{ backgroundColor: `hsl(${normalizeColor(form[k]) || DEFAULT_SETTINGS[k].defaultValue})` }} />
                              <p className="text-[10px] mt-1 text-center text-muted-foreground">{DEFAULT_SETTINGS[k].label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Changes preview instantly across the entire app. Click "Save All" to persist.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <Dialog open={seoPreview.open} onOpenChange={(open) => setSeoPreview((p) => ({ ...p, open }))}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{seoPreview.title}</DialogTitle>
            </DialogHeader>
            {seoPreview.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/50 rounded-lg p-4 text-foreground">
                  {seoPreview.content}
                </pre>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
