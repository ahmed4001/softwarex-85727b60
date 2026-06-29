import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Vital = {
  id: number;
  metric: string;
  value: number;
  rating: string | null;
  path: string;
  navigation_type: string | null;
  connection: string | null;
  created_at: string;
};

const METRICS = ["LCP", "CLS", "INP", "FCP", "TTFB"] as const;
const RANGE_DAYS: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30 };

// Google's "good" thresholds.
const GOOD: Record<string, number> = { LCP: 2500, CLS: 0.1, INP: 200, FCP: 1800, TTFB: 800 };

function format(metric: string, v: number) {
  if (metric === "CLS") return v.toFixed(3);
  return `${Math.round(v)} ms`;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export default function AdminWebVitalsPage() {
  const [rows, setRows] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<keyof typeof RANGE_DAYS>("7d");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const since = new Date(Date.now() - RANGE_DAYS[range] * 86400_000).toISOString();
    (supabase as any)
      .from("web_vitals")
      .select("id,metric,value,rating,path,navigation_type,connection,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data, error }: any) => {
        if (!active) return;
        if (error) console.error(error);
        setRows((data ?? []) as Vital[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range]);

  const summary = useMemo(() => {
    return METRICS.map((m) => {
      const values = rows.filter((r) => r.metric === m).map((r) => r.value);
      const p75 = percentile(values, 75);
      const good = GOOD[m];
      const status: "good" | "needs" | "poor" =
        !values.length ? "good" : p75 <= good ? "good" : p75 <= good * 1.5 ? "needs" : "poor";
      return { metric: m, count: values.length, p75, status };
    });
  }, [rows]);

  const worstPaths = useMemo(() => {
    const byPath = new Map<string, number[]>();
    rows.filter((r) => r.metric === "LCP").forEach((r) => {
      if (!byPath.has(r.path)) byPath.set(r.path, []);
      byPath.get(r.path)!.push(r.value);
    });
    return Array.from(byPath.entries())
      .map(([path, vals]) => ({ path, samples: vals.length, p75: percentile(vals, 75) }))
      .filter((x) => x.samples >= 3)
      .sort((a, b) => b.p75 - a.p75)
      .slice(0, 15);
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Core Web Vitals</h1>
          <p className="text-sm text-muted-foreground">
            Real-user p75 metrics collected from the production frontend.
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGE_DAYS)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {summary.map((s) => (
          <Card key={s.metric}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                {s.metric}
                <Badge
                  variant={s.status === "good" ? "default" : s.status === "needs" ? "secondary" : "destructive"}
                >
                  {s.status === "good" ? "Good" : s.status === "needs" ? "Needs work" : "Poor"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {s.count ? format(s.metric, s.p75) : "—"}
              </div>
              <div className="text-xs text-muted-foreground">p75 · {s.count} samples</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Slowest pages (LCP p75)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : worstPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet for this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead className="text-right">LCP p75</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {worstPaths.map((r) => (
                  <TableRow key={r.path}>
                    <TableCell className="font-mono text-xs">{r.path}</TableCell>
                    <TableCell className="text-right">{r.samples}</TableCell>
                    <TableCell className="text-right">{format("LCP", r.p75)}</TableCell>
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
