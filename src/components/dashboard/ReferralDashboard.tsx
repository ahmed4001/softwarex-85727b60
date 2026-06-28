import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link2, Copy, MousePointerClick, Users, DollarSign, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

function generateCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function ReferralDashboard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: links, isLoading } = useQuery({
    queryKey: ["referral-links", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("referral_links")
        .select("*, products(name, slug, logo_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: payouts } = useQuery({
    queryKey: ["referral-payouts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("referral_payouts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const createLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("referral_links").insert({
        user_id: userId,
        code: generateCode(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referral link created!");
      queryClient.invalidateQueries({ queryKey: ["referral-links", userId] });
      setCreating(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`);
    toast.success("Referral link copied!");
  };

  const totalClicks = (links || []).reduce((sum: number, l: any) => sum + (l.clicks || 0), 0);
  const totalConversions = (links || []).reduce((sum: number, l: any) => sum + (l.conversions || 0), 0);
  const totalEarnings = (payouts || []).filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground">Referral Program</h3>
        </div>
        <Button size="sm" onClick={() => createLink.mutate()} disabled={createLink.isPending} className="gap-1.5">
          {createLink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          New Link
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <MousePointerClick className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{totalClicks}</p>
            <p className="text-[11px] text-muted-foreground">Clicks</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{totalConversions}</p>
            <p className="text-[11px] text-muted-foreground">Conversions</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-5 w-5 text-[hsl(var(--success))] mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">${totalEarnings.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Links */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : (links || []).length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No referral links yet. Create one to start earning!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(links || []).map((link: any) => (
            <Card key={link.id} className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                {link.products?.logo_url ? (
                  <img decoding="async" loading="lazy" src={link.products.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground">{link.code}</code>
                    {link.products?.name && <span className="text-xs text-muted-foreground">· {link.products.name}</span>}
                    <Badge variant={link.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {link.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{link.clicks} clicks · {link.conversions} conversions</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copyLink(link.code)} className="gap-1 text-xs">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payouts */}
      {(payouts || []).length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-foreground mb-2">Payout History</h4>
          <div className="space-y-1.5">
            {(payouts || []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
                <span className="text-muted-foreground">${Number(p.amount).toFixed(2)} · {p.referral_count} referrals</span>
                <Badge variant={p.status === "paid" ? "default" : "outline"} className="text-xs capitalize">{p.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
