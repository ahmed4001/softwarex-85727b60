import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { CategoryCard } from "@/components/CategoryCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import { HeroSection } from "@/components/home/HeroSection";
import { StatsSection } from "@/components/home/StatsSection";
import { TrustedBySection } from "@/components/home/TrustedBySection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { CTASection } from "@/components/home/CTASection";

export default function HomePage() {
  const { data: categories } = useQuery({
    queryKey: ["categories-featured"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order").limit(8);
      return data || [];
    },
  });

  const { data: featuredProducts, isLoading: loadingFeatured } = useQuery({
    queryKey: ["products-featured"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("avg_rating", { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  const { data: topProducts, isLoading: loadingTop } = useQuery({
    queryKey: ["products-top"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("avg_rating", { ascending: false })
        .limit(8);
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["site-stats"],
    queryFn: async () => {
      const [products, reviews, categories] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
      ]);
      return { products: products.count || 0, reviews: reviews.count || 0, categories: categories.count || 0 };
    },
  });

  return (
    <>
      <SeoHead
        title="Find the Best Software for Your Business"
        description="Read honest reviews, compare features, and discover the right tools. Trusted by thousands."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "SoftwareHub",
          description: "Find the best software for your business",
        }}
      />

      <HeroSection />
      <StatsSection stats={stats} />
      <TrustedBySection />

      {/* Browse by Category */}
      <section className="py-28 relative">
        <div className="absolute inset-0 mesh-gradient opacity-30" />
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-14 gap-4"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Explore</span>
              <h2 className="text-3xl md:text-5xl font-display font-black text-foreground">Browse by Category</h2>
              <p className="text-muted-foreground mt-2 text-lg">Discover software across every industry</p>
            </div>
            <Link to="/category/all">
              <Button variant="ghost" className="gap-2 font-semibold group text-base">
                View All <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {categories?.map((cat, i) => (
              <CategoryCard key={cat.id} slug={cat.slug} name={cat.name} icon={cat.icon || ""} product_count={cat.product_count || 0} color={cat.color || "#6366f1"} index={i} />
            ))}
            {(!categories || categories.length === 0) && (
              <div className="col-span-full text-center py-20">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground font-medium">Categories coming soon</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="section-gradient-divider" />

      {/* Featured Products */}
      <section className="py-28 animated-gradient-bg">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-14 gap-4"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Featured
              </span>
              <h2 className="text-3xl md:text-5xl font-display font-black text-foreground">Hand-Picked Software</h2>
              <p className="text-muted-foreground mt-2 text-lg">Curated by our team of experts</p>
            </div>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loadingFeatured ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />) :
              featuredProducts && featuredProducts.length > 0 ?
                featuredProducts.map((p: any) => (
                  <ProductCard
                    key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline}
                    logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews}
                    pricing_model={p.pricing_model} category_name={p.categories?.name}
                    is_featured={p.is_featured} is_sponsored={p.is_sponsored}
                  />
                )) : (
                  <div className="col-span-full text-center py-20">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="h-7 w-7 text-primary/40" />
                    </div>
                    <p className="text-muted-foreground font-medium mb-1">No featured products yet</p>
                    <p className="text-sm text-muted-foreground/60">Check back soon for curated picks</p>
                  </div>
                )
            }
          </div>
        </div>
      </section>

      <div className="section-gradient-divider" />

      {/* Top Rated */}
      <section className="py-28">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-14 gap-4"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-star mb-3 flex items-center gap-2">
                <Star className="h-3.5 w-3.5 fill-star" /> Top Rated
              </span>
              <h2 className="text-3xl md:text-5xl font-display font-black text-foreground">Highest Rated Software</h2>
              <p className="text-muted-foreground mt-2 text-lg">Loved by our community of reviewers</p>
            </div>
            <Link to="/category/all">
              <Button variant="ghost" className="gap-2 font-semibold group text-base">
                View All <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {loadingTop ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />) :
              topProducts && topProducts.length > 0 ?
                topProducts.map((p: any) => (
                  <ProductCard
                    key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline}
                    logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews}
                    pricing_model={p.pricing_model} category_name={p.categories?.name}
                  />
                )) : (
                  <div className="col-span-full text-center py-20">
                    <div className="h-16 w-16 rounded-2xl bg-star/10 flex items-center justify-center mx-auto mb-4">
                      <Star className="h-7 w-7 text-star/40" />
                    </div>
                    <p className="text-muted-foreground font-medium mb-1">No rated products yet</p>
                    <p className="text-sm text-muted-foreground/60">Be the first to leave a review</p>
                  </div>
                )
            }
          </div>
        </div>
      </section>

      <div className="section-gradient-divider" />
      <HowItWorksSection />
      <div className="section-gradient-divider" />
      <TestimonialsSection />
      <CTASection />
      <NewsletterSection />
    </>
  );
}

function BarChart3(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
  );
}
