import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import { HeroSection } from "@/components/home/HeroSection";
import { StatsSection } from "@/components/home/StatsSection";
import { TrustedBySection } from "@/components/home/TrustedBySection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { PopularComparisonsSection } from "@/components/home/PopularComparisonsSection";
import { FAQSection } from "@/components/home/FAQSection";
import { BlogPreviewSection } from "@/components/home/BlogPreviewSection";
import { VendorCTASection } from "@/components/home/VendorCTASection";
import { MostPopularCategoriesSection } from "@/components/home/MostPopularCategoriesSection";
import { TrendingProductsSection } from "@/components/home/TrendingProductsSection";
import { ProductFinderQuiz } from "@/components/home/ProductFinderQuiz";
import { ReadingProgress } from "@/components/home/ReadingProgress";
import { StickyMobileCTA } from "@/components/home/StickyMobileCTA";
import { RecentlyAddedSection } from "@/components/home/RecentlyAddedSection";

const SITE_URL = "https://reviewhunts.com";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ReviewHunts",
  url: SITE_URL,
  description: "The leading software review and comparison platform. Browse 500+ verified software reviews, compare SaaS tools side-by-side, and find the best business software for your team.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ReviewHunts",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.ico`,
  description: "ReviewHunts helps businesses discover, compare, and choose the best software tools through verified user reviews and expert analysis.",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: ["English"],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is ReviewHunts free to use for software reviews?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, ReviewHunts is completely free. You can browse software categories, read verified user reviews, compare SaaS tools, and make informed purchasing decisions without paying anything.",
      },
    },
    {
      "@type": "Question",
      name: "How does ReviewHunts verify software reviews?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We use a multi-step verification process. Reviewers must confirm their professional email, job title, and company. We also use AI and manual moderation to detect fake or low-quality reviews.",
      },
    },
    {
      "@type": "Question",
      name: "Can I list my SaaS product on ReviewHunts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, any software vendor can submit their product for listing. Our team verifies each submission and publishes it within 2–3 business days. Basic listings are free.",
      },
    },
    {
      "@type": "Question",
      name: "What categories of business software does ReviewHunts cover?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ReviewHunts covers 50+ categories including CRM software, project management tools, marketing automation platforms, business analytics, HR software, accounting tools, design software, developer tools, and many more.",
      },
    },
    {
      "@type": "Question",
      name: "How does the software comparison feature work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Select up to 4 products and see them side-by-side. We compare pricing plans, key features, user ratings, pros and cons, and integration support so you can make informed decisions quickly.",
      },
    },
    {
      "@type": "Question",
      name: "How often are software reviews and pricing updated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Reviews are published in real-time after moderation. Pricing data is refreshed monthly, and vendors can update their own listings at any time through our vendor portal.",
      },
    },
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
  ],
};

export default function HomePage() {
  const { data: featuredProducts, isLoading: loadingFeatured } = useQuery({
    queryKey: ["products-featured"],
    queryFn: async () => {
      const { data: featured } = await supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name)")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("info_score", { ascending: false })
        .order("avg_rating", { ascending: false })
        .limit(12);

      const results = featured || [];
      if (results.length < 12) {
        const needed = 12 - results.length;
        const { data: extra } = await supabase
          .from("products")
          .select("*, categories!products_category_id_fkey(name)")
          .eq("is_active", true)
          .eq("is_featured", false)
          .order("info_score", { ascending: false })
          .order("avg_rating", { ascending: false })
          .limit(needed);
        if (extra) results.push(...extra);
      }
      return results;
    },
  });


  const { data: stats } = useQuery({
    queryKey: ["site-stats"],
    queryFn: async () => {
      const [products, reviews, categories, profiles] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      return { products: products.count || 0, reviews: reviews.count || 0, categories: categories.count || 0, users: profiles.count || 0 };
    },
  });

  return (
    <>
      <SeoHead
        title="Best Software Reviews & Comparisons 2026"
        description="Find the best business software with 10,000+ verified user reviews. Compare CRM, project management, marketing automation, and 50+ SaaS categories. Free forever."
        keywords="software reviews, SaaS comparison, best business software, CRM software, project management tools, marketing automation, software ratings, B2B software, software directory, business tools comparison, best SaaS tools 2026, software recommendations, enterprise software reviews, SMB software guide"
        canonicalUrl={SITE_URL}
        ogImage={`${SITE_URL}/og-image.png`}
        author="ReviewHunts"
        jsonLd={[websiteJsonLd, organizationJsonLd, faqJsonLd, breadcrumbJsonLd]}
      />

      <ReadingProgress />
      <StickyMobileCTA />

      <main>
        {/* 1. Hero */}
        <HeroSection />

        {/* 2. Trust strip */}
        <TrustedBySection />

        {/* 3. Bold stats — moved up for instant credibility */}
        <StatsSection stats={stats} />

        {/* 4. Smart Finder — convert intent right after credibility */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="rounded-3xl bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-transparent border border-primary/15 p-1 md:p-2">
              <div className="rounded-[20px] bg-background/40 backdrop-blur-sm">
                <ProductFinderQuiz />
              </div>
            </div>
          </div>
        </section>

        <div className="section-gradient-divider" aria-hidden="true" />

        {/* 5. Most Popular Categories */}
        <MostPopularCategoriesSection />

        {/* 6. Editor's Choice */}
        <section className="py-14" aria-labelledby="featured-heading">
          <div className="container">
            <SectionHeader id="featured-heading" label="Editor's Choice" title="Top-Rated Software Picks for 2026" subtitle="Hand-picked by our expert analysts based on user reviews, features, and value" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loadingFeatured ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />) :
                featuredProducts && featuredProducts.length > 0 ?
                  featuredProducts.map((p: any) => (
                    <ProductCard key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline} logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews} pricing_model={p.pricing_model} category_name={p.categories?.name} is_featured={p.is_featured} is_sponsored={p.is_sponsored} />
                  )) : (
                    <EmptyBlock icon={<Sparkles className="h-6 w-6 text-muted-foreground/30" />} text="Featured software coming soon" sub="Expert picks arriving shortly" />
                  )
              }
            </div>
          </div>
        </section>

        <div className="section-gradient-divider" aria-hidden="true" />


        {/* 7. Trending */}
        <TrendingProductsSection />

        {/* 8. Popular Comparisons */}
        <PopularComparisonsSection />

        {/* 9. Recently Added */}
        <RecentlyAddedSection />

        {/* 10. How It Works */}
        <HowItWorksSection />

        {/* 11. Blog Preview + Vendor CTA */}
        <BlogPreviewSection />
        <VendorCTASection />

        {/* 12. FAQ + Newsletter */}
        <FAQSection />
        <NewsletterSection />
      </main>
    </>
  );
}

function SectionHeader({ label, title, subtitle, linkTo, id }: { label: string; title: string; subtitle: string; linkTo?: string; id?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
    >
      <div>
        <p className="text-sm font-semibold text-primary mb-1 tracking-wide uppercase">{label}</p>
        <h2 id={id} className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
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
