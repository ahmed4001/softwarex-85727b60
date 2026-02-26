import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Globe, Trash2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

export default function AdminLandingPagesPage() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin-landing-pages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_landing_pages")
        .select("*, categories(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("seo_landing_pages").update({ is_published: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seo_landing_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success("Page deleted");
    },
  });

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-landing-pages");
      if (error) throw error;
      toast.success(`Generated ${data?.count || 0} landing pages`);
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <SeoHead title="Landing Pages - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">SEO Landing Pages</h1>
            <p className="text-muted-foreground text-sm">{pages.length} pages · AI-generated programmatic SEO</p>
          </div>
          <Button onClick={generate} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Pages
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : pages.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No landing pages yet. Click Generate to create AI-powered SEO pages.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pages.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>/best/{p.slug}</span>
                      {p.audience && <Badge variant="outline" className="text-[10px]">{p.audience}</Badge>}
                      {(p.categories as any)?.name && <Badge variant="secondary" className="text-[10px]">{(p.categories as any).name}</Badge>}
                      <span>{p.view_count} views</span>
                      <span>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <Switch checked={p.is_published} onCheckedChange={(v) => togglePublish.mutate({ id: p.id, value: v })} />
                  <Link to={`/best/${p.slug}`} target="_blank">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
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
