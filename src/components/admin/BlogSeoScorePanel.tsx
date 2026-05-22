import { useMemo } from "react";
import { computeSeoScore, type SeoScoreInput, type SeoLevel } from "@/lib/blog-seo-score";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON: Record<SeoLevel, typeof CheckCircle2> = {
  good: CheckCircle2,
  warn: AlertCircle,
  bad: XCircle,
};

const LEVEL_TEXT: Record<SeoLevel, string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-destructive",
};

const LEVEL_RING: Record<SeoLevel, string> = {
  good: "stroke-emerald-500",
  warn: "stroke-amber-500",
  bad: "stroke-destructive",
};

export function BlogSeoScorePanel(props: SeoScoreInput) {
  const result = useMemo(() => computeSeoScore(props), [props]);
  const { score, level, checks, stats } = result;

  // grouped
  const good = checks.filter((c) => c.level === "good");
  const warn = checks.filter((c) => c.level === "warn");
  const bad = checks.filter((c) => c.level === "bad");

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="space-y-4">
      {/* Score meter */}
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 flex-shrink-0">
          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" strokeWidth="6" className="stroke-muted fill-none" />
            <circle
              cx="40" cy="40" r="36" strokeWidth="6" strokeLinecap="round"
              className={cn("fill-none transition-all", LEVEL_RING[level])}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-lg font-bold", LEVEL_TEXT[level])}>{score}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">SEO Score</p>
          <p className={cn("text-xs font-medium", LEVEL_TEXT[level])}>
            {level === "good" ? "Great — ready to rank" : level === "warn" ? "Needs improvement" : "Critical issues"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {good.length} passed · {warn.length} warnings · {bad.length} errors
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Words" value={stats.words} />
        <Stat label="Read" value={`${stats.readingTime}m`} />
        <Stat label="Links" value={stats.internalLinks + stats.externalLinks} />
        <Stat label="Density" value={`${stats.keywordDensity.toFixed(1)}%`} />
      </div>

      {/* Check list */}
      <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
        {[...bad, ...warn, ...good].map((c) => {
          const Icon = ICON[c.level];
          return (
            <div key={c.id} className="flex items-start gap-2 py-1.5 text-xs">
              <Icon className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", LEVEL_TEXT[c.level])} />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{c.label}</p>
                <p className="text-muted-foreground">{c.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/50 py-1.5">
      <p className="text-xs font-semibold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
