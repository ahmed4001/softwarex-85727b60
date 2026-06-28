import { enhanceHtmlImages } from "@/lib/html-enhance";
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
        canonicalUrl={`https://reviewhunts.com/alternatives/${slug}`}
        keywords={`${product?.name} alternatives, software like ${product?.name}, ${product?.name} competitors`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": page.title,
            "description": page.meta_description || `Top alternatives to ${product?.name}`,
            "url": `https://reviewhunts.com/alternatives/${slug}`,
            "numberOfItems": alternatives.length,
            ...((page as any).updated_at && {
              "dateModified": new Date((page as any).updated_at).toISOString().split("T")[0],
            }),
            "isPartOf": { "@type": "WebSite", "name": "ReviewHunts", "url": "https://reviewhunts.com" },
            ...(product && {
              "about": {
                "@type": "SoftwareApplication",
                "name": product.name,
                "url": `https://reviewhunts.com/product/${product.slug}`,
              },
            }),
            "mainEntity": {
              "@type": "ItemList",
              "name": `Alternatives to ${product?.name || page.title}`,
              "numberOfItems": alternatives.length,
              "itemListOrder": "https://schema.org/ItemListOrderDescending",
              "itemListElement": alternatives.map((a: any, idx: number) => {
                const alt = a.alternative || {};
                return {
                  "@type": "ListItem",
                  "position": idx + 1,
                  "url": `https://reviewhunts.com/product/${alt.slug}`,
                  "item": {
                    "@type": ["Product", "SoftwareApplication"],
                    "name": alt.name,
                    "url": `https://reviewhunts.com/product/${alt.slug}`,
                    "applicationCategory": (alt.categories as any)?.name || "BusinessApplication",
                    "operatingSystem": "Web",
                    ...(alt.logo_url && { "image": alt.logo_url }),
                    ...((alt.short_description || alt.description) && {
                      "description": alt.short_description || alt.description,
                    }),
                    ...(alt.avg_rating && alt.total_reviews > 0 && {
                      "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": Number(alt.avg_rating).toFixed(1),
                        "bestRating": "5",
                        "worstRating": "1",
                        "ratingCount": alt.total_reviews,
                        "reviewCount": alt.total_reviews,
                      },
                    }),
                  },
                };
              }),
            },
          },
          ...(faqSchema.length > 0 ? [{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqSchema.map((faq: any) => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": { "@type": "Answer", "text": faq.answer },
            })),
          }] : []),
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://reviewhunts.com" },
              { "@type": "ListItem", "position": 2, "name": "Alternatives", "item": "https://reviewhunts.com/alternatives" },
              { "@type": "ListItem", "position": 3, "name": page.title, "item": `https://reviewhunts.com/alternatives/${slug}` }
            ]
          }
        ]}
      />
      <main className="container py-10 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              {product?.logo_url ? (
                <img decoding="async" loading="lazy" src={product.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
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
            <div className="prose prose-sm max-w-none text-muted-foreground mt-4" dangerouslySetInnerHTML={{ __html: enhanceHtmlImages(page.intro_text, page.title || "") }} />
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
