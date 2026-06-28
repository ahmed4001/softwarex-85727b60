import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductLogo } from "@/components/ProductLogo";
import { Grid3X3, ChevronDown, ChevronUp } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  avg_rating?: number | null;
  total_reviews?: number | null;
  click_count?: number | null;
  view_count?: number | null;
  comparison_count?: number | null;
}

interface CategoryGridProps {
  products: Product[];
  categoryName?: string;
}

// Quadrant labels inspired by G2
const QUADRANTS = [
  { label: "Niche", x: "low", y: "low", color: "text-muted-foreground" },
  { label: "High Performers", x: "low", y: "high", color: "text-[hsl(var(--success))]" },
  { label: "Contenders", x: "high", y: "low", color: "text-[hsl(var(--warning,45_93%_47%))]" },
  { label: "Leaders", x: "high", y: "high", color: "text-primary" },
] as const;

function normalizeScore(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(5, Math.min(95, ((value - min) / (max - min)) * 90 + 5));
}

export function CategoryGrid({ products, categoryName }: CategoryGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const plotData = useMemo(() => {
    if (!products || products.length < 3) return null;

    // Satisfaction = avg_rating (0-5)
    // Market Presence = composite of total_reviews + view_count + comparison_count
    const items = products.map((p) => {
      const satisfaction = Number(p.avg_rating) || 0;
      const marketPresence =
        (Number(p.total_reviews) || 0) * 10 +
        (Number(p.view_count) || 0) * 0.1 +
        (Number(p.click_count) || 0) * 0.5 +
        (Number(p.comparison_count) || 0) * 5;
      return { ...p, satisfaction, marketPresence };
    });

    const mpValues = items.map((i) => i.marketPresence);
    const satValues = items.map((i) => i.satisfaction);
    const mpMin = Math.min(...mpValues);
    const mpMax = Math.max(...mpValues);
    const satMin = Math.min(...satValues);
    const satMax = Math.max(...satValues);

    return items.map((item) => ({
      ...item,
      x: normalizeScore(item.marketPresence, mpMin, mpMax),
      y: normalizeScore(item.satisfaction, satMin, satMax),
      quadrant:
        item.marketPresence > (mpMin + mpMax) / 2
          ? item.satisfaction > (satMin + satMax) / 2
            ? "Leaders"
            : "Contenders"
          : item.satisfaction > (satMin + satMax) / 2
            ? "High Performers"
            : "Niche",
    }));
  }, [products]);

  if (!plotData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden mb-8"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Grid3X3 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-foreground text-sm">
              {categoryName || "Category"} Grid
            </h3>
            <p className="text-xs text-muted-foreground">
              {plotData.length} products plotted by satisfaction vs market presence
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5">
          {/* Quadrant legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs">
            {QUADRANTS.map((q) => (
              <span key={q.label} className={cn("font-semibold", q.color)}>
                {q.label}
              </span>
            ))}
          </div>

          {/* Grid chart */}
          <div className="relative w-full aspect-square max-w-lg mx-auto border border-border/50 rounded-xl bg-muted/20 overflow-hidden">
            {/* Quadrant dividers */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/40" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-border/40" />

            {/* Quadrant labels */}
            <span className="absolute top-2 left-3 text-[10px] font-bold text-[hsl(var(--success))] opacity-50">
              High Performers
            </span>
            <span className="absolute top-2 right-3 text-[10px] font-bold text-primary opacity-50">
              Leaders
            </span>
            <span className="absolute bottom-2 left-3 text-[10px] font-bold text-muted-foreground opacity-50">
              Niche
            </span>
            <span className="absolute bottom-2 right-3 text-[10px] font-bold text-[hsl(var(--warning,45_93%_47%))] opacity-50">
              Contenders
            </span>

            {/* Axis labels */}
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
              Market Presence →
            </span>
            <span className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-muted-foreground font-medium uppercase tracking-wider origin-center whitespace-nowrap">
              Satisfaction →
            </span>

            {/* Product dots */}
            {plotData.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Link
                    to={`/product/${item.slug}`}
                    className="absolute -translate-x-1/2 translate-y-1/2 group"
                    style={{
                      left: `${item.x}%`,
                      bottom: `${item.y}%`,
                    }}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full border-2 overflow-hidden bg-background shadow-sm transition-all duration-200",
                        "group-hover:scale-125 group-hover:z-10 group-hover:shadow-lg",
                        item.quadrant === "Leaders"
                          ? "border-primary"
                          : item.quadrant === "High Performers"
                            ? "border-[hsl(var(--success))]"
                            : item.quadrant === "Contenders"
                              ? "border-[hsl(var(--warning,45_93%_47%))]"
                              : "border-border"
                      )}
                    >
                      {item.logo_url ? (
                        <img decoding="async" loading="lazy"
                          src={item.logo_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-primary bg-primary/10">
                          {item.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-bold">{item.name}</p>
                  <p className="text-muted-foreground">
                    ★ {item.satisfaction.toFixed(1)} · {item.total_reviews || 0} reviews · {item.quadrant}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
