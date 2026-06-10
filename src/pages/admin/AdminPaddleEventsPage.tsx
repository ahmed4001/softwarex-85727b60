import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, RotateCw, Search, Eye } from "lucide-react";

type Evt = {
  event_id: string;
  event_type: string;
  user_id: string | null;
  plan: string | null;
  signature_valid: boolean;
  received_at: string;
  payload: any;
};

export default function AdminPaddleEventsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [viewing, setViewing] = useState<Evt | null>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Evt[]>({
    queryKey: ["admin-paddle-events"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("paddle_webhook_events")
        .select("event_id, event_type, user_id, plan, signature_valid, received_at, payload")
        .order("received_at", { ascending: false })
        .limit(200);
      return (data as Evt[]) ?? [];
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["admin-paddle-alerts"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("paddle_alerts")
        .select("id, kind, severity, message, paddle_subscription_id, created_at, resolved_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: auditLog } = useQuery({
    queryKey: ["admin-paddle-reprocess-audit"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("paddle_reprocess_audit")
        .select("id, admin_email, event_id, event_type, status, actions, error, ip_address, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("paddle_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
      toast.success("Alert resolved");
      qc.invalidateQueries({ queryKey: ["admin-paddle-alerts"] });
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((e) => {
      if (type !== "all" && e.event_type !== type) return false;
      if (q && !`${e.event_id} ${e.event_type} ${e.user_id ?? ""} ${e.plan ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, type, q]);

  const eventTypes = useMemo(() => Array.from(new Set((data ?? []).map((e) => e.event_type))).sort(), [data]);

  async function handleReprocess(event_id: string) {
    setReprocessing(event_id);
    try {
      const { data, error } = await supabase.functions.invoke("paddle-reprocess-event", { body: { event_id } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success(`Reprocessed: ${((data as any)?.actions || []).join(", ") || "ok"}`);
      qc.invalidateQueries({ queryKey: ["admin-paddle-events"] });
      qc.invalidateQueries({ queryKey: ["admin-paddle-reprocess-audit"] });
    } catch (e: any) {
      toast.error(e.message || "Reprocess failed");
    } finally {
      setReprocessing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Paddle Webhook Events</h1>
        <p className="text-muted-foreground text-sm mt-1">Inspect recent webhook deliveries and manually reprocess after fixing failures.</p>
      </div>

      {alerts && alerts.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open alerts ({alerts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-xs border-b border-amber-500/20 last:border-0 pb-2 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-[10px]">{a.kind}</Badge>
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1">{a.message}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => resolveAlert.mutate(a.id)}>Resolve</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search event id, user, plan…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-7 h-9 text-xs" />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[220px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {eventTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                    <TableHead>Event</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Sig</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.event_id}>
                      <TableCell className="font-mono text-[11px] max-w-[220px] truncate">{e.event_id}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{e.event_type}</Badge></TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[140px] truncate">{e.user_id ?? "—"}</TableCell>
                      <TableCell className="text-xs">{e.plan ?? "—"}</TableCell>
                      <TableCell>{e.signature_valid ? <Badge variant="secondary" className="text-[10px]">ok</Badge> : <Badge variant="destructive" className="text-[10px]">fail</Badge>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(e.received_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(e)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" disabled={reprocessing === e.event_id || !e.payload} onClick={() => handleReprocess(e.event_id)}>
                          {reprocessing === e.event_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No events match these filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Reprocess audit log</CardTitle>
          <p className="text-xs text-muted-foreground">Last 50 admin reprocess attempts. Rate limit: 10 per 5 min, 50 per hour per admin.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions / Error</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(auditLog ?? []).map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{row.admin_email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-[10px] max-w-[180px] truncate">{row.event_id}</TableCell>
                    <TableCell className="text-xs">{row.event_type ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "success" ? "secondary"
                          : row.status === "no_action" ? "outline"
                          : row.status === "denied_rate_limited" ? "destructive"
                          : row.status?.startsWith("denied") ? "destructive"
                          : row.status === "error" ? "destructive"
                          : "outline"
                        }
                        className="text-[10px]"
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] max-w-[260px] truncate">
                      {row.error ? <span className="text-destructive">{row.error}</span> : (Array.isArray(row.actions) ? row.actions.join(", ") : "—")}
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">{row.ip_address ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {(!auditLog || auditLog.length === 0) && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-sm">No reprocess attempts yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="font-mono text-xs">{viewing?.event_id}</DialogTitle></DialogHeader>
          <pre className="text-[10px] bg-muted/50 p-3 rounded-md max-h-[60vh] overflow-auto">{JSON.stringify(viewing?.payload ?? {}, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
