import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Trash2, TrendingDown, Star, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

const alertIcons: Record<string, any> = {
  price_drop: TrendingDown,
  rating_change: Star,
  new_review: MessageSquare,
};

const alertLabels: Record<string, string> = {
  price_drop: "Price Drop",
  rating_change: "Rating Change",
  new_review: "New Review",
};

export function SmartAlertsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["smart-alerts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_alerts")
        .select("*, products(id, name, slug, logo_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["alert-history", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("alert_history")
        .select("*, products(name, slug)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const toggleAlert = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from("price_alerts").update({ is_active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smart-alerts"] }),
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("price_alerts").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Alert removed");
      qc.invalidateQueries({ queryKey: ["smart-alerts"] });
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">Active Alerts</h3>
        <p className="text-sm text-muted-foreground mb-4">Get notified when products you track change.</p>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12">
          <BellOff className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h4 className="font-semibold text-foreground mb-1">No alerts set</h4>
          <p className="text-sm text-muted-foreground">Visit any product page and click "Set Alert" to start monitoring.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert: any, i: number) => {
            const Icon = alertIcons[alert.alert_type] || Bell;
            return (
              <motion.div key={alert.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{(alert as any).products?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px] mr-1">{alertLabels[alert.alert_type]}</Badge>
                        {alert.threshold_value && `Threshold: ${alert.threshold_value}`}
                      </p>
                    </div>
                    <Switch checked={alert.is_active} onCheckedChange={(v) => toggleAlert.mutate({ id: alert.id, is_active: v })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteAlert.mutate(alert.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-foreground mb-3">Alert History</h4>
          <div className="space-y-1.5">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-muted/20">
                <Bell className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-foreground">{h.message || `${alertLabels[h.alert_type]} on ${(h as any).products?.name}`}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
