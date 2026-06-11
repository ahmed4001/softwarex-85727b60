import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, Clock, ExternalLink, Copy, Check, ChevronRight, ArrowLeft, Flame, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

type Deal = {
  id: string; product_name: string; slug: string; logo_url: string | null;
  description: string | null; deal_url: string; discount_amount: string | null;
  discount_type: string | null; coupon_code: string | null; category: string | null;
  start_date: string | null; end_date: string | null; is_featured: boolean;
  is_trending: boolean; is_visible: boolean; click_count: number | null;
  product_id: string | null; created_at: string; review_status: string;
};

function useCountdown(endDate: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endDate) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [endDate]);
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - now;
  if (diff <= 0) return "Expired";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${d}d ${h}h ${m}m ${s}s`;
}

const SITE_URL = (typeof window !== "undefined" && window.location.origin) || "https://softwarex.lovable.app";

export default function DealDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal-detail", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase
        .from("deals" as any)
        .select("*")
        .eq("slug", slug!)
        .eq("is_visible", true)
        .maybeSingle();
      return data as unknown as Deal | null;
    },
  });

  const { data: related = [] } = useQuery({
    queryKey: ["deal-related", deal?.id, deal?.category],
    enabled: !!deal,
    queryFn: async () => {
      let q = supabase.from("deals" as any).select("*").eq("is_visible", true).neq("id", deal!.id).limit(4);
      if (deal!.category) q = q.eq("category", deal!.category);
      const { data } = await q;
      return (data ?? []) as unknown as Deal[];
    },
  });

  const countdown = useCountdown(deal?.end_date ?? null);

  const trackDealClick = async (e?: React.MouseEvent) => {
    if (!deal) return;
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

  const copyCoupon = async () => {
    if (!deal?.coupon_code) return;
    await navigator.clipboard.writeText(deal.coupon_code);
    setCopied(true);
    setRevealed(true);
    toast.success("Coupon copied!");
    await trackDealClick();
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return <div className="container py-20 text-center text-muted-foreground">Loading deal...</div>;
  }

  if (!deal) {
    return (
      <div className="container py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold">Deal not found</h1>
        <p className="text-muted-foreground">It may have ended or been removed.</p>
        <Button asChild><Link to="/deals">Browse all deals</Link></Button>
      </div>
    );
  }

  const canonical = `${SITE_URL}/deals/${deal.slug}`;
  const ogTitle = `${deal.product_name} Deal${deal.discount_amount ? ` — ${deal.discount_amount}${deal.discount_type === "percent" ? "%" : ""} OFF` : ""}`;
  const ogDesc = deal.description || `Save on ${deal.product_name}. Exclusive coupon and offer.`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Offer",
      url: canonical,
      name: ogTitle,
      description: ogDesc,
      priceCurrency: "USD",
      availability: deal.end_date && new Date(deal.end_date) < new Date()
        ? "https://schema.org/Discontinued"
        : "https://schema.org/InStock",
      ...(deal.start_date && { validFrom: deal.start_date }),
      ...(deal.end_date && { validThrough: deal.end_date }),
      ...(deal.coupon_code && {
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          priceCurrency: "USD",
          price: "0",
        },
      }),
      seller: {
        "@type": "Organization",
        name: deal.product_name,
        ...(deal.logo_url && { logo: deal.logo_url }),
      },
      itemOffered: {
        "@type": "Product",
        name: deal.product_name,
        ...(deal.logo_url && { image: deal.logo_url }),
        ...(deal.category && { category: deal.category }),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Deals", item: `${SITE_URL}/deals` },
        ...(deal.category ? [{ "@type": "ListItem", position: 3, name: deal.category, item: `${SITE_URL}/deals?category=${encodeURIComponent(deal.category)}` }] : []),
        { "@type": "ListItem", position: deal.category ? 4 : 3, name: deal.product_name, item: canonical },
      ],
    },
  ];

  const expired = deal.end_date && new Date(deal.end_date) < new Date();

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>{ogTitle} | ReviewHunts</title>
        <meta name="description" content={ogDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:url" content={canonical} />
        {deal.logo_url && <meta property="og:image" content={deal.logo_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        {deal.logo_url && <meta name="twitter:image" content={deal.logo_url} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="container py-6 md:py-10 max-w-4xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/deals" className="hover:text-foreground">Deals</Link>
          {deal.category && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link to={`/deals?category=${encodeURIComponent(deal.category)}`} className="hover:text-foreground">{deal.category}</Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate">{deal.product_name}</span>
        </nav>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-border/60">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4 mb-6 flex-wrap">
                {deal.logo_url ? (
                  <img src={deal.logo_url} alt={`${deal.product_name} logo`} className="h-20 w-20 rounded-2xl object-contain bg-muted p-2" />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                    {deal.product_name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {deal.is_featured && <Badge className="bg-primary/15 text-primary border-primary/20" variant="outline"><Flame className="h-3 w-3 mr-1" /> Featured</Badge>}
                    {deal.is_trending && <Badge variant="outline"><TrendingUp className="h-3 w-3 mr-1" /> Trending</Badge>}
                    {deal.category && <Badge variant="secondary">{deal.category}</Badge>}
                    {expired && <Badge variant="destructive">Expired</Badge>}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {deal.product_name} Deal
                  </h1>
                  {deal.discount_amount && (
                    <p className="text-lg text-primary font-semibold mt-1">
                      Save {deal.discount_type === "amount" ? "$" : ""}{deal.discount_amount}{deal.discount_type === "percent" ? "% off" : deal.discount_type === "amount" ? " off" : ""}
                    </p>
                  )}
                </div>
              </div>

              {deal.description && (
                <p className="text-base text-muted-foreground leading-relaxed mb-6">{deal.description}</p>
              )}

              {countdown && (
                <div className={`flex items-center gap-2 text-sm mb-6 ${expired ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{expired ? "This deal has expired" : `Ends in ${countdown}`}</span>
                </div>
              )}

              {/* Coupon reveal */}
              {deal.coupon_code && !expired && (
                <div className="border-2 border-dashed border-primary/40 rounded-xl p-5 bg-primary/5 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coupon code</p>
                  {revealed ? (
                    <button onClick={copyCoupon} className="w-full flex items-center justify-between gap-3">
                      <span className="font-mono font-bold text-xl tracking-wider">{deal.coupon_code}</span>
                      {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  ) : (
                    <button
                      onClick={copyCoupon}
                      className="w-full flex items-center justify-between gap-3 group"
                    >
                      <span className="font-mono font-bold text-xl tracking-wider blur-sm group-hover:blur-none transition">{deal.coupon_code}</span>
                      <span className="text-xs font-medium text-primary">Click to reveal & copy</span>
                    </button>
                  )}
                </div>
              )}

              <Button size="lg" className="w-full" onClick={trackDealClick} disabled={!!expired}>
                {expired ? "Deal expired" : "Get this deal"} <ExternalLink className="h-4 w-4 ml-2" />
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-3">
                Posted {new Date(deal.created_at).toLocaleDateString()} · {deal.click_count ?? 0} people viewed
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {related.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">More deals{deal.category ? ` in ${deal.category}` : ""}</h2>
              <Link to="/deals" className="text-sm text-primary hover:underline flex items-center gap-1">
                All deals <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link key={r.id} to={`/deals/${r.slug}`} className="block">
                  <Card className="h-full hover:border-primary/40 hover:shadow-md transition">
                    <CardContent className="p-4 flex items-center gap-3">
                      {r.logo_url ? (
                        <img src={r.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-muted p-1" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {r.product_name[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{r.product_name}</p>
                        {r.discount_amount && <p className="text-xs text-primary font-semibold">{r.discount_amount}{r.discount_type === "percent" ? "%" : ""} off</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
