import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MessageSquare, Copy, Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

type Template = { id: string; name: string; body: string };

const DEFAULT_TEMPLATES: Template[] = [
  { id: "thank-positive", name: "Thank for Positive Review", body: "Thank you for your wonderful review! We're glad you're enjoying {product_name}. Your feedback helps us continue improving." },
  { id: "address-issue", name: "Address an Issue", body: "Thank you for taking the time to share your experience. We're sorry to hear about the issue you encountered. Our team is looking into it and we'd love to help — please reach out to our support team at support@example.com." },
  { id: "feature-request", name: "Feature Request Acknowledgment", body: "We appreciate your feedback and the feature suggestion! We've noted your request and our product team will review it for future updates. Thanks for helping us improve {product_name}." },
  { id: "general-thanks", name: "General Thanks", body: "Thank you for reviewing {product_name}! We value every piece of feedback from our users." },
];

export default function VendorResponseTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", body: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", body: "" });

  // Fetch vendor's recent reviews to show response context
  const { data: recentReviews = [] } = useQuery({
    queryKey: ["vendor-reviews-for-templates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: claims } = await supabase
        .from("product_claims")
        .select("product_id")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      if (!claims?.length) return [];
      const productIds = claims.map((c) => c.product_id);
      const { data } = await supabase
        .from("reviews")
        .select("id, title, overall_rating, body, products!reviews_product_id_fkey(name)")
        .in("product_id", productIds)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const copyTemplate = (body: string) => {
    navigator.clipboard.writeText(body);
    toast.success("Template copied to clipboard");
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setEditForm({ name: t.name, body: t.body });
  };

  const saveEdit = () => {
    setTemplates((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...editForm } : t)));
    setEditingId(null);
    toast.success("Template updated");
  };

  const addTemplate = () => {
    if (!newForm.name.trim()) return;
    setTemplates((prev) => [...prev, { id: `custom-${Date.now()}`, ...newForm }]);
    setNewForm({ name: "", body: "" });
    setIsAdding(false);
    toast.success("Template added");
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template removed");
  };

  return (
    <>
      <SeoHead title="Response Templates — Vendor" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Response Templates</h1>
            <p className="text-muted-foreground mt-1">Quick-reply templates for responding to reviews</p>
          </div>
          <Button className="gap-1.5" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>

        {/* Add Template Form */}
        {isAdding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card p-5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">New Template</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsAdding(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="e.g. Thank for feedback" />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea value={newForm.body} onChange={(e) => setNewForm({ ...newForm, body: e.target.value })} rows={4} placeholder="Use {product_name} as a placeholder..." />
            </div>
            <Button onClick={addTemplate} disabled={!newForm.name.trim()} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </motion.div>
        )}

        {/* Templates List */}
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="glass-card p-5">
              {editingId === t.id ? (
                <div className="space-y-3">
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <Textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} rows={4} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm text-foreground">{t.name}</h3>
                      {t.id.startsWith("custom-") && <Badge variant="outline" className="text-[10px]">Custom</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyTemplate(t.body)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.body}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent Reviews for Context */}
        {recentReviews.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-display font-bold text-foreground mb-4">Recent Reviews to Respond To</h2>
            <div className="space-y-2">
              {recentReviews.map((r: any) => (
                <div key={r.id} className="glass-card p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{r.title || "Untitled Review"}</p>
                    <p className="text-xs text-muted-foreground">{(r.products as any)?.name} · {r.overall_rating}★</p>
                  </div>
                  <Button variant="outline" size="sm" className="ml-4 gap-1.5 flex-shrink-0" asChild>
                    <a href={`/vendor/reviews`}>
                      <MessageSquare className="h-3 w-3" /> Respond
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
