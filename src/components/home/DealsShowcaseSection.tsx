import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Tag, Clock, Flame, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

type Deal = {
  id: string;
  slug: string;
  product_name: string;
  logo_url: string | null;
  description: string | null;
  deal_url: string;
  discount_amount: string | null;
  discount_type: string | null;
  coupon_code: string | null;
  end_date: string | null;
  is_featured: boolean;
  is_trending: boolean;
  click_count: number | null;
};

type Urgency = "safe" | "soon" | "urgent" | "expired";

function useCountdown(endDate: string | null, tick: number) {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  const diff = end - tick;
  if (diff <= 0) {
    const past = tick - end;
    const days = Math.floor(past / 86400000);
    return {
      label: days > 0 ? `${days}d ago` : "Expired",
      urgency: "expired" as Urgency,
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

function DealCard({ deal, tick }: { deal: Deal; tick: number }) {
  const countdown = useCountdown(deal.end_date, tick);

  const trackClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await supabase.rpc("increment_deal_click", { _deal_id: deal.id } as any);
    } catch {}
    window.open(deal.deal_url, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group h-full overflow-hidden border-border/60 hover:border-primary/40 hover:shadow-xl transition-all">
        <CardContent className="p-5 flex flex-col h-full">
          <Link to={`/deals/${deal.slug}`} className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {deal.logo_url ? (
                <img decoding="async" loading="lazy"
                  src={deal.logo_url}
                  alt={deal.product_name}
                  className="h-12 w-12 rounded-lg object-contain bg-muted p-1"
                  onError={(e) => {
                    const t = e.currentTarget;
                    t.style.display = "none";
                    const fb = t.nextElementSibling as HTMLElement | null;
                    if (fb) fb.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className="h-12 w-12 rounded-lg bg-primary/10 items-center justify-center text-primary font-bold uppercase"
                style={{ display: deal.logo_url ? "none" : "flex" }}
              >
                {deal.product_name?.[0] ?? "?"}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate group-hover:text-primary transition">{deal.product_name}</h3>
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
            <div className="w-full flex items-center justify-between gap-2 border border-dashed border-primary/50 rounded-lg px-3 py-2 mb-3 bg-primary/5">
              <span className="font-mono font-semibold text-sm tracking-wider text-primary">{deal.coupon_code}</span>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </div>
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
              <Link to={`/deals/${deal.slug}`}>Details <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
            <Button size="sm" className="flex-1" onClick={trackClick}>
              Get Deal <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DealsShowcaseSection() {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["deals-showcase-homepage"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("deals" as any)
        .select("id, slug, product_name, logo_url, description, deal_url, discount_amount, discount_type, coupon_code, end_date, is_featured, is_trending, click_count")
        .eq("is_visible", true)
        .eq("review_status", "approved")
        .or(`end_date.gt.${now},end_date.is.null`)
        .order("is_featured", { ascending: false })
        .order("is_trending", { ascending: false })
        .order("click_count", { ascending: false })
        .limit(8);
      return (data ?? []) as unknown as Deal[];
    },
  });

  if (isLoading) {
    return (
      <section className="py-16 md:py-20 bg-gradient-to-b from-muted/20 to-background" aria-labelledby="deals-heading">
        <div className="container">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-primary">Limited Time</p>
              </div>
              <h2 id="deals-heading" className="t-h2">Software Deals & Coupons</h2>
              <p className="text-muted-foreground mt-1">Exclusive discounts on top SaaS tools</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!deals || deals.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-muted/20 to-background" aria-labelledby="deals-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">Limited Time</p>
            </div>
            <h2 id="deals-heading" className="t-h2">Software Deals & Coupons</h2>
            <p className="text-muted-foreground mt-1">Exclusive discounts on top SaaS tools — handpicked and verified</p>
          </div>
          <Link to="/deals">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              View All Deals <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} tick={tick} />
          ))}
        </div>
      </div>
    </section>
  );
}
