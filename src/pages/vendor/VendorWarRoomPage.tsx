import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Swords, Trophy, XCircle, Clock, Plus, Sparkles, Target, Shield, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function VendorWarRoomPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: claims = [] } = useQuery({
    queryKey: ["vendor-claims-warroom", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("*, products(id, name, slug)")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      return data || [];
    },
  });

  const productIds = claims.map((c: any) => c.products?.id).filter(Boolean);

  const { data: battlecards = [] } = useQuery({
    queryKey: ["battlecards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("competitive_battlecards")
        .select("*, products:product_id(name, slug), competitor:competitor_product_id(name, slug)")
        .eq("vendor_user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["vendor-deals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_deals")
        .select("*, products:product_id(name), competitor:competitor_product_id(name)")
        .eq("vendor_user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Deal form state
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealForm, setDealForm] = useState({ deal_name: "", product_id: "", outcome: "pending", deal_value: "", notes: "" });

  const createDeal = useMutation({
    mutationFn: async () => {
      await supabase.from("vendor_deals").insert({
        vendor_user_id: user!.id,
        deal_name: dealForm.deal_name,
        product_id: dealForm.product_id,
        outcome: dealForm.outcome,
        deal_value: dealForm.deal_value ? Number(dealForm.deal_value) : null,
        notes: dealForm.notes || null,
      });
    },
    onSuccess: () => {
      toast.success("Deal logged");
      setShowDealForm(false);
      setDealForm({ deal_name: "", product_id: "", outcome: "pending", deal_value: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["vendor-deals"] });
    },
  });

  const wonDeals = deals.filter((d: any) => d.outcome === "won").length;
  const lostDeals = deals.filter((d: any) => d.outcome === "lost").length;
  const winRate = wonDeals + lostDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : 0;

  const outcomeIcons: Record<string, any> = { won: Trophy, lost: XCircle, pending: Clock };
  const outcomeColors: Record<string, string> = {
    won: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
    lost: "bg-destructive/10 text-destructive",
    pending: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  };

  return (
    <>
      <SeoHead title="War Room — Vendor Dashboard" description="Competitive intelligence and deal tracking." />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" /> War Room
          </h1>
          <p className="text-muted-foreground mt-1">Competitive battlecards and win/loss tracking</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="border-border/50"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{wonDeals}</p>
            <p className="text-xs text-muted-foreground">Wins</p>
          </CardContent></Card>
          <Card className="border-border/50"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{lostDeals}</p>
            <p className="text-xs text-muted-foreground">Losses</p>
          </CardContent></Card>
          <Card className="border-border/50"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{winRate}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="deals">
          <TabsList className="mb-4">
            <TabsTrigger value="deals" className="gap-1.5"><Target className="h-3.5 w-3.5" /> Deals</TabsTrigger>
            <TabsTrigger value="battlecards" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Battlecards</TabsTrigger>
          </TabsList>

          <TabsContent value="deals">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Deal Tracker</h3>
              <Button size="sm" onClick={() => setShowDealForm(!showDealForm)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Log Deal</Button>
            </div>

            {showDealForm && (
              <Card className="border-border/50 mb-4">
                <CardContent className="p-4 space-y-3">
                  <Input placeholder="Deal name" value={dealForm.deal_name} onChange={(e) => setDealForm({ ...dealForm, deal_name: e.target.value })} />
                  <Select value={dealForm.product_id} onValueChange={(v) => setDealForm({ ...dealForm, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {claims.map((c: any) => <SelectItem key={c.products?.id} value={c.products?.id}>{c.products?.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={dealForm.outcome} onValueChange={(v) => setDealForm({ ...dealForm, outcome: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Deal value ($)" value={dealForm.deal_value} onChange={(e) => setDealForm({ ...dealForm, deal_value: e.target.value })} />
                  </div>
                  <Textarea placeholder="Notes..." value={dealForm.notes} onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })} rows={2} />
                  <Button onClick={() => createDeal.mutate()} disabled={!dealForm.deal_name || !dealForm.product_id}>Save Deal</Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {deals.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No deals logged yet.</p>
              ) : deals.map((deal: any) => {
                const Icon = outcomeIcons[deal.outcome] || Clock;
                return (
                  <Card key={deal.id} className="border-border/50">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${outcomeColors[deal.outcome]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{deal.deal_name}</p>
                        <p className="text-xs text-muted-foreground">{(deal as any).products?.name}{deal.deal_value ? ` · $${Number(deal.deal_value).toLocaleString()}` : ""}</p>
                      </div>
                      <Badge variant={deal.outcome === "won" ? "default" : "secondary"}>{deal.outcome}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="battlecards">
            {battlecards.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <h4 className="font-semibold text-foreground mb-1">No battlecards yet</h4>
                <p className="text-sm text-muted-foreground">Battlecards help you position against competitors. They'll appear here once generated.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {battlecards.map((bc: any) => (
                  <Card key={bc.id} className="border-border/50">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-foreground">{(bc as any).products?.name} vs {(bc as any).competitor?.name}</h4>
                        {bc.win_rate > 0 && <Badge variant="secondary">{bc.win_rate}% win rate</Badge>}
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-[hsl(var(--success))] mb-1">Strengths</p>
                          <ul className="text-sm text-muted-foreground space-y-0.5">
                            {((bc.strengths as any[]) || []).map((s, i) => <li key={i}>• {s}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-destructive mb-1">Watch out for</p>
                          <ul className="text-sm text-muted-foreground space-y-0.5">
                            {((bc.weaknesses as any[]) || []).map((w, i) => <li key={i}>• {w}</li>)}
                          </ul>
                        </div>
                      </div>
                      {(bc.talking_points as any[])?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-bold text-primary mb-1 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Talking Points</p>
                          <ul className="text-sm text-muted-foreground space-y-0.5">
                            {((bc.talking_points as any[]) || []).map((t, i) => <li key={i}>• {t}</li>)}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </>
  );
}
