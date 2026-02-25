import { Link } from "react-router-dom";
import { StarRating } from "./StarRating";
import { ArrowUpRight, Sparkles, Bookmark } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { useSavedProducts } from "@/hooks/useSavedProducts";
import { useAuth } from "@/hooks/useAuth";
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
}

export function ProductCard({ id, slug, name, tagline, logo_url, avg_rating, total_reviews, pricing_model, category_name, is_featured, is_sponsored }: ProductCardProps) {
  const { user } = useAuth();
  const { isSaved, toggleSave, isToggling } = useSavedProducts();
  const saved = user ? isSaved(id) : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      {user && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(id); }}
          disabled={isToggling}
          className={cn(
            "absolute top-3 right-3 z-10 p-1.5 rounded-lg transition-all duration-200",
            saved
              ? "bg-primary/10 text-primary"
              : "bg-muted/80 text-muted-foreground/40 hover:text-primary hover:bg-primary/10"
          )}
          aria-label={saved ? "Remove from saved" : "Save product"}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        </button>
      )}
      <Link to={`/product/${slug}`} className={cn("glass-card p-5 group block relative", is_sponsored && "ring-1 ring-primary/15 bg-primary/[0.02]")}>
        {is_sponsored && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="absolute top-3 left-3 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded cursor-default">
                  AD
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                This is a sponsored listing
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {logo_url ? (
              <img src={logo_url} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-base font-bold text-primary">{name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="font-semibold text-foreground text-[15px] group-hover:text-primary transition-colors truncate">
                {name}
              </h3>
              {is_featured && <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
            </div>
            {tagline && <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{tagline}</p>}
            <div className="flex items-center gap-2">
              <StarRating rating={avg_rating} size="sm" />
              <span className="text-sm font-semibold text-foreground">{avg_rating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({total_reviews})</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {category_name && (
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">{category_name}</span>
              )}
              {pricing_model && (
                <span className="text-[11px] text-muted-foreground capitalize font-medium">{pricing_model}</span>
              )}
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
        </div>
      </Link>
    </motion.div>
  );
}
