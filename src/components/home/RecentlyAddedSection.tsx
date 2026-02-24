import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export function RecentlyAddedSection() {
  const { data: recentProducts } = useQuery({
    queryKey: ["products-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, slug, name, tagline, logo_url, created_at, categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  if (!recentProducts || recentProducts.length === 0) return null;

  return (
    <section className="py-20 bg-muted/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <p className="text-sm font-semibold text-primary mb-1">New Arrivals</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">Recently added</h2>
            <p className="text-muted-foreground mt-1">The latest software added to our directory</p>
          </div>
          <Link to="/category/all">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              View All <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentProducts.map((p: any, i: number) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/product/${p.slug}`} className="glass-card p-5 group block">
                <div className="flex items-start gap-3.5">
                  <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-base font-bold text-primary">{p.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-[15px] group-hover:text-primary transition-colors truncate">
                      {p.name}
                    </h3>
                    {p.tagline && <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{p.tagline}</p>}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Added {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                      {p.categories?.name && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <span>{p.categories.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
