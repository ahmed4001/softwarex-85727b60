import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from "lucide-react";

interface Sub {
  plan: string;
  status: string;
  current_period_end: string | null;
  expires_at: string | null;
  canceled_at: string | null;
  last_event_at: string | null;
  paddle_subscription_id: string | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function statusCopy(sub: Sub | null): { tone: "ok" | "warn" | "danger" | "muted"; title: string; reason?: string } {
  if (!sub) {
    return { tone: "muted", title: "No plan selected", reason: "Choose a plan to get listed on ReviewHunts." };
  }
  if (sub.status === "canceled") {
    return {
      tone: "danger",
      title: "Subscription canceled",
      reason: `Your ${sub.plan} subscription ended on ${formatDate(sub.canceled_at || sub.current_period_end)}. Choose a plan to reactivate paid features.`,
    };
  }
  if (sub.status === "past_due") {
    return {
      tone: "warn",
      title: "Payment past due",
      reason: "Your last payment didn't go through. Update your card in Paddle to keep your paid plan active — your listing will revert to Free if the period ends without payment.",
    };
  }
  const end = sub.current_period_end || sub.expires_at;
  if (end && new Date(end).getTime() < Date.now()) {
    return {
      tone: "warn",
      title: "Plan period ended",
      reason: `Your ${sub.plan} billing period ended on ${formatDate(end)} and we haven't received a renewal from Paddle yet. We're checking — if this persists please contact support.`,
    };
  }
  if (sub.plan === "free") return { tone: "muted", title: "Free plan", reason: "Upgrade for featured placement and promotion." };
  return { tone: "ok", title: `${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} plan — active` };
}

export function VendorBillingStatusWidget() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<Sub | null>({
    queryKey: ["vendor-billing-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_subscriptions")
        .select("plan, status, current_period_end, expires_at, canceled_at, last_event_at, paddle_subscription_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any) ?? null;
    },
  });

  if (isLoading) return null;
  const copy = statusCopy(data ?? null);
  const end = data?.current_period_end || data?.expires_at;

  const toneStyles: Record<string, string> = {
    ok: "border-emerald-500/40 bg-emerald-500/5",
    warn: "border-amber-500/50 bg-amber-500/5",
    danger: "border-rose-500/50 bg-rose-500/5",
    muted: "border-border bg-muted/30",
  };
  const Icon = copy.tone === "ok" ? CheckCircle2 : copy.tone === "muted" ? CreditCard : copy.tone === "warn" ? Clock : AlertTriangle;

  return (
    <Card className={toneStyles[copy.tone]}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <CardTitle className="text-sm font-semibold">{copy.title}</CardTitle>
        </div>
        <Badge variant={copy.tone === "ok" ? "default" : copy.tone === "danger" ? "destructive" : "secondary"} className="text-[10px] uppercase tracking-wide">
          {data?.status || "none"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Plan</div>
            <div className="font-medium">{data?.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{data?.status === "canceled" ? "Ended" : "Renews"}</div>
            <div className="font-medium">{formatDate(end)}</div>
          </div>
        </div>
        {copy.reason && <p className="text-xs text-muted-foreground leading-relaxed">{copy.reason}</p>}
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link to="/vendor/plans">Manage plan</Link>
          </Button>
          {(copy.tone === "warn" || copy.tone === "danger") && (
            <Button asChild size="sm" className="h-8 text-xs">
              <Link to="/vendor/plans">Resolve</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
