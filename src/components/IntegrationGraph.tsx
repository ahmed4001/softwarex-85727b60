import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Plug } from "lucide-react";

export function IntegrationGraph({ productId }: { productId: string }) {
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["product-integrations", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_integrations")
        .select("*, integrates_with:products!product_integrations_integrates_with_product_id_fkey(id, name, slug, logo_url, tagline)")
        .eq("product_id", productId);

      // Also get reverse relationships
      const { data: reverse } = await supabase
        .from("product_integrations")
        .select("*, integrates_with:products!product_integrations_product_id_fkey(id, name, slug, logo_url, tagline)")
        .eq("integrates_with_product_id", productId);

      const all = [
        ...(data || []).map((d: any) => ({ ...d, product: d.integrates_with })),
        ...(reverse || []).map((d: any) => ({ ...d, product: d.integrates_with })),
      ];

      // Dedupe by product id
      const seen = new Set<string>();
      return all.filter((item: any) => {
        if (!item.product?.id || seen.has(item.product.id)) return false;
        seen.add(item.product.id);
        return true;
      });
    },
  });

  if (isLoading) {
    return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>;
  }

  if (integrations.length === 0) {
    return (
      <div className="glass-card p-12 text-center text-muted-foreground">
        <Plug className="h-8 w-8 mx-auto mb-3 opacity-30" />
        <p>No integrations listed yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {integrations.map((item: any) => (
          <Link
            key={item.product.id}
            to={`/product/${item.product.slug}`}
            className="glass-card p-4 hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {item.product.logo_url ? (
                  <img decoding="async" loading="lazy" src={item.product.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-primary">{item.product.name?.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{item.product.name}</p>
                {item.category && <Badge variant="outline" className="text-[10px] mt-1">{item.category}</Badge>}
              </div>
            </div>
            {item.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
