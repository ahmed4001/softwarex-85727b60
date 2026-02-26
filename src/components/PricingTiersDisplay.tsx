import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingTier {
  name: string;
  price?: number | string;
  period?: string;
  description?: string;
  features?: string[];
  excluded_features?: string[];
  is_popular?: boolean;
  cta_label?: string;
  cta_url?: string;
}

interface PricingTiersDisplayProps {
  tiers: PricingTier[];
  productName: string;
  pricingModel?: string;
  startingPrice?: number | null;
  pricingDescription?: string | null;
}

export function PricingTiersDisplay({ tiers, productName, pricingModel, startingPrice, pricingDescription }: PricingTiersDisplayProps) {
  if (!tiers || tiers.length === 0) {
    return (
      <div className="glass-card p-8">
        <h2 className="text-xl font-display font-bold mb-4">Pricing</h2>
        <div className="flex items-center gap-4 mb-6">
          {pricingModel && <Badge variant="outline" className="capitalize rounded-lg text-base px-4 py-2">{pricingModel}</Badge>}
          {startingPrice && (
            <span className="text-4xl font-display font-bold text-foreground">
              ${startingPrice}<span className="text-lg font-normal text-muted-foreground">/mo</span>
            </span>
          )}
        </div>
        {pricingDescription && <p className="text-muted-foreground leading-relaxed">{pricingDescription}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold mb-1">{productName} Pricing Plans</h2>
        {pricingDescription && <p className="text-sm text-muted-foreground">{pricingDescription}</p>}
      </div>
      <div className={cn(
        "grid gap-5",
        tiers.length === 1 && "max-w-md",
        tiers.length === 2 && "md:grid-cols-2 max-w-2xl",
        tiers.length >= 3 && "md:grid-cols-2 lg:grid-cols-3",
      )}>
        {tiers.map((tier, i) => (
          <div
            key={i}
            className={cn(
              "glass-card p-6 flex flex-col relative overflow-hidden transition-all hover:shadow-lg",
              tier.is_popular && "ring-2 ring-primary shadow-lg shadow-primary/10"
            )}
          >
            {tier.is_popular && (
              <div className="absolute top-0 right-0">
                <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground gap-1 text-xs font-semibold px-3 py-1">
                  <Sparkles className="h-3 w-3" /> Popular
                </Badge>
              </div>
            )}
            <h3 className="font-display font-bold text-lg text-foreground mb-1">{tier.name}</h3>
            {tier.description && <p className="text-xs text-muted-foreground mb-4">{tier.description}</p>}
            <div className="mb-5">
              {typeof tier.price === "number" ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold text-foreground">${tier.price}</span>
                  <span className="text-sm text-muted-foreground">/{tier.period || "mo"}</span>
                </div>
              ) : (
                <span className="text-3xl font-display font-bold text-foreground">{tier.price || "Custom"}</span>
              )}
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {(tier.features || []).map((f, j) => (
                <li key={j} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
              {(tier.excluded_features || []).map((f, j) => (
                <li key={`x-${j}`} className="flex items-start gap-2 text-sm">
                  <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground/60 line-through">{f}</span>
                </li>
              ))}
            </ul>
            {tier.cta_url ? (
              <a href={tier.cta_url} target="_blank" rel="noopener noreferrer">
                <Button className={cn("w-full rounded-xl font-semibold", tier.is_popular ? "btn-premium text-primary-foreground" : "")} variant={tier.is_popular ? "default" : "outline"}>
                  {tier.cta_label || "Get Started"}
                </Button>
              </a>
            ) : (
              <Button className={cn("w-full rounded-xl font-semibold", tier.is_popular ? "btn-premium text-primary-foreground" : "")} variant={tier.is_popular ? "default" : "outline"} disabled>
                {tier.cta_label || "Get Started"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
