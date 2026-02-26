import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/LoadingSkeleton";
import { motion } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";

export default function AlternativesPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: page, isLoading: loadingPage } = useQuery({
    queryKey: ["alt-page", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("alternative_pages")
        .select("*, products!alternative_pages_product_id_fkey(id, name, slug, logo_url, description, avg_rating, total_reviews)")
        .eq("slug", slug!)
        .eq("is_published", true)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  const productId = page?.product_id;

  const { data: alternatives = [], isLoading: loadingAlts } = useQuery({
    queryKey: ["alt-products", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await supabase
        .from("alternatives")
        .select("*, alternative:products!alternatives_alternative_product_id_fkey(id, name, slug, logo_url, description, short_description, avg_rating, total_reviews, categories!products_category_id_fkey(name))")
        .eq("product_id", productId!)
        .order("similarity_score", { ascending: false });
      return data || [];
    },
  });

  if (loadingPage) {
    return (
      <main className="container py-10 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-96 bg-muted rounded-lg" />
          <div className="h-4 w-full max-w-xl bg-muted/60 rounded" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        </div>
      </main>
    );
  }

  if (!page) {
    return (
      <main className="container py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
      </main>
    );
  }

  const product = page.products as any;
  const faqSchema = Array.isArray(page.faq_schema) ? page.faq_schema : [];

  return (
    <>
      <SeoHead
        title={page.title}
        description={page.meta_description || `Top alternatives to ${product?.name}`}
      />
      {faqSchema.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqSchema.map((faq: any) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }),
        }} />
      )}
      <main className="container py-10 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              {product?.logo_url ? (
                <img src={product.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <ArrowLeftRight className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{page.title}</h1>
              {page.meta_description && (
                <p className="text-muted-foreground mt-1">{page.meta_description}</p>
              )}
            </div>
          </div>
          {page.intro_text && (
            <div className="prose prose-sm max-w-none text-muted-foreground mt-4" dangerouslySetInnerHTML={{ __html: page.intro_text }} />
          )}
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingAlts
            ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : alternatives.map((a: any) => (
                <ProductCard
                  key={a.id}
                  id={a.alternative?.id}
                  name={a.alternative?.name}
                  slug={a.alternative?.slug}
                  logo_url={a.alternative?.logo_url}
                  tagline={a.alternative?.short_description || a.alternative?.description}
                  avg_rating={a.alternative?.avg_rating}
                  total_reviews={a.alternative?.total_reviews}
                  category_name={a.alternative?.categories?.name}
                />
              ))
          }
        </div>

        {!loadingAlts && alternatives.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No alternatives found yet.</p>
        )}

        {faqSchema.length > 0 && (
          <div className="mt-12 space-y-4">
            <h2 className="text-xl font-display font-bold text-foreground">Frequently Asked Questions</h2>
            {faqSchema.map((faq: any, i: number) => (
              <div key={i} className="glass-card p-5">
                <h3 className="font-semibold text-foreground mb-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
