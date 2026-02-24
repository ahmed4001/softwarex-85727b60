import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StarRating } from "@/components/StarRating";
import { ReviewCard } from "@/components/ReviewCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, CheckCircle, Globe, Calendar, Users, Building2, Sparkles, ArrowLeft, X, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

function ScreenshotGallery({ screenshots, productName }: { screenshots: string[]; productName: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const prev = () => setActiveIndex((i) => (i - 1 + screenshots.length) % screenshots.length);
  const next = () => setActiveIndex((i) => (i + 1) % screenshots.length);

  React.useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, screenshots.length]);

  if (!screenshots.length) return null;

  return (
    <div className="glass-card p-8">
      <h2 className="text-xl font-display font-bold mb-4">Screenshots</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {screenshots.map((url, i) => (
          <button
            key={i}
            onClick={() => { setActiveIndex(i); setLightboxOpen(true); }}
            className="group relative aspect-video rounded-xl overflow-hidden border border-border/50 bg-muted/30 hover:ring-2 hover:ring-primary/40 transition-all"
          >
            <img
              src={url as string}
              alt={`${productName} screenshot ${i + 1}`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors" />
          </button>
        ))}
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl p-0 bg-background/95 backdrop-blur-xl border-border/50 overflow-hidden">
          <div className="relative">
            <img
              src={screenshots[activeIndex] as string}
              alt={`${productName} screenshot ${activeIndex + 1}`}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
            {screenshots.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background/80 border border-border text-xs font-medium">
              {activeIndex + 1} / {screenshots.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { t } = useTranslation();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories!products_category_id_fkey(name, slug)").eq("slug", slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, profiles(name, avatar_url)")
        .eq("product_id", product!.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!product?.id,
  });

  if (isLoading) return <div className="container py-20 text-center text-muted-foreground">{t("common.loading")}</div>;
  if (!product) return <div className="container py-20 text-center text-muted-foreground">{t("productDetail.notFound")}</div>;

  const features = Array.isArray(product.features) ? product.features : [];

  return (
    <>
      <SeoHead
        title={product.seo_title || product.name}
        description={product.seo_description || product.tagline || ""}
        jsonLd={{
          "@context": "https://schema.org", "@type": "Product", name: product.name,
          description: product.tagline,
          aggregateRating: { "@type": "AggregateRating", ratingValue: product.avg_rating, reviewCount: product.total_reviews },
        }}
      />

      <div className="container py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-muted-foreground mb-8"
        >
          <Link to="/" className="hover:text-foreground transition-colors">{t("productDetail.home")}</Link>
          <span className="opacity-30">/</span>
          {product.categories && (
            <>
              <Link to={`/category/${(product.categories as any).slug}`} className="hover:text-foreground transition-colors">{(product.categories as any).name}</Link>
              <span className="opacity-30">/</span>
            </>
          )}
          <span className="text-foreground font-medium">{product.name}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 mb-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
          
          <div className="flex flex-col lg:flex-row gap-8 relative">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-border/30 shadow-lg">
              {product.logo_url ? <img src={product.logo_url} alt={product.name} className="h-full w-full object-cover" /> : <span className="text-4xl font-display font-bold gradient-text">{product.name.charAt(0)}</span>}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1 className="text-3xl font-display font-bold text-foreground">{product.name}</h1>
                {product.is_verified && (
                  <Badge className="bg-success/10 text-success border-0 gap-1 font-semibold"><CheckCircle className="h-3.5 w-3.5" />{t("productDetail.verified")}</Badge>
                )}
                {product.is_sponsored && (
                  <Badge className="bg-gradient-to-r from-primary to-secondary text-primary-foreground border-0 font-semibold">{t("productDetail.sponsored")}</Badge>
                )}
              </div>
              {product.tagline && <p className="text-lg text-muted-foreground mb-4">{product.tagline}</p>}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <StarRating rating={Number(product.avg_rating)} size="md" />
                  <span className="text-lg font-display font-bold">{Number(product.avg_rating).toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({product.total_reviews} {t("product.reviews").toLowerCase()})</span>
                </div>
                {product.pricing_model && <Badge variant="outline" className="capitalize rounded-lg font-medium">{product.pricing_model}</Badge>}
                {product.starting_price && <span className="text-lg font-display font-bold text-foreground">${product.starting_price}<span className="text-sm font-normal text-muted-foreground">{t("product.perMonth")}</span></span>}
              </div>
              <div className="flex flex-wrap gap-3">
                {product.website_url && (
                  <a href={product.website_url} target="_blank" rel="noopener noreferrer">
                    <Button className="btn-premium rounded-xl text-primary-foreground gap-2 font-semibold"><Globe className="h-4 w-4" />{t("productDetail.visitWebsite")}</Button>
                  </a>
                )}
                <Link to={`/product/${slug}/write-review`}><Button variant="outline" className="rounded-xl font-semibold">{t("productDetail.writeReview")}</Button></Link>
                <Link to={`/compare?products=${product.id}`}><Button variant="ghost" className="rounded-xl font-medium">{t("productDetail.compare")}</Button></Link>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground lg:border-l lg:border-border/50 lg:pl-8 flex-shrink-0">
              {product.headquarters && <div className="flex items-center gap-2.5"><Building2 className="h-4 w-4 text-primary/60" />{product.headquarters}</div>}
              {product.founded_year && <div className="flex items-center gap-2.5"><Calendar className="h-4 w-4 text-primary/60" />{t("productDetail.founded", { year: product.founded_year })}</div>}
              {product.company_size && <div className="flex items-center gap-2.5"><Users className="h-4 w-4 text-primary/60" />{product.company_size}</div>}
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg font-medium">{t("productDetail.overview")}</TabsTrigger>
            <TabsTrigger value="screenshots" className="rounded-lg font-medium">Screenshots</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-lg font-medium">{t("productDetail.reviews", { count: product.total_reviews })}</TabsTrigger>
            <TabsTrigger value="pricing" className="rounded-lg font-medium">{t("productDetail.pricing")}</TabsTrigger>
            <TabsTrigger value="alternatives" className="rounded-lg font-medium">{t("productDetail.alternatives")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {product.description && (
              <div className="glass-card p-8">
                <h2 className="text-xl font-display font-bold mb-4">{t("productDetail.about", { name: product.name })}</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}
            {features.length > 0 && (
              <div className="glass-card p-8">
                <h2 className="text-xl font-display font-bold mb-4">{t("productDetail.features")}</h2>
                <div className="flex flex-wrap gap-2.5">
                  {features.map((f: string, i: number) => (
                    <Badge key={i} variant="outline" className="rounded-lg px-4 py-2 text-sm font-medium">{f}</Badge>
                  ))}
                </div>
              </div>
            )}
            {product.pros_summary && (
              <div className="grid md:grid-cols-2 gap-5">
                <div className="glass-card p-8 border-l-4 border-l-success">
                  <h3 className="font-display font-bold text-success mb-3">👍 {t("productDetail.pros")}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{product.pros_summary}</p>
                </div>
                <div className="glass-card p-8 border-l-4 border-l-destructive">
                  <h3 className="font-display font-bold text-destructive mb-3">👎 {t("productDetail.cons")}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{product.cons_summary}</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="screenshots">
            {(() => {
              const screenshots = Array.isArray(product.screenshots) ? product.screenshots.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
              return screenshots.length > 0 ? (
                <ScreenshotGallery screenshots={screenshots} productName={product.name} />
              ) : (
                <div className="glass-card p-12 text-center text-muted-foreground">No screenshots available yet.</div>
              );
            })()}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-5">
            {reviews?.map((r: any) => (
              <ReviewCard
                key={r.id} id={r.id} title={r.title} body={r.body} pros={r.pros} cons={r.cons}
                overall_rating={r.overall_rating} reviewer_name={r.profiles?.name}
                reviewer_user_id={r.user_id}
                reviewer_role={r.reviewer_role} company_size={r.company_size}
                verified_reviewer={r.verified_reviewer}
                created_at={r.created_at}
              />
            ))}
            {(!reviews || reviews.length === 0) && (
              <div className="glass-card p-12 text-center">
                <p className="text-muted-foreground mb-4">{t("productDetail.noReviews")}</p>
                <Link to={`/product/${slug}/write-review`}><Button className="btn-premium rounded-xl text-primary-foreground">{t("productDetail.writeReview")}</Button></Link>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pricing">
            <div className="glass-card p-8">
              <h2 className="text-xl font-display font-bold mb-4">{t("productDetail.pricing")}</h2>
              <div className="flex items-center gap-4 mb-6">
                <Badge variant="outline" className="capitalize rounded-lg text-base px-4 py-2">{product.pricing_model}</Badge>
                {product.starting_price && <span className="text-4xl font-display font-bold text-foreground">${product.starting_price}<span className="text-lg font-normal text-muted-foreground">{t("product.perMonth")}</span></span>}
              </div>
              {product.pricing_description && <p className="text-muted-foreground leading-relaxed">{product.pricing_description}</p>}
            </div>
          </TabsContent>

          <TabsContent value="alternatives">
            <div className="glass-card p-12 text-center text-muted-foreground">{t("productDetail.alternativesPlaceholder")}</div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
