import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tag, Flame, Clock, Search, Mail, ExternalLink, Copy, Check, TrendingUp,
  X, SlidersHorizontal, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MobileFilterDrawer, FilterSection, FilterOptionList } from "@/components/MobileFilterDrawer";



type Deal = {
  id: string;
  product_id: string | null;
  product_name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  deal_url: string;
  discount_amount: string | null;
  discount_type: string | null;
  coupon_code: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  is_featured: boolean;
  is_trending: boolean;
  click_count: number | null;
  created_at: string;
  review_status: string;
};

type SortKey = "featured" | "popular" | "newest" | "expiring" | "discount";

type Urgency = "safe" | "soon" | "urgent" | "expired";
type CountdownInfo = { label: string; urgency: Urgency; expired: boolean } | null;

function useCountdown(endDate: string | null, tick: number): CountdownInfo {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  const diff = end - tick;
  if (diff <= 0) {
    const past = tick - end;
    const days = Math.floor(past / 86400000);
    return {
      label: days > 0 ? `Expired ${days}d ago` : "Expired",
      urgency: "expired",
      expired: true,
    };
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  let label: string;
  let urgency: Urgency;
  if (d >= 1) {
    label = `${d}d ${h}h`;
    urgency = d > 7 ? "safe" : "soon";
  } else if (h >= 1) {
    label = `${h}h ${m}m`;
    urgency = "urgent";
  } else {
    label = `${m}m ${s}s`;
    urgency = "urgent";
  }
  return { label, urgency, expired: false };
}

const urgencyStyles: Record<Urgency, { wrap: string; dot: string }> = {
  safe:    { wrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  soon:    { wrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",         dot: "bg-amber-500" },
  urgent:  { wrap: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse",   dot: "bg-red-500" },
  expired: { wrap: "bg-muted text-muted-foreground border-border",                                    dot: "bg-muted-foreground" },
};

function DealCard({ deal, featured, tick }: { deal: Deal; featured?: boolean; tick: number }) {
  const countdown = useCountdown(deal.end_date, tick);
  const [copied, setCopied] = useState(false);

  const trackDealClick = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      if (deal.product_id) {
        await supabase.from("affiliate_clicks" as any).insert({
          product_id: deal.product_id,
          deal_id: deal.id,
          destination_url: deal.deal_url,
          referrer_url: window.location.href,
        });
      }
      await supabase.rpc("increment_deal_click", { _deal_id: deal.id } as any);
    } catch {}
    if (e) {
      window.open(deal.deal_url, "_blank", "noopener,noreferrer");
    }
  };

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!deal.coupon_code) return;
    await navigator.clipboard.writeText(deal.coupon_code);
    setCopied(true);
    toast.success("Coupon copied!");
    await trackDealClick();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className={`group h-full overflow-hidden border-border/60 hover:border-primary/40 hover:shadow-xl transition-all ${featured ? "ring-1 ring-primary/30 bg-gradient-to-br from-card to-primary/5" : ""}`}>
        <CardContent className="p-5 flex flex-col h-full">
          <Link to={`/deals/${deal.slug}`} className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {deal.logo_url ? (
                <img src={deal.logo_url} alt={deal.product_name} className="h-12 w-12 rounded-lg object-contain bg-muted p-1" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {deal.product_name[0]}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate group-hover:text-primary transition">{deal.product_name}</h3>
                {deal.category && <p className="text-xs text-muted-foreground truncate">{deal.category}</p>}
              </div>
            </div>
            {deal.discount_amount && (
              <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold whitespace-nowrap">
                {deal.discount_type === "amount" ? "$" : ""}{deal.discount_amount}{deal.discount_type === "percent" ? "% OFF" : deal.discount_type === "amount" ? " OFF" : ""}
              </Badge>
            )}
          </Link>

          {deal.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{deal.description}</p>
          )}

          {deal.coupon_code && (
            <button onClick={copy} className="w-full flex items-center justify-between gap-2 border border-dashed border-primary/50 rounded-lg px-3 py-2 mb-3 bg-primary/5 hover:bg-primary/10 transition">
              <span className="font-mono font-semibold text-sm tracking-wider">{deal.coupon_code}</span>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          )}

          {countdown && (
            <div className={`inline-flex items-center gap-1.5 text-xs mb-3 px-2 py-1 rounded-md border w-fit ${urgencyStyles[countdown.urgency].wrap}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${urgencyStyles[countdown.urgency].dot}`} />
              <Clock className="h-3 w-3" />
              <span className="font-medium tabular-nums">
                {countdown.expired ? countdown.label : `Ends in ${countdown.label}`}
              </span>
            </div>
          )}

          <div className="flex gap-2 mt-auto">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to={`/deals/${deal.slug}`}>Details <ChevronRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
            <Button size="sm" className="flex-1" onClick={trackDealClick}>
              Get Deal <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DealsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const sort = (params.get("sort") || "featured") as SortKey;
  const selectedCats = useMemo(() => {
    const c = params.get("category");
    return c ? c.split(",").filter(Boolean) : [];
  }, [params]);

  // Filter/sort changes push a new history entry so back/forward walks
  // through state. The free-text search input passes { replace: true } to
  // avoid one history entry per keystroke.
  const setParam = (
    key: string,
    value: string | null,
    opts: { replace?: boolean } = {},
  ) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, opts);
  };


  const [email, setEmail] = useState("");
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const includeExpired = params.get("expired") === "1";
  const setIncludeExpired = (v: boolean) => setParam("expired", v ? "1" : null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["deals-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals" as any)
        .select("*")
        .eq("is_visible", true)
        .eq("review_status", "approved")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Deal[];
    },
  });

  const allCategories = useMemo(() => {
    const map = new Map<string, number>();
    deals.forEach((d) => { if (d.category) map.set(d.category, (map.get(d.category) || 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [deals]);

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = deals.filter((d) => {
      if (!includeExpired && d.end_date && new Date(d.end_date).getTime() <= now) return false;
      if (selectedCats.length && (!d.category || !selectedCats.includes(d.category))) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!d.product_name.toLowerCase().includes(q) && !d.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    switch (sort) {
      case "popular":
        list = [...list].sort((a, b) => (b.click_count ?? 0) - (a.click_count ?? 0));
        break;
      case "newest":
        list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "expiring":
        list = list
          .filter((d) => d.end_date && new Date(d.end_date).getTime() > now)
          .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());
        break;
      case "discount":
        list = [...list].sort((a, b) => {
          const va = a.discount_type === "percent" ? parseFloat(a.discount_amount || "0") : 0;
          const vb = b.discount_type === "percent" ? parseFloat(b.discount_amount || "0") : 0;
          return vb - va;
        });
        break;
      case "featured":
      default:
        list = [...list].sort((a, b) => {
          if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }
    return list;
  }, [deals, search, selectedCats, sort]);

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      all: deals.length,
      featured: deals.filter((d) => d.is_featured).length,
      trending: deals.filter((d) => d.is_trending).length,
      expiring: deals.filter((d) => d.end_date && new Date(d.end_date).getTime() > now).length,
      expired: deals.filter((d) => d.end_date && new Date(d.end_date).getTime() <= now).length,
    };
  }, [deals]);

  const hasFilters = !!search || selectedCats.length > 0 || sort !== "featured" || includeExpired;

  const toggleCategory = (cat: string) => {
    const set = new Set(selectedCats);
    if (set.has(cat)) set.delete(cat);
    else set.add(cat);
    setParam("category", set.size ? Array.from(set).join(",") : null);
  };

  const clearAll = () => {
    setParams({}, { replace: true });
  };

  const subscribe = useMutation({
    mutationFn: async (e: string) => {
      const { error } = await supabase.from("deal_alert_subscribers" as any).insert({ email: e });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscribed! You'll get deal alerts soon.");
      setEmail("");
    },
    onError: (e: any) => toast.error(e?.message?.includes("duplicate") ? "Already subscribed" : "Failed to subscribe"),
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: filtered.slice(0, 20).map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${typeof window !== "undefined" ? window.location.origin : ""}/deals/${d.slug}`,
      name: `${d.product_name} Deal`,
    })),
  };

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Software Deals & Coupons | ReviewHunts</title>
        <meta name="description" content="Discover exclusive software deals, discount codes, and lifetime offers on the best SaaS tools. Updated daily." />
        <link rel="canonical" href="/deals" />
        <meta property="og:title" content="Software Deals & Coupons" />
        <meta property="og:description" content="Exclusive SaaS deals, coupons, and lifetime offers." />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container py-12 md:py-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-primary/15 text-primary border-primary/20" variant="outline">
              <Tag className="h-3 w-3 mr-1" /> Exclusive Deals
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Save big on the best software
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Handpicked coupons, lifetime deals, and discounts on top SaaS tools — updated daily.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setParam("q", e.target.value || null)}
                  placeholder="Search deals..."
                  className="pl-10 h-11"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Toolbar — desktop inline; mobile uses the drawer below. */}
      <div className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="container py-3 hidden md:flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{filtered.length}</span>
            <span className="text-muted-foreground">of {counts.all} deals</span>
          </div>

          <div className="flex-1" />

          {/* Category multi-select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Categories
                {selectedCats.length > 0 && (
                  <Badge className="ml-1 h-5 px-1.5">{selectedCats.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-2 border-b flex items-center justify-between">
                <span className="text-sm font-medium">Filter by category</span>
                {selectedCats.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setParam("category", null)}>Reset</Button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto p-1">
                {allCategories.length === 0 && <p className="p-3 text-sm text-muted-foreground">No categories</p>}
                {allCategories.map(([cat, count]) => (
                  <label key={cat} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer">
                    <Checkbox checked={selectedCats.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                    <span className="text-sm flex-1 truncate">{cat}</span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort */}
          <Select value={sort} onValueChange={(v) => setParam("sort", v === "featured" ? null : v)}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured ({counts.featured})</SelectItem>
              <SelectItem value="popular">Most popular</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="expiring">Ending soon ({counts.expiring})</SelectItem>
              <SelectItem value="discount">Biggest discount</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none px-2 py-1.5 rounded-md hover:bg-muted/50">
            <Checkbox checked={includeExpired} onCheckedChange={(v) => setIncludeExpired(!!v)} />
            <span>Include expired{counts.expired > 0 && ` (${counts.expired})`}</span>
          </label>


          {hasFilters && (
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={clearAll}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          )}
        </div>

        {/* Mobile filter & sort drawer */}
        <div className="container md:hidden">
          <MobileFilterDrawer
            activeCount={selectedCats.length + (sort !== "featured" ? 1 : 0) + (includeExpired ? 1 : 0)}
            resultCount={filtered.length}
            resultLabel="deals"
            onClear={clearAll}
            triggerLabel="Filter & Sort"
          >
            <FilterSection title="Sort by">
              <FilterOptionList<SortKey>
                value={sort}
                onChange={(v) => setParam("sort", v === "featured" ? null : v)}
                options={[
                  { value: "featured", label: "Featured", hint: String(counts.featured) },
                  { value: "popular", label: "Most popular" },
                  { value: "newest", label: "Newest" },
                  { value: "expiring", label: "Ending soon", hint: String(counts.expiring) },
                  { value: "discount", label: "Biggest discount" },
                ]}
              />
            </FilterSection>

            {allCategories.length > 0 && (
              <FilterSection title="Categories">
                <div className="grid grid-cols-1 gap-1.5">
                  {allCategories.map(([cat, count]) => {
                    const active = selectedCats.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between min-h-11",
                          active
                            ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                            : "bg-muted/50 text-foreground hover:bg-muted",
                        )}
                      >
                        <span className="truncate">{cat}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </FilterSection>
            )}

            <FilterSection title="Other">
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 cursor-pointer min-h-11">
                <Checkbox
                  checked={includeExpired}
                  onCheckedChange={(v) => setIncludeExpired(!!v)}
                />
                <span className="text-sm font-medium">
                  Include expired{counts.expired > 0 && ` (${counts.expired})`}
                </span>
              </label>
            </FilterSection>
          </MobileFilterDrawer>
        </div>

        {/* Active filter chips */}
        {(selectedCats.length > 0 || search) && (
          <div className="container pb-3 flex items-center gap-2 flex-wrap">
            {search && (
              <Badge variant="secondary" className="gap-1">
                "{search}"
                <button onClick={() => setParam("q", null)}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {selectedCats.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1">
                {c}
                <button onClick={() => toggleCategory(c)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        )}
      </div>


      <div className="container py-10">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="h-48 animate-pulse bg-muted/30" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card><CardContent className="py-16 text-center">
            <Tag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No deals match your filters.</p>
            {hasFilters && <Button variant="outline" onClick={clearAll}>Clear filters</Button>}
          </CardContent></Card>
        )}

        {!isLoading && filtered.length > 0 && (
          <>
            {sort === "featured" && filtered.some((d) => d.is_featured) && (
              <section className="mb-12">
                <div className="flex items-center gap-2 mb-5">
                  <Flame className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-bold">Featured Deals</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtered.filter((d) => d.is_featured).slice(0, 6).map((d) => <DealCard key={d.id} deal={d} featured tick={tick} />)}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center gap-2 mb-5">
                {sort === "popular" && <TrendingUp className="h-5 w-5 text-primary" />}
                {sort === "expiring" && <Clock className="h-5 w-5 text-amber-500" />}
                <h2 className="text-2xl font-bold">
                  {sort === "featured" ? "All Deals" :
                    sort === "popular" ? "Most Popular" :
                    sort === "newest" ? "Newest" :
                    sort === "expiring" ? "Ending Soon" : "Biggest Discounts"}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {(sort === "featured" ? filtered.filter((d) => !d.is_featured) : filtered).map((d) => (
                  <DealCard key={d.id} deal={d} tick={tick} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Email signup */}
        <section className="mt-14">
          <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
            <CardContent className="p-8 md:p-12 text-center">
              <Mail className="h-10 w-10 mx-auto text-primary mb-4" />
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Get exclusive deal alerts</h2>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                Be the first to know about new software deals, lifetime offers, and limited-time coupons.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); if (email) subscribe.mutate(email); }} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="h-11" />
                <Button type="submit" disabled={subscribe.isPending} className="h-11">
                  {subscribe.isPending ? "..." : "Subscribe"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
