import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { CategoryCard } from "@/components/CategoryCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Star, LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import { HeroSection } from "@/components/home/HeroSection";
import { StatsSection } from "@/components/home/StatsSection";
import { TrustedBySection } from "@/components/home/TrustedBySection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { CTASection } from "@/components/home/CTASection";
import { PopularComparisonsSection } from "@/components/home/PopularComparisonsSection";
import { FeaturesGridSection } from "@/components/home/FeaturesGridSection";
import { FAQSection } from "@/components/home/FAQSection";
import { RecentlyAddedSection } from "@/components/home/RecentlyAddedSection";
import { BlogPreviewSection } from "@/components/home/BlogPreviewSection";
import { TopCategoriesShowcase } from "@/components/home/TopCategoriesShowcase";
import { SocialProofBanner } from "@/components/home/SocialProofBanner";
import { VendorCTASection } from "@/components/home/VendorCTASection";
import { MostPopularCategoriesSection } from "@/components/home/MostPopularCategoriesSection";
import { ResearchDirectorySection } from "@/components/home/ResearchDirectorySection";

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
        jsonLd={{ "@context": "https://schema.org", "@type": "WebSite", name: "SoftwareHub" }}
      />

      <HeroSection />
      <StatsSection stats={stats} />
      <TrustedBySection />

      {/* Most Popular Categories - G2 style */}
      <MostPopularCategoriesSection />

      <div className="section-gradient-divider" />

      {/* Categories */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <SectionHeader
            label="Explore"
            title="Browse by category"
            subtitle="Find the right tools for your team"
            linkTo="/category/all"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {categories?.map((cat, i) => (
              <CategoryCard key={cat.id} slug={cat.slug} name={cat.name} icon={cat.icon || ""} product_count={cat.product_count || 0} color={cat.color || "#3b82f6"} index={i} />
            ))}
            {(!categories || categories.length === 0) && (
              <EmptyBlock icon={<LayoutGrid className="h-6 w-6 text-muted-foreground/30" />} text="Categories coming soon" />
            )}
          </div>
        </div>
      </section>

      <div className="section-gradient-divider" />

      {/* Featured */}
      <section className="py-20">
        <div className="container">
          <SectionHeader label="Featured" title="Hand-picked software" subtitle="Curated by our team of experts" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingFeatured ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />) :
              featuredProducts && featuredProducts.length > 0 ?
                featuredProducts.map((p: any) => (
                  <ProductCard key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline} logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews} pricing_model={p.pricing_model} category_name={p.categories?.name} is_featured={p.is_featured} is_sponsored={p.is_sponsored} />
                )) : (
                  <EmptyBlock icon={<Sparkles className="h-6 w-6 text-muted-foreground/30" />} text="No featured products yet" sub="Check back soon" />
                )
            }
          </div>
        </div>
      </section>

      <PopularComparisonsSection />

      <div className="section-gradient-divider" />

      {/* Top Rated */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <SectionHeader label="Top Rated" title="Highest rated software" subtitle="Loved by our community" linkTo="/category/all" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingTop ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />) :
              topProducts && topProducts.length > 0 ?
                topProducts.map((p: any) => (
                  <ProductCard key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline} logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews} pricing_model={p.pricing_model} category_name={p.categories?.name} />
                )) : (
                  <EmptyBlock icon={<Star className="h-6 w-6 text-muted-foreground/30" />} text="No rated products yet" sub="Be the first to review" />
                )
            }
          </div>
        </div>
      </section>

      <SocialProofBanner />

      <RecentlyAddedSection />

      <TopCategoriesShowcase />

      <FeaturesGridSection />

      <HowItWorksSection />

      <TestimonialsSection />

      <BlogPreviewSection />

      <VendorCTASection />

      {/* Research Directory - G2 style */}
      <ResearchDirectorySection />

      <CTASection />

      <FAQSection />

      <NewsletterSection />
    </>
  );
}

function SectionHeader({ label, title, subtitle, linkTo }: { label: string; title: string; subtitle: string; linkTo?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
    >
      <div>
        <p className="text-sm font-semibold text-primary mb-1">{label}</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">{title}</h2>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {linkTo && (
        <Link to={linkTo}>
          <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
            View All <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </Link>
      )}
    </motion.div>
  );
}

function EmptyBlock({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="col-span-full text-center py-16">
      <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">{icon}</div>
      <p className="text-muted-foreground font-medium text-sm">{text}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}
