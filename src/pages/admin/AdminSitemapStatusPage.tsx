import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, RefreshCw, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type LogRow = {
  id: string;
  sitemap_type: string;
  source: string;
  target_url: string | null;
  status_code: number | null;
  success: boolean;
  error: string | null;
  trigger_slug: string | null;
  created_at: string;
};

const TYPES = ["blog", "guides", "glossary"] as const;

export default function AdminSitemapStatusPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["sitemap-resub-log"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sitemap_resubmission_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as LogRow[];
    },
    refetchInterval: 30000,
  });

  const latestByType = TYPES.map((t) => ({
    type: t,
    last: logs.find((l) => l.sitemap_type === t) || null,
  }));

  const resubmit = useMutation({
    mutationFn: async (type: string) => {
      const { data, error } = await supabase.functions.invoke("resubmit-sitemaps", {
        body: { type, source: "manual" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, type) => {
      toast({ title: `Resubmitted ${type}`, description: "Check the log below for the result." });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["sitemap-resub-log"] }), 800);
    },
    onError: (e: any) => toast({ title: "Resubmit failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <>
      <SeoHead title="Sitemap Status - Admin" robots="noindex, nofollow" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sitemap Status</h1>
          <p className="text-muted-foreground">Last regeneration and Google Search Console resubmission per sitemap.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {latestByType.map(({ type, last }) => {
            const ok = last?.success;
            return (
              <Card key={type} className="border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base capitalize">{type}</CardTitle>
                  {last ? (
                    ok ? <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                       : <XCircle className="h-5 w-5 text-destructive" />
                  ) : <Clock className="h-5 w-5 text-muted-foreground" />}
                </CardHeader>
                <CardContent className="space-y-3">
                  {last ? (
                    <>
                      <div className="text-sm">
                        <div className="text-foreground font-medium">
                          {ok ? "Last submission OK" : "Last submission failed"}
                          {last.status_code != null && (
                            <Badge variant="outline" className="ml-2 text-[10px]">HTTP {last.status_code}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(last.created_at), { addSuffix: true })} · via {last.source}
                        </div>
                        {last.error && (
                          <div className="text-xs text-destructive mt-2 line-clamp-3 break-words">{last.error}</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">No submissions logged yet.</div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resubmit.isPending}
                    onClick={() => resubmit.mutate(type)}
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${resubmit.isPending && resubmit.variables === type ? "animate-spin" : ""}`} />
                    Resubmit now
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent submissions</CardTitle>
            <Button size="sm" variant="outline" disabled={resubmit.isPending} onClick={() => resubmit.mutate("all")}>
              <RefreshCw className={`h-4 w-4 mr-2 ${resubmit.isPending && resubmit.variables === "all" ? "animate-spin" : ""}`} />
              Resubmit all
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />)}</div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No log entries yet. Trigger a resubmit to see results.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap" title={format(new Date(l.created_at), "PPpp")}>
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="capitalize text-sm">{l.sitemap_type}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{l.source}</Badge></TableCell>
                      <TableCell>
                        {l.success
                          ? <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20">OK</Badge>
                          : <Badge variant="destructive">FAIL</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{l.status_code ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{l.trigger_slug ?? "—"}</TableCell>
                      <TableCell className="text-xs text-destructive truncate max-w-[260px]" title={l.error ?? ""}>
                        {l.error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
