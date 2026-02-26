import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Database, Image, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

function HealthItem({ icon: Icon, label, value, status }: {
  icon: any; label: string; value: string; status: "ok" | "warn" | "error";
}) {
  const statusColor = status === "ok" ? "text-[hsl(var(--success))]" : status === "warn" ? "text-[hsl(var(--warning))]" : "text-destructive";
  const StatusIcon = status === "ok" ? CheckCircle2 : AlertTriangle;

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/30 transition-colors">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
      <StatusIcon className={`h-4 w-4 ${statusColor}`} />
    </div>
  );
}

export function SystemHealthPanel() {
  const { data: health } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: async () => {
      const [products, pendingReviews, brevoAccounts, mediaCount] = await Promise.all([
        supabase.from("products").select("id, logo_url, website_url", { count: "exact" }).eq("is_active", true),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("brevo_accounts").select("id, is_active, credits_used_today, daily_credit_limit").eq("is_active", true),
        supabase.from("media_library").select("id", { count: "exact", head: true }),
      ]);

      const totalProducts = products.count || 0;
      const productsData = products.data || [];
      const missingLogos = productsData.filter((p) => !p.logo_url).length;
      const missingUrls = productsData.filter((p) => !p.website_url).length;
      const pending = pendingReviews.count || 0;
      const brevo = brevoAccounts.data || [];
      const totalCredits = brevo.reduce((s, a) => s + (a.daily_credit_limit || 300), 0);
      const usedCredits = brevo.reduce((s, a) => s + (a.credits_used_today || 0), 0);
      const media = mediaCount.count || 0;

      return {
        totalProducts,
        missingLogos,
        missingUrls,
        pending,
        brevoAccounts: brevo.length,
        totalCredits,
        usedCredits,
        media,
      };
    },
    refetchInterval: 60000,
  });

  if (!health) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">System Health</h3>
          </div>
          <div className="space-y-0.5">
            <HealthItem
              icon={Database}
              label="Product Data"
              value={`${health.totalProducts} products · ${health.missingLogos} missing logos`}
              status={health.missingLogos > 20 ? "warn" : "ok"}
            />
            <HealthItem
              icon={AlertTriangle}
              label="Pending Reviews"
              value={`${health.pending} awaiting moderation`}
              status={health.pending > 10 ? "warn" : "ok"}
            />
            <HealthItem
              icon={Mail}
              label="Email Credits"
              value={`${health.usedCredits}/${health.totalCredits} used · ${health.brevoAccounts} accounts`}
              status={health.usedCredits / Math.max(health.totalCredits, 1) > 0.8 ? "warn" : "ok"}
            />
            <HealthItem
              icon={Image}
              label="Media Library"
              value={`${health.media} files`}
              status="ok"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
