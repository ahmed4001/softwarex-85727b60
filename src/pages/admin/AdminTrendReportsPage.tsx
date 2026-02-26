import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

export default function AdminTrendReportsPage() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-trend-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("category_trend_reports")
        .select("*, categories(name)")
        .order("report_date", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  return (
    <>
      <SeoHead title="Trend Reports — Admin" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Category Trend Reports</h1>
          <p className="text-muted-foreground">{reports.length} reports</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : reports.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No trend reports yet. Generate them via AI or scheduled tasks.</p>
        ) : (
          <div className="space-y-4">
            {reports.map((r: any) => {
              const rising = Array.isArray(r.rising_products) ? r.rising_products : [];
              const falling = Array.isArray(r.falling_products) ? r.falling_products : [];
              return (
                <Card key={r.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-foreground">{r.categories?.name || "All Categories"}</h3>
                        <p className="text-xs text-muted-foreground">{r.period} · {r.report_date}</p>
                      </div>
                      <Badge variant={r.is_published ? "default" : "outline"}>{r.is_published ? "Published" : "Draft"}</Badge>
                    </div>
                    {r.summary && <p className="text-sm text-muted-foreground mb-3">{r.summary}</p>}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-[hsl(var(--success))] flex items-center gap-1 mb-1"><TrendingUp className="h-3 w-3" /> Rising</h4>
                        <div className="space-y-1">{rising.length > 0 ? rising.map((p: any, i: number) => <p key={i} className="text-sm text-foreground">{typeof p === "string" ? p : p.name}</p>) : <p className="text-xs text-muted-foreground">None</p>}</div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-destructive flex items-center gap-1 mb-1"><TrendingDown className="h-3 w-3" /> Falling</h4>
                        <div className="space-y-1">{falling.length > 0 ? falling.map((p: any, i: number) => <p key={i} className="text-sm text-foreground">{typeof p === "string" ? p : p.name}</p>) : <p className="text-xs text-muted-foreground">None</p>}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
