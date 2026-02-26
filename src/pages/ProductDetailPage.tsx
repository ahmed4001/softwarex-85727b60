import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { StarRating } from "@/components/StarRating";
import { ReviewCard } from "@/components/ReviewCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, CheckCircle, Globe, Calendar, Users, Building2, Sparkles, ArrowLeft, X, ChevronLeft, ChevronRight, MessageSquare, Loader2, Wand2, ArrowLeftRight, HelpCircle } from "lucide-react";
import React, { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PricingTiersDisplay } from "@/components/PricingTiersDisplay";
import { TCOCalculator } from "@/components/TCOCalculator";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { ProductQASection } from "@/components/ProductQASection";
import { PricingComparisonWidget } from "@/components/PricingComparisonWidget";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).in("role", ["admin", "superadmin"]);
      return (data || []).length > 0;
    },
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories!products_category_id_fkey(name, slug)").eq("slug", slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: rawReviews } = useQuery({
    queryKey: ["reviews", product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", product!.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!product?.id,
  });

  // Fetch profiles for review authors
  const reviewUserIds = useMemo(() => {
    const ids = (rawReviews || []).map((r: any) => r.user_id).filter(Boolean);
    return [...new Set(ids)] as string[];
  }, [rawReviews]);

  const { data: reviewProfiles } = useQuery({
    queryKey: ["review-profiles", reviewUserIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", reviewUserIds);
      return data || [];
    },
    enabled: reviewUserIds.length > 0,
  });

  const reviews = useMemo(() => {
    const profileMap = new Map((reviewProfiles || []).map((p: any) => [p.user_id, p]));
    return (rawReviews || []).map((r: any) => ({
      ...r,
      profiles: profileMap.get(r.user_id) || { name: "Anonymous", avatar_url: null },
    }));
  }, [rawReviews, reviewProfiles]);

  // Fetch review media
  const reviewIds2 = (reviews || []).map((r: any) => r.id);
  const { data: reviewMedia = [] } = useQuery({
    queryKey: ["review-media", reviewIds2],
    queryFn: async () => {
      const { data } = await supabase
        .from("review_media")
        .select("review_id, url, file_type")
        .in("review_id", reviewIds2)
        .order("sort_order");
      return data || [];
    },
    enabled: reviewIds2.length > 0,
  });
  const mediaByReview = new Map<string, { url: string; file_type?: string }[]>();
  (reviewMedia as any[]).forEach((m: any) => {
    if (!mediaByReview.has(m.review_id)) mediaByReview.set(m.review_id, []);
    mediaByReview.get(m.review_id)!.push({ url: m.url, file_type: m.file_type });
  });

  // Fetch claim owner for lead capture
  const { data: claimOwner } = useQuery({
    queryKey: ["product-claim-owner", product?.id],
    enabled: !!product?.id && !!product?.is_claimed,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("user_id")
        .eq("product_id", product!.id)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();
      return data?.user_id || null;
    },
  });

  const { data: alternatives = [] } = useQuery({
    queryKey: ["product-alternatives", product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("alternatives")
        .select("*, alternative:products!alternatives_alternative_product_id_fkey(id, name, slug, logo_url, avg_rating, total_reviews, tagline, pricing_model)")
        .eq("product_id", product!.id)
        .order("similarity_score", { ascending: false });
      return data || [];
    },
    enabled: !!product?.id,
  });

  const generateSummary = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-review-summary", {
        body: { product_id: product!.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("AI summary generated!");
      queryClient.invalidateQueries({ queryKey: ["product", slug] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to generate summary"),
  });

  // Fetch vendor responses for the reviews
  const reviewIds = (reviews || []).map((r: any) => r.id);
  const { data: vendorResponses = [] } = useQuery({
    queryKey: ["vendor-responses-public", reviewIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_responses")
        .select("*")
        .in("review_id", reviewIds);
      if (!data || data.length === 0) return [];
      const vUserIds = [...new Set(data.map((r: any) => r.user_id).filter(Boolean))];
      const { data: vProfiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", vUserIds);
      const vpMap = new Map((vProfiles || []).map((p: any) => [p.user_id, p]));
      return data.map((r: any) => ({
        ...r,
        profiles: vpMap.get(r.user_id) || { name: "Vendor" },
      }));
    },
    enabled: reviewIds.length > 0,
  });
  const responseMap = new Map((vendorResponses as any[]).map((r: any) => [r.review_id, r]));

  const [reviewSort, setReviewSort] = useState<"newest" | "oldest" | "highest" | "lowest" | "most_helpful">("newest");
  const [reviewRatingFilter, setReviewRatingFilter] = useState<number | null>(null);

  const filteredAndSortedReviews = useMemo(() => {
    let result = [...(reviews || [])];
    if (reviewRatingFilter) {
      result = result.filter((r: any) => r.overall_rating === reviewRatingFilter);
    }
    result.sort((a: any, b: any) => {
      switch (reviewSort) {
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "highest": return (b.overall_rating || 0) - (a.overall_rating || 0);
        case "lowest": return (a.overall_rating || 0) - (b.overall_rating || 0);
        case "most_helpful": return (b.helpful_count || 0) - (a.helpful_count || 0);
        default: return 0;
      }
    });
    return result;
  }, [reviews, reviewSort, reviewRatingFilter]);

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
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/3 to-transparent rounded-bl-full pointer-events-none" />
          
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
            <div className="flex flex-col gap-4 lg:border-l lg:border-border/50 lg:pl-8 flex-shrink-0">
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                {product.headquarters && <div className="flex items-center gap-2.5"><Building2 className="h-4 w-4 text-primary/60" />{product.headquarters}</div>}
                {product.founded_year && <div className="flex items-center gap-2.5"><Calendar className="h-4 w-4 text-primary/60" />{t("productDetail.founded", { year: product.founded_year })}</div>}
                {product.company_size && <div className="flex items-center gap-2.5"><Users className="h-4 w-4 text-primary/60" />{product.company_size}</div>}
              </div>
              {(() => {
                const heroScreenshots = Array.isArray(product.screenshots) ? product.screenshots.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
                return heroScreenshots.length > 0 ? (
                  <div className="w-56 rounded-xl overflow-hidden border border-border shadow-md bg-background">
                    <img
                      src={heroScreenshots[0]}
                      alt={`${product.name} preview`}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null;
              })()}
              {product.is_claimed && claimOwner && (
                <LeadCaptureForm productId={product.id} vendorUserId={claimOwner} productName={product.name} />
              )}
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
            <TabsTrigger value="qa" className="rounded-lg font-medium gap-1"><HelpCircle className="h-3.5 w-3.5" />Q&A</TabsTrigger>
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
            {(product.pros_summary || product.cons_summary) && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">AI-Generated Summary</span>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  {product.pros_summary && (
                    <div className="glass-card p-8 border-l-4 border-l-success">
                      <h3 className="font-display font-bold text-success mb-3">👍 {t("productDetail.pros")}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{product.pros_summary}</p>
                    </div>
                  )}
                  {product.cons_summary && (
                    <div className="glass-card p-8 border-l-4 border-l-destructive">
                      <h3 className="font-display font-bold text-destructive mb-3">👎 {t("productDetail.cons")}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{product.cons_summary}</p>
                    </div>
                  )}
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
            {/* Admin: Generate AI Summary */}
            {isAdmin && reviews && reviews.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateSummary.mutate()}
                  disabled={generateSummary.isPending}
                  className="gap-1.5 text-xs rounded-lg"
                >
                  {generateSummary.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Generate AI Summary
                </Button>
              </div>
            )}

            {/* Filter & Sort Bar */}
            {reviews && reviews.length > 0 && (
              <div className="glass-card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Sort:</span>
                    <Select value={reviewSort} onValueChange={(v) => setReviewSort(v as any)}>
                      <SelectTrigger className="w-[160px] h-8 text-sm rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="oldest">Oldest</SelectItem>
                        <SelectItem value="highest">Highest Rated</SelectItem>
                        <SelectItem value="lowest">Lowest Rated</SelectItem>
                        <SelectItem value="most_helpful">Most Helpful</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-muted-foreground mr-1">Rating:</span>
                    <Button
                      variant={reviewRatingFilter === null ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2.5 text-xs rounded-lg"
                      onClick={() => setReviewRatingFilter(null)}
                    >All</Button>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <Button
                        key={star}
                        variant={reviewRatingFilter === star ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-xs rounded-lg gap-0.5"
                        onClick={() => setReviewRatingFilter(reviewRatingFilter === star ? null : star)}
                      >
                        {star}<Star className="h-3 w-3 fill-current" />
                      </Button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredAndSortedReviews.length} of {reviews.length} reviews
                </p>
              </div>
            )}

            {filteredAndSortedReviews.map((r: any) => {
              const vendorResponse = responseMap.get(r.id);
              return (
                <div key={r.id}>
                  <ReviewCard
                    id={r.id} title={r.title} body={r.body} pros={r.pros} cons={r.cons}
                    overall_rating={r.overall_rating}
                    ease_of_use={r.ease_of_use} customer_support={r.customer_support}
                    value_for_money={r.value_for_money} features_rating={r.features_rating}
                    reviewer_name={r.profiles?.name}
                    reviewer_user_id={r.user_id}
                    reviewer_role={r.reviewer_role} company_size={r.company_size}
                    verified_reviewer={r.verified_reviewer}
                    verified_purchase={r.verified_purchase}
                    created_at={r.created_at}
                    media={mediaByReview.get(r.id)}
                    pros_tags={Array.isArray(r.pros_tags) ? r.pros_tags as string[] : []}
                    cons_tags={Array.isArray(r.cons_tags) ? r.cons_tags as string[] : []}
                  />
                  {vendorResponse && (
                    <div className="ml-8 mt-2 p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1.5">
                        <MessageSquare className="h-3 w-3" /> Vendor Response
                        {vendorResponse.profiles?.name && <span className="text-muted-foreground font-normal">from {vendorResponse.profiles.name}</span>}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{vendorResponse.body}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredAndSortedReviews.length === 0 && reviews && reviews.length > 0 && reviewRatingFilter !== null && (
              <div className="glass-card p-8 text-center text-muted-foreground">
                No reviews match this filter.
                <Button variant="link" className="ml-1" onClick={() => setReviewRatingFilter(null)}>Clear filter</Button>
              </div>
            )}
            {(!reviews || reviews.length === 0) && (
              <div className="glass-card p-12 text-center">
                <p className="text-muted-foreground mb-4">{t("productDetail.noReviews")}</p>
                <Link to={`/product/${slug}/write-review`}><Button className="btn-premium rounded-xl text-primary-foreground">{t("productDetail.writeReview")}</Button></Link>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pricing" className="space-y-6">
            <PricingTiersDisplay
              tiers={Array.isArray(product.pricing_tiers) ? (product.pricing_tiers as any[]).filter((t: any) => t && typeof t === "object" && t.name) : []}
              productName={product.name}
              pricingModel={product.pricing_model || undefined}
              startingPrice={product.starting_price}
              pricingDescription={product.pricing_description}
            />
            <TCOCalculator products={[{ name: product.name, logo_url: product.logo_url, starting_price: product.starting_price, pricing_model: product.pricing_model, pricing_tiers: product.pricing_tiers as any }]} />
            <PricingComparisonWidget
              currentProduct={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                logo_url: product.logo_url,
                pricing_model: product.pricing_model,
                starting_price: product.starting_price ? Number(product.starting_price) : null,
                pricing_tiers: product.pricing_tiers,
              }}
            />
          </TabsContent>

          <TabsContent value="alternatives">
            {alternatives.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alternatives.map((a: any) => (
                  <Link key={a.id} to={`/product/${a.alternative?.slug}`} className="glass-card p-5 hover:border-primary/30 transition-all group">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {a.alternative?.logo_url ? <img src={a.alternative.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-primary">{a.alternative?.name?.charAt(0)}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{a.alternative?.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>★ {Number(a.alternative?.avg_rating || 0).toFixed(1)}</span>
                          <span>·</span>
                          <span>{a.alternative?.total_reviews} reviews</span>
                        </div>
                      </div>
                    </div>
                    {a.alternative?.tagline && <p className="text-xs text-muted-foreground line-clamp-2">{a.alternative.tagline}</p>}
                    {a.similarity_score && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${Number(a.similarity_score) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">{(Number(a.similarity_score) * 100).toFixed(0)}% similar</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 text-center text-muted-foreground">No alternatives listed yet.</div>
            )}
          </TabsContent>

          <TabsContent value="qa">
            <ProductQASection productId={product.id} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
