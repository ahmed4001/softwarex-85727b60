import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Trophy, ArrowRight, ThumbsUp, ThumbsDown, Target, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { FeatureMatrix } from "@/components/FeatureMatrix";
import { TCOCalculator } from "@/components/TCOCalculator";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { FreshnessBadge } from "@/components/seo/FreshnessBadge";
import { HelpfulVote } from "@/components/seo/HelpfulVote";
import { AIFaqBlock } from "@/components/seo/AIFaqBlock";


export default function ComparisonDetailPage() {
  const { slug } = useParams();
  const { t } = useTranslation();

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["comparison-detail", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("comparisons")
        .select("*")
        .eq("slug", slug!)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  const productIds = comparison?.product_ids as string[] | undefined;

  const { data: products } = useQuery({
    queryKey: ["comparison-products", productIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name, slug)")
        .in("id", productIds!);
      return data || [];
    },
    enabled: !!productIds && productIds.length >= 2,
  });

  if (isLoading) return <div className="container py-20 text-center text-muted-foreground">{t("comparisonDetail.loadingComparison")}</div>;
  if (!comparison) return <div className="container py-20 text-center text-muted-foreground">{t("comparisonDetail.notFound")}</div>;

  const productA = products?.find((p) => p.id === productIds?.[0]);
  const productB = products?.find((p) => p.id === productIds?.[1]);
  const featureScores = Array.isArray(comparison.feature_scores) ? comparison.feature_scores : [];
  const prosA = Array.isArray(comparison.pros_a) ? comparison.pros_a : [];
  const consA = Array.isArray(comparison.cons_a) ? comparison.cons_a : [];
  const prosB = Array.isArray(comparison.pros_b) ? comparison.pros_b : [];
  const consB = Array.isArray(comparison.cons_b) ? comparison.cons_b : [];
  const isWinnerA = comparison.winner_product_id === productA?.id;

  if (!productA || !productB) return (
    <div className="container py-20 text-center">
      <h1 className="text-2xl font-bold text-foreground mb-4">{comparison.title || "Comparison"}</h1>
      <p className="text-muted-foreground mb-6">One or both products in this comparison are currently unavailable.</p>
      <Link to="/compare">
        <Button variant="outline">{t("nav.compare")} <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </Link>
    </div>
  );

  // Build JSON-LD structured data for SEO
  const comparisonJsonLd = productA && productB ? [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": comparison.seo_title || comparison.title || `${productA.name} vs ${productB.name}`,
      "description": comparison.seo_description || comparison.summary?.substring(0, 160) || `Compare ${productA.name} and ${productB.name}`,
      "url": `https://reviewhunts.com/compare/${slug}`,
      "mainEntity": {
        "@type": "ItemList",
        "numberOfItems": 2,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "item": {
              "@type": "SoftwareApplication",
              "name": productA.name,
              "description": productA.tagline || productA.description?.substring(0, 160),
              "url": `https://reviewhunts.com/product/${productA.slug}`,
              ...(productA.logo_url && { "image": productA.logo_url }),
              ...(productA.avg_rating && {
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": Number(productA.avg_rating).toFixed(1),
                  "bestRating": "5",
                  "ratingCount": productA.total_reviews || 1
                }
              }),
              ...(productA.starting_price !== null && {
                "offers": {
                  "@type": "Offer",
                  "price": productA.starting_price || 0,
                  "priceCurrency": "USD"
                }
              })
            }
          },
          {
            "@type": "ListItem",
            "position": 2,
            "item": {
              "@type": "SoftwareApplication",
              "name": productB.name,
              "description": productB.tagline || productB.description?.substring(0, 160),
              "url": `https://reviewhunts.com/product/${productB.slug}`,
              ...(productB.logo_url && { "image": productB.logo_url }),
              ...(productB.avg_rating && {
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": Number(productB.avg_rating).toFixed(1),
                  "bestRating": "5",
                  "ratingCount": productB.total_reviews || 1
                }
              }),
              ...(productB.starting_price !== null && {
                "offers": {
                  "@type": "Offer",
                  "price": productB.starting_price || 0,
                  "priceCurrency": "USD"
                }
              })
            }
          }
        ]
      }
    },
    // FAQ schema from comparison data
    ...(comparison.winner_verdict ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": `Which is better: ${productA.name} or ${productB.name}?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": comparison.winner_verdict
          }
        },
        ...(comparison.best_for_a ? [{
          "@type": "Question",
          "name": `Who is ${productA.name} best for?`,
          "acceptedAnswer": { "@type": "Answer", "text": comparison.best_for_a }
        }] : []),
        ...(comparison.best_for_b ? [{
          "@type": "Question",
          "name": `Who is ${productB.name} best for?`,
          "acceptedAnswer": { "@type": "Answer", "text": comparison.best_for_b }
        }] : [])
      ]
    }] : []),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://reviewhunts.com" },
        { "@type": "ListItem", "position": 2, "name": "Compare", "item": "https://reviewhunts.com/compare" },
        { "@type": "ListItem", "position": 3, "name": `${productA.name} vs ${productB.name}`, "item": `https://reviewhunts.com/compare/${slug}` }
      ]
    }
  ] : undefined;

  return (
    <>
      <SeoHead
        title={comparison.seo_title || comparison.title || `${productA?.name || 'Product'} vs ${productB?.name || 'Product'} 2026: Which is Better?`}
        description={comparison.seo_description || comparison.summary?.substring(0, 154) || `${productA?.name} vs ${productB?.name} in 2026: side-by-side pricing, features, pros & cons, and verified user ratings to help you pick the right tool.`.slice(0, 154)}
        canonicalUrl={`https://reviewhunts.com/compare/${slug}`}
        jsonLd={comparisonJsonLd}
      />

      <div className="container py-8 max-w-5xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-foreground transition-colors">{t("nav.home")}</Link>
          <span className="opacity-30">/</span>
          <Link to="/compare" className="hover:text-foreground transition-colors">{t("nav.compare")}</Link>
          <span className="opacity-30">/</span>
          <span className="text-foreground font-medium">{productA.name} {t("comparison.vs")} {productB.name}</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground text-center mb-8">
            {productA.name} {t("comparison.vs")} {productB.name}
          </h1>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
            <div className="text-center">
              <div className={cn("h-20 w-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden mx-auto mb-3 ring-2", isWinnerA ? "ring-primary" : "ring-border/30")}>
                {productA.logo_url ? <img src={productA.logo_url} alt={productA.name} className="h-full w-full object-cover" /> : <span className="text-2xl font-bold text-primary">{productA.name.charAt(0)}</span>}
              </div>
              {isWinnerA && <Badge className="mb-2 bg-primary/10 text-primary border-0 gap-1"><Crown className="h-3 w-3" />{t("comparison.winner")}</Badge>}
              <h2 className="font-bold text-lg text-foreground">{productA.name}</h2>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <StarRating rating={Number(productA.avg_rating)} size="sm" />
                <span className="font-bold text-sm">{Number(productA.avg_rating).toFixed(1)}</span>
              </div>
              {comparison.product_a_score > 0 && (
                <div className="mt-3 text-3xl font-extrabold text-foreground">{Number(comparison.product_a_score).toFixed(1)}<span className="text-sm font-normal text-muted-foreground">/10</span></div>
              )}
            </div>

            <div className="flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <span className="text-lg font-extrabold text-muted-foreground">{t("comparison.vs").toUpperCase()}</span>
              </div>
            </div>

            <div className="text-center">
              <div className={cn("h-20 w-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden mx-auto mb-3 ring-2", !isWinnerA ? "ring-primary" : "ring-border/30")}>
                {productB.logo_url ? <img src={productB.logo_url} alt={productB.name} className="h-full w-full object-cover" /> : <span className="text-2xl font-bold text-primary">{productB.name.charAt(0)}</span>}
              </div>
              {!isWinnerA && comparison.winner_product_id && <Badge className="mb-2 bg-primary/10 text-primary border-0 gap-1"><Crown className="h-3 w-3" />{t("comparison.winner")}</Badge>}
              <h2 className="font-bold text-lg text-foreground">{productB.name}</h2>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <StarRating rating={Number(productB.avg_rating)} size="sm" />
                <span className="font-bold text-sm">{Number(productB.avg_rating).toFixed(1)}</span>
              </div>
              {comparison.product_b_score > 0 && (
                <div className="mt-3 text-3xl font-extrabold text-foreground">{Number(comparison.product_b_score).toFixed(1)}<span className="text-sm font-normal text-muted-foreground">/10</span></div>
              )}
            </div>
          </div>
        </motion.div>

        {comparison.winner_verdict && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 mb-8 border-l-4 border-l-primary">
            <div className="flex items-start gap-3">
              <Trophy className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-foreground mb-1">{t("comparisonDetail.ourVerdict")}</h3>
                <p className="text-muted-foreground leading-relaxed">{comparison.winner_verdict}</p>
              </div>
            </div>
          </motion.div>
        )}

        {featureScores.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6 mb-8">
            <h3 className="font-bold text-foreground mb-6 text-lg">{t("comparisonDetail.featureScores")}</h3>
            <div className="space-y-5">
              {featureScores.map((fs: any, i: number) => {
                const scoreA = Number(fs.score_a) || 0;
                const scoreB = Number(fs.score_b) || 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className={cn("font-bold", scoreA >= scoreB ? "text-primary" : "text-foreground")}>{scoreA}/10</span>
                      <span className="font-medium text-foreground">{fs.feature}</span>
                      <span className={cn("font-bold", scoreB >= scoreA ? "text-primary" : "text-foreground")}>{scoreB}/10</span>
                    </div>
                    <div className="flex gap-1 h-3">
                      <div className="flex-1 bg-muted/50 rounded-l-full overflow-hidden flex justify-end">
                        <div className={cn("h-full rounded-l-full transition-all", scoreA >= scoreB ? "bg-primary" : "bg-muted-foreground/30")} style={{ width: `${scoreA * 10}%` }} />
                      </div>
                      <div className="flex-1 bg-muted/50 rounded-r-full overflow-hidden">
                        <div className={cn("h-full rounded-r-full transition-all", scoreB >= scoreA ? "bg-primary" : "bg-muted-foreground/30")} style={{ width: `${scoreB * 10}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-xs text-muted-foreground">
              <span>{productA.name}</span>
              <span>{productB.name}</span>
            </div>
          </motion.section>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
            <h3 className="font-bold text-foreground text-center">{productA.name}</h3>
            {prosA.length > 0 && (
              <div className="glass-card p-5 border-l-4 border-l-[hsl(var(--success))]">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="h-4 w-4 text-[hsl(var(--success))]" />
                  <span className="text-sm font-bold text-[hsl(var(--success))] uppercase">{t("product.pros")}</span>
                </div>
                <ul className="space-y-2">
                  {prosA.map((p: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-[hsl(var(--success))] mt-1">•</span>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {consA.length > 0 && (
              <div className="glass-card p-5 border-l-4 border-l-destructive">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-bold text-destructive uppercase">{t("product.cons")}</span>
                </div>
                <ul className="space-y-2">
                  {consA.map((c: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-destructive mt-1">•</span>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {comparison.best_for_a && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">{t("comparison.bestFor")}</span>
                </div>
                <p className="text-sm text-muted-foreground">{comparison.best_for_a}</p>
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-4">
            <h3 className="font-bold text-foreground text-center">{productB.name}</h3>
            {prosB.length > 0 && (
              <div className="glass-card p-5 border-l-4 border-l-[hsl(var(--success))]">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="h-4 w-4 text-[hsl(var(--success))]" />
                  <span className="text-sm font-bold text-[hsl(var(--success))] uppercase">{t("product.pros")}</span>
                </div>
                <ul className="space-y-2">
                  {prosB.map((p: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-[hsl(var(--success))] mt-1">•</span>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {consB.length > 0 && (
              <div className="glass-card p-5 border-l-4 border-l-destructive">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-bold text-destructive uppercase">{t("product.cons")}</span>
                </div>
                <ul className="space-y-2">
                  {consB.map((c: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-destructive mt-1">•</span>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {comparison.best_for_b && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">{t("comparison.bestFor")}</span>
                </div>
                <p className="text-sm text-muted-foreground">{comparison.best_for_b}</p>
              </div>
            )}
          </motion.div>
        </div>

        {comparison.summary && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-8 mb-8">
            <h3 className="font-bold text-foreground mb-4 text-lg">{t("comparisonDetail.detailedSummary")}</h3>
            <div className="text-muted-foreground leading-relaxed whitespace-pre-line">{comparison.summary}</div>
          </motion.div>
        )}

        {/* Feature Matrix */}
        {productA && productB && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mb-8">
            <FeatureMatrix products={[productA, productB]} />
          </motion.div>
        )}

        {/* TCO Calculator */}
        {productA && productB && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6 mb-8">
            <TCOCalculator products={[productA, productB]} />
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link to={`/product/${productA.slug}`}>
            <Button variant="outline" className="w-full rounded-xl gap-2 font-semibold">
              {t("comparisonDetail.viewDetails", { name: productA.name })} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to={`/product/${productB.slug}`}>
            <Button variant="outline" className="w-full rounded-xl gap-2 font-semibold">
              {t("comparisonDetail.viewDetails", { name: productB.name })} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="text-center">
          <Link to={`/compare?products=${productA.id},${productB.id}`}>
            <Button className="btn-premium rounded-xl text-primary-foreground gap-2 font-semibold">
              {t("comparisonDetail.openFullCompare")} <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
