import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type Row = {
  id: string;
  page_url: string;
  page_type: string | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
  avg_position: number | null;
  gap_keywords: any;
  recommendations: any;
  suggested_title: string | null;
  suggested_meta_description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export default function AdminContentRecommendationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["content-recommendations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_recommendations")
        .select("*")
        .order("impressions", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const analyze = useMutation({
    mutationFn: async (targetUrl: string) => {
      const { data, error } = await supabase.functions.invoke("analyze-page-gaps", {
        body: { url: targetUrl, days: 28 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Recommendation generated" });
      qc.invalidateQueries({ queryKey: ["content-recommendations"] });
      setUrl("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "Unknown", variant: "destructive" }),
  });

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <SeoHead title="Content recommendations" description="AI-generated SEO content update recommendations." />
      <div>
        <h1 className="text-3xl font-bold">Content Recommendations</h1>
        <p className="text-muted-foreground mt-1">Keyword-gap analysis + AI recommendations for top-impression pages.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Analyze a URL</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="https://reviewhunts.com/product/some-slug"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && url) analyze.mutate(url); }}
          />
          <Button onClick={() => analyze.mutate(url)} disabled={!url || analyze.isPending}>
            {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recommendations ({rows.length})</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["content-recommendations"] })}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recommendations yet. Paste a URL above to generate one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Impr.</TableHead>
                  <TableHead>Avg pos</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Suggested title</TableHead>
                  <TableHead>Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[280px] truncate">
                      <a href={r.page_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                        <span className="truncate">{r.page_url.replace(/^https?:\/\/[^/]+/, "")}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      </a>
                      {r.page_type && <Badge variant="secondary" className="mt-1 text-[10px]">{r.page_type}</Badge>}
                    </TableCell>
                    <TableCell>{r.impressions}</TableCell>
                    <TableCell>{r.avg_position ? r.avg_position.toFixed(1) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={
                        r.recommendations?.priority === "high" ? "destructive"
                        : r.recommendations?.priority === "medium" ? "default" : "outline"
                      }>{r.recommendations?.priority ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-xs">{r.suggested_title ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.updated_at))} ago</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
