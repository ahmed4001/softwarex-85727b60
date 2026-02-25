import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export function ProductSpotlightSection() {
  const { data: product } = useQuery({
    queryKey: ["product-spotlight"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name)")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("avg_rating", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (!product) return null;

  return (
    <section className="py-20" aria-labelledby="spotlight-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <p className="text-sm font-semibold text-primary mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Product Spotlight
          </p>
          <h2 id="spotlight-heading" className="text-2xl md:text-3xl font-extrabold text-foreground">
            Featured Product of the Month
          </h2>
          <p className="text-muted-foreground mt-1">Hand-picked by our editorial team</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <Link
            to={`/product/${product.slug}`}
            className="glass-card group block overflow-hidden ring-1 ring-primary/10"
          >
            <div className="flex flex-col md:flex-row">
              {/* Left: Hero area */}
              <div className="md:w-2/5 bg-gradient-to-br from-primary/5 to-primary/10 p-8 md:p-10 flex items-center justify-center">
                <div className="h-24 w-24 md:h-32 md:w-32 rounded-2xl bg-background shadow-lg flex items-center justify-center overflow-hidden">
                  {product.logo_url ? (
                    <img
                      src={product.logo_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.parentElement!.innerHTML = `<span class="text-4xl font-bold text-primary">${product.name.charAt(0)}</span>`;
                      }}
                    />
                  ) : (
                    <span className="text-4xl font-bold text-primary">{product.name.charAt(0)}</span>
                  )}
                </div>
              </div>

              {/* Right: Details */}
              <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  {(product.categories as any)?.name && (
                    <span className="text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                      {(product.categories as any).name}
                    </span>
                  )}
                  {product.pricing_model && (
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full capitalize">
                      {product.pricing_model}
                    </span>
                  )}
                </div>

                <h3 className="text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                  {product.name}
                </h3>

                {product.tagline && (
                  <p className="text-muted-foreground mb-4 line-clamp-2">{product.tagline}</p>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <StarRating rating={Number(product.avg_rating) || 0} size="sm" />
                  <span className="text-sm font-semibold text-foreground">
                    {(Number(product.avg_rating) || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({product.total_reviews || 0} reviews)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Button size="sm" className="gap-1.5 group/btn">
                    Read Reviews <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </Button>
                  {product.website_url && (
                    <Button size="sm" variant="outline" className="gap-1.5" asChild>
                      <a href={product.website_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        Visit Site <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
