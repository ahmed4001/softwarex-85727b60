import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Plus, Gavel, Eye, MousePointer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const tierColors: Record<string, string> = {
  bronze: "bg-amber-700/10 text-amber-700 border-amber-300",
  silver: "bg-slate-400/10 text-slate-600 border-slate-300",
  gold: "bg-yellow-500/10 text-yellow-600 border-yellow-300",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  active: "bg-green-500/10 text-green-600",
  paused: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export default function VendorSponsoredPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showBidForm, setShowBidForm] = useState(false);
  const [form, setForm] = useState({ product_id: "", tier: "bronze", start_date: "", end_date: "", budget: "" });
  const [bidForm, setBidForm] = useState({ product_id: "", category_id: "", bid_amount: "", daily_budget: "", start_date: "", end_date: "" });

  const { data: requests = [] } = useQuery({
    queryKey: ["vendor-sponsored-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_sponsored_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        const pids = [...new Set(data.map(r => r.product_id))];
        const { data: products } = await supabase.from("products").select("id, name").in("id", pids);
        const pmap = new Map((products || []).map(p => [p.id, p.name]));
        return data.map(r => ({ ...r, product_name: pmap.get(r.product_id) || "Unknown" }));
      }
      return [];
    },
  });

  const { data: bids = [] } = useQuery({
    queryKey: ["vendor-sponsored-bids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sponsored_bids")
        .select("*, products(name), categories(name)")
        .eq("vendor_user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: claimedProducts = [] } = useQuery({
    queryKey: ["vendor-claimed-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: claims } = await supabase
        .from("product_claims")
        .select("product_id")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      if (!claims?.length) return [];
      const pids = claims.map(c => c.product_id);
      const { data: products } = await supabase.from("products").select("id, name").in("id", pids);
      return products || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["vendor-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vendor_sponsored_requests").insert({
        user_id: user!.id,
        product_id: form.product_id,
        tier: form.tier,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget: form.budget ? parseFloat(form.budget) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sponsorship request submitted!");
      setShowForm(false);
      setForm({ product_id: "", tier: "bronze", start_date: "", end_date: "", budget: "" });
      queryClient.invalidateQueries({ queryKey: ["vendor-sponsored-requests"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const submitBid = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sponsored_bids").insert({
        vendor_user_id: user!.id,
        product_id: bidForm.product_id,
        category_id: bidForm.category_id || null,
        bid_amount: parseFloat(bidForm.bid_amount),
        daily_budget: parseFloat(bidForm.daily_budget),
        start_date: bidForm.start_date || null,
        end_date: bidForm.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bid submitted!");
      setShowBidForm(false);
      setBidForm({ product_id: "", category_id: "", bid_amount: "", daily_budget: "", start_date: "", end_date: "" });
      queryClient.invalidateQueries({ queryKey: ["vendor-sponsored-bids"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Sponsored Placements</h1>
          <p className="text-muted-foreground text-sm mt-1">Request sponsorships and bid for visibility</p>
        </div>
      </div>

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="rounded-xl">
          <TabsTrigger value="requests" className="gap-1.5 rounded-lg"><Megaphone className="h-3.5 w-3.5" />Requests</TabsTrigger>
          <TabsTrigger value="bidding" className="gap-1.5 rounded-lg"><Gavel className="h-3.5 w-3.5" />Bidding</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <div className="flex justify-end mb-4">
            <Button className="gap-1.5 rounded-lg" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4" /> Request Sponsorship
            </Button>
          </div>

          {showForm && (
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-lg">New Sponsorship Request</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Product</Label>
                    <Select value={form.product_id} onValueChange={(v) => setForm(f => ({ ...f, product_id: v }))}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {claimedProducts.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tier</Label>
                    <Select value={form.tier} onValueChange={(v) => setForm(f => ({ ...f, tier: v }))}>
                      <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bronze">Bronze</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" className="rounded-lg" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" className="rounded-lg" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Budget ($)</Label>
                    <Input type="number" className="rounded-lg" placeholder="Optional" value={form.budget} onChange={(e) => setForm(f => ({ ...f, budget: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => submit.mutate()} disabled={!form.product_id || submit.isPending} className="rounded-lg">Submit Request</Button>
                  <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-lg">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {requests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No sponsorship requests yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="p-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{r.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.start_date && r.end_date ? `${format(new Date(r.start_date), "MMM d")} — ${format(new Date(r.end_date), "MMM d, yyyy")}` : "Dates TBD"}
                      </p>
                    </div>
                    <Badge variant="outline" className={`capitalize ${tierColors[r.tier] || ""}`}>{r.tier}</Badge>
                    <Badge variant="outline" className={`capitalize ${statusColors[r.status] || ""}`}>{r.status}</Badge>
                    {r.budget && <span className="text-sm font-medium">${Number(r.budget).toLocaleString()}</span>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bidding">
          <div className="flex justify-end mb-4">
            <Button className="gap-1.5 rounded-lg" onClick={() => setShowBidForm(!showBidForm)}>
              <Plus className="h-4 w-4" /> Place Bid
            </Button>
          </div>

          {showBidForm && (
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-lg">New Bid</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Product</Label>
                    <Select value={bidForm.product_id} onValueChange={(v) => setBidForm(f => ({ ...f, product_id: v }))}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {claimedProducts.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={bidForm.category_id} onValueChange={(v) => setBidForm(f => ({ ...f, category_id: v }))}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Target category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bid Amount ($/CPM)</Label>
                    <Input type="number" className="rounded-lg" placeholder="e.g. 5.00" value={bidForm.bid_amount} onChange={(e) => setBidForm(f => ({ ...f, bid_amount: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Daily Budget ($)</Label>
                    <Input type="number" className="rounded-lg" placeholder="e.g. 50" value={bidForm.daily_budget} onChange={(e) => setBidForm(f => ({ ...f, daily_budget: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" className="rounded-lg" value={bidForm.start_date} onChange={(e) => setBidForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" className="rounded-lg" value={bidForm.end_date} onChange={(e) => setBidForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => submitBid.mutate()} disabled={!bidForm.product_id || !bidForm.bid_amount || !bidForm.daily_budget || submitBid.isPending} className="rounded-lg">Submit Bid</Button>
                  <Button variant="ghost" onClick={() => setShowBidForm(false)} className="rounded-lg">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {bids.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Gavel className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No bids yet. Place a bid to boost your product visibility.</p>
            </div>
          ) : (
            <div className="product-card overflow-hidden p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Product</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Category</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Bid</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Budget</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Impr.</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Clicks</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((b: any) => (
                    <tr key={b.id} className="border-b border-border/30 last:border-0">
                      <td className="px-4 py-3 text-sm font-medium">{(b.products as any)?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{(b.categories as any)?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">${Number(b.bid_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">${Number(b.daily_budget).toFixed(2)}/day</td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">{b.impressions}</td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">{b.clicks}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`capitalize text-xs ${statusColors[b.status] || ""}`}>{b.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
