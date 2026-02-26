import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Compass, Plus, Eye, Users, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminBuyerGuidesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", slug: "", description: "", steps: "[]", result_product_ids: "[]" });

  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["admin-buyer-guides"],
    queryFn: async () => {
      const { data } = await supabase
        .from("buyer_guides")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createGuide = useMutation({
    mutationFn: async () => {
      let steps, result_product_ids;
      try { steps = JSON.parse(form.steps); } catch { throw new Error("Invalid steps JSON"); }
      try { result_product_ids = JSON.parse(form.result_product_ids); } catch { throw new Error("Invalid product IDs JSON"); }
      await supabase.from("buyer_guides").insert({
        title: form.title,
        slug: form.slug,
        description: form.description,
        steps,
        result_product_ids,
        is_published: false,
      });
    },
    onSuccess: () => {
      toast.success("Guide created");
      setShowForm(false);
      setForm({ title: "", slug: "", description: "", steps: "[]", result_product_ids: "[]" });
      qc.invalidateQueries({ queryKey: ["admin-buyer-guides"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      await supabase.from("buyer_guides").update({ is_published: published }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-buyer-guides"] }),
  });

  const deleteGuide = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("buyer_guides").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Guide deleted");
      qc.invalidateQueries({ queryKey: ["admin-buyer-guides"] });
    },
  });

  return (
    <>
      <SeoHead title="Buyer Guides — Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Compass className="h-6 w-6 text-primary" /> Buyer Guides
            </h1>
            <p className="text-muted-foreground text-sm">Create interactive product recommendation wizards</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5"><Plus className="h-4 w-4" /> New Guide</Button>
        </div>

        {showForm && (
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-3">
              <Input placeholder="Guide title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="URL slug (e.g. best-crm-for-startups)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              <Textarea placeholder='Steps JSON: [{"question":"...","options":[{"label":"...","filter":"..."}]}]' value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} rows={4} className="font-mono text-xs" />
              <Textarea placeholder='Result product IDs JSON: ["uuid1","uuid2"]' value={form.result_product_ids} onChange={(e) => setForm({ ...form, result_product_ids: e.target.value })} rows={2} className="font-mono text-xs" />
              <Button onClick={() => createGuide.mutate()} disabled={!form.title || !form.slug}>Create Guide</Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div>
        ) : guides.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No buyer guides created yet.</p>
        ) : (
          <div className="space-y-2">
            {guides.map((g: any) => (
              <Card key={g.id} className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <Compass className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{g.title}</p>
                    <p className="text-xs text-muted-foreground">/guides/{g.slug} · <Eye className="h-3 w-3 inline" /> {g.view_count} · <Users className="h-3 w-3 inline" /> {g.completion_count} completed</p>
                  </div>
                  <Switch checked={g.is_published} onCheckedChange={(v) => togglePublish.mutate({ id: g.id, published: v })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteGuide.mutate(g.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
