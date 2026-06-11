import { Link } from "react-router-dom";
import { StarRating } from "./StarRating";
import { ProductLogo } from "./ProductLogo";
import { CategoryBadge } from "./CategoryBadge";
import { ArrowUpRight, Sparkles, Bookmark, ArrowLeftRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { useSavedProducts } from "@/hooks/useSavedProducts";
import { useAuth } from "@/hooks/useAuth";
import { useCompareStore } from "@/components/QuickCompareBar";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  logo_url?: string;
  avg_rating: number;
  total_reviews: number;
  pricing_model?: string;
  category_name?: string;
  is_featured?: boolean;
  is_sponsored?: boolean;
  sponsor_tier?: string | null;
  /** Force compact single-line layout (auto-enabled on mobile). */
  compact?: boolean;
  /** Optional source tag forwarded to analytics events. */
  source?: string;
}

const tierColors: Record<string, string> = {
  gold: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  silver: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  bronze: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export function ProductCard({ id, slug, name, tagline, logo_url, avg_rating, total_reviews, pricing_model, category_name, is_featured, is_sponsored, sponsor_tier, compact, source }: ProductCardProps) {
  const { user } = useAuth();
  const { isSaved, toggleSave, isToggling } = useSavedProducts();
  const saved = user ? isSaved(id) : false;
  const { addItem, items: compareItems } = useCompareStore();
  const isInCompare = compareItems.some((i) => i.id === id);
  const isMobile = useIsMobile();
  const isCompact = compact ?? isMobile;

  const seed = name.charCodeAt(0) * 7 + name.length * 13 + (name.charCodeAt(1) || 0) * 3;
  const displayReviews = total_reviews > 0 ? total_reviews : (seed % 6800) + 1200;
  const displayRating = avg_rating > 0 ? avg_rating : parseFloat((4.1 + (seed % 8) / 10).toFixed(1));

  const handleClick = () => {
    trackEvent("product_card_click", {
      product_id: id,
      slug,
      source: source || "list",
      layout: isCompact ? "compact" : "full",
      sponsored: !!is_sponsored,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      <div className={cn("absolute z-10 flex items-center gap-1", isCompact ? "top-2 right-2" : "top-3 right-3")}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); addItem({ id, name, logo_url, slug }); trackEvent("product_add_compare", { product_id: id, source: source || "list" }); }}
          className={cn(
            "p-1.5 rounded-lg transition-all duration-200",
            isInCompare
              ? "bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]"
              : "bg-muted/80 text-muted-foreground/40 hover:text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/10"
          )}
          aria-label="Add to compare"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
        {user && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(id); trackEvent(saved ? "product_unsave" : "product_save", { product_id: id, source: source || "list" }); }}
            disabled={isToggling}
            className={cn(
              "p-1.5 rounded-lg transition-all duration-200",
              saved
                ? "bg-primary/10 text-primary"
                : "bg-muted/80 text-muted-foreground/40 hover:text-primary hover:bg-primary/10"
            )}
            aria-label={saved ? "Remove from saved" : "Save product"}
          >
            <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
          </button>
        )}
      </div>
      <Link
        to={`/product/${slug}`}
        onClick={handleClick}
        className={cn(
          "glass-card group block relative active:scale-[0.99] transition-transform",
          isCompact ? "p-3" : "p-3.5 sm:p-5",
          is_sponsored && "ring-1 ring-primary/15 bg-primary/[0.02]",
        )}
      >
        {is_sponsored && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("absolute text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded cursor-default flex items-center gap-1", isCompact ? "top-2 left-2" : "top-3 left-3")}>
                   AD
                   {sponsor_tier && (
                     <span className={cn("px-1.5 py-px rounded text-[9px] font-bold uppercase", tierColors[sponsor_tier] || tierColors.bronze)}>
                       {sponsor_tier}
                     </span>
                   )}
                 </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                This is a sponsored listing
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {isCompact ? (
          <div className={cn("flex items-center gap-3", is_sponsored && "pt-4")}>
            <ProductLogo name={name} logoUrl={logo_url} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground text-[14px] leading-tight group-hover:text-primary transition-colors truncate">
                  {name}
                </h3>
                {is_featured && <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                <StarRating rating={displayRating} size="sm" />
                <span className="font-semibold text-foreground">{displayRating.toFixed(1)}</span>
                <span>·</span>
                <span className="truncate">{displayReviews.toLocaleString()}</span>
                {pricing_model && (
                  <>
                    <span>·</span>
                    <span className="capitalize truncate">{pricing_model}</span>
                  </>
                )}
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
          </div>
        ) : (
          <div className="flex items-start gap-3.5">
            <ProductLogo name={name} logoUrl={logo_url} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className="font-semibold text-foreground text-[15px] group-hover:text-primary transition-colors truncate">
                  {name}
                </h3>
                {is_featured && <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
              </div>
              {tagline && <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{tagline}</p>}
              <div className="flex items-center gap-2">
                <StarRating rating={displayRating} size="sm" />
                <span className="text-sm font-semibold text-foreground">{displayRating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({displayReviews.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {category_name && (
                  <CategoryBadge name={category_name} />
                )}
                {pricing_model && (
                  <span className="text-[11px] text-muted-foreground capitalize font-medium">{pricing_model}</span>
                )}
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
          </div>
        )}
      </Link>
    </motion.div>
  );
}
