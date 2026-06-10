import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Search } from "lucide-react";

type Row = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  paddle_subscription_id: string | null;
  current_period_end: string | null;
  last_event_at: string | null;
  canceled_at: string | null;
  created_at: string;
  email?: string | null;
  drift_count?: number;
};

function csvEscape(v: unknown) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AdminSubscriptionsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");

  const { data, isLoading } = useQuery<Row[]>({
    queryKey: ["admin-vendor-subscriptions"],
    queryFn: async () => {
      const { data: subs } = await (supabase as any)
        .from("vendor_subscriptions")
        .select("id, user_id, plan, status, paddle_subscription_id, current_period_end, last_event_at, canceled_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const rows: Row[] = (subs as Row[]) ?? [];
      if (rows.length === 0) return rows;

      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const subIds = rows.map((r) => r.paddle_subscription_id).filter(Boolean) as string[];

      const [{ data: emails }, { data: drift }] = await Promise.all([
        (supabase as any).rpc("admin_get_user_emails", { _user_ids: userIds }),
        subIds.length
          ? (supabase as any)
              .from("paddle_drift_events")
              .select("paddle_subscription_id, created_at")
              .in("paddle_subscription_id", subIds)
              .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          : Promise.resolve({ data: [] }),
      ]);

      const emailMap = new Map<string, string>();
      (emails ?? []).forEach((e: any) => emailMap.set(e.user_id, e.email));
      const driftMap = new Map<string, number>();
      (drift ?? []).forEach((d: any) => driftMap.set(d.paddle_subscription_id, (driftMap.get(d.paddle_subscription_id) ?? 0) + 1));

      return rows.map((r) => ({
        ...r,
        email: emailMap.get(r.user_id) ?? null,
        drift_count: r.paddle_subscription_id ? (driftMap.get(r.paddle_subscription_id) ?? 0) : 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (plan !== "all" && r.plan !== plan) return false;
      if (q && !`${r.email ?? ""} ${r.user_id} ${r.paddle_subscription_id ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, status, plan, q]);

  function exportCsv() {
    const cols = ["user_email", "user_id", "plan", "status", "paddle_subscription_id", "current_period_end", "last_event_at", "canceled_at", "drift_30d", "created_at"];
    const lines = [cols.join(",")];
    filtered.forEach((r) => {
      lines.push([r.email, r.user_id, r.plan, r.status, r.paddle_subscription_id, r.current_period_end, r.last_event_at, r.canceled_at, r.drift_count, r.created_at].map(csvEscape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendor-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Vendor Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan, billing period, last Paddle event, and reconciliation drift.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5" /> CSV</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Email, user id, Paddle sub id…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-7 h-9 text-xs" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="promotion">Promotion</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period end</TableHead>
                    <TableHead>Last event</TableHead>
                    <TableHead>Drift (30d)</TableHead>
                    <TableHead>Paddle sub</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const drift = r.drift_count ?? 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">
                          <div className="font-medium">{r.email ?? "—"}</div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">{r.user_id}</div>
                        </TableCell>
                        <TableCell className="text-xs">{r.plan}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "active" ? "secondary" : r.status === "past_due" ? "outline" : "destructive"} className="text-[10px] uppercase">{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.last_event_at ? new Date(r.last_event_at).toLocaleString() : "—"}</TableCell>
                        <TableCell>
                          {drift === 0 ? (
                            <span className="text-xs text-muted-foreground">0</span>
                          ) : (
                            <Badge variant={drift >= 3 ? "destructive" : "outline"} className="text-[10px]">{drift}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] truncate max-w-[160px]">{r.paddle_subscription_id ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No subscriptions match these filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
