import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

export default function LandingPageView() {
  const { slug } = useParams();

  const { data: page, isLoading } = useQuery({
    queryKey: ["landing-page", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_landing_pages")
        .select("*")
        .eq("slug", slug!)
        .eq("is_published", true)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  const productIds = (page?.product_ids as string[]) || [];

  const { data: products = [] } = useQuery({
    queryKey: ["landing-page-products", productIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name)")
        .in("id", productIds)
        .eq("is_active", true);
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  if (isLoading) return <div className="container py-20 text-center text-muted-foreground">Loading...</div>;
  if (!page) return <div className="container py-20 text-center text-muted-foreground">Page not found.</div>;

  return (
    <>
      <SeoHead title={page.title} description={page.meta_description || ""} />
      <div className="container py-10 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">{page.title}</h1>
          {page.meta_description && <p className="text-lg text-muted-foreground mb-8">{page.meta_description}</p>}
        </motion.div>

        {page.body && (
          <div className="prose prose-sm max-w-none mb-10 text-muted-foreground">
            <ReactMarkdown>{page.body}</ReactMarkdown>
          </div>
        )}

        {products.length > 0 && (
          <div>
            <h2 className="text-xl font-display font-bold text-foreground mb-4">Top Picks</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {products.map((p: any) => (
                <ProductCard
                  key={p.id} id={p.id} slug={p.slug} name={p.name} tagline={p.tagline}
                  logo_url={p.logo_url} avg_rating={Number(p.avg_rating)} total_reviews={p.total_reviews}
                  pricing_model={p.pricing_model} category_name={p.categories?.name}
                  is_featured={p.is_featured} is_sponsored={p.is_sponsored}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
