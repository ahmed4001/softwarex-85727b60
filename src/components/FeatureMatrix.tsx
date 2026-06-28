import { Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  name: string;
  logo_url?: string | null;
  features?: any;
}

interface FeatureMatrixProps {
  products: Product[];
}

export function FeatureMatrix({ products }: FeatureMatrixProps) {
  // Gather all unique features across products
  const allFeatures = new Set<string>();
  products.forEach((p) => {
    if (Array.isArray(p.features)) {
      p.features.forEach((f: any) => {
        if (typeof f === "string") allFeatures.add(f);
        else if (f?.name) allFeatures.add(f.name);
      });
    }
  });

  const features = [...allFeatures];
  if (features.length === 0) return null;

  const hasFeature = (product: Product, feature: string): boolean | null => {
    if (!Array.isArray(product.features)) return null;
    return product.features.some((f: any) =>
      (typeof f === "string" ? f : f?.name) === feature
    );
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 pb-4">
        <h3 className="text-lg font-display font-bold text-foreground">Feature Comparison</h3>
        <p className="text-xs text-muted-foreground mt-1">Side-by-side feature availability</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-border/50">
              <th className="text-left p-4 font-medium text-muted-foreground bg-muted/30 w-1/3">Feature</th>
              {products.map((p, i) => (
                <th key={i} className="p-4 text-center bg-muted/30">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {p.logo_url ? (
                        <img decoding="async" loading="lazy" src={p.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-primary">{p.name.charAt(0)}</span>
                      )}
                    </div>
                    <span className="font-semibold text-foreground text-xs">{p.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature, fi) => (
              <tr key={fi} className={cn("border-t border-border/30", fi % 2 === 0 && "bg-muted/10")}>
                <td className="p-4 text-foreground font-medium">{feature}</td>
                {products.map((p, pi) => {
                  const has = hasFeature(p, feature);
                  return (
                    <td key={pi} className="p-4 text-center">
                      {has === true ? (
                        <Check className="h-4 w-4 text-[hsl(var(--success))] mx-auto" />
                      ) : has === false ? (
                        <X className="h-4 w-4 text-destructive/50 mx-auto" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
