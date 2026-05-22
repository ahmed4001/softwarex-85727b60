import { useMemo, useState } from "react";
import { computeSeoScore, type SeoLevel } from "@/lib/blog-seo-score";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  seoTitle?: string;
  metaDescription?: string;
  slug: string;
  body: string;
  focusKeyword?: string;
  featuredImage?: string;
  onFix?: (action: FixAction) => void;
}

export type FixAction =
  | { type: "focus-title" }
  | { type: "focus-meta" }
  | { type: "focus-keyword" }
  | { type: "focus-slug" }
  | { type: "focus-featured" }
  | { type: "focus-body" };

const LEVEL_ORDER: Record<SeoLevel, number> = { bad: 0, warn: 1, good: 2 };

const FIX_MAP: Record<string, FixAction> = {
  "title-length": { type: "focus-title" },
  "meta-desc": { type: "focus-meta" },
  "kw-set": { type: "focus-keyword" },
  "kw-title": { type: "focus-title" },
  "kw-meta": { type: "focus-meta" },
  "kw-slug": { type: "focus-slug" },
  "kw-intro": { type: "focus-body" },
  "kw-density": { type: "focus-body" },
  "h-structure": { type: "focus-body" },
  "h1-count": { type: "focus-body" },
  "img-alt": { type: "focus-body" },
  "internal-links": { type: "focus-body" },
  "external-links": { type: "focus-body" },
  "slug": { type: "focus-slug" },
  "length": { type: "focus-body" },
  "readability": { type: "focus-body" },
  "featured": { type: "focus-featured" },
};

export function SeoErrorBoard(props: Props) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<"all" | "errors" | "warnings">("all");
  const result = useMemo(() => computeSeoScore(props), [props]);

  const sortedChecks = useMemo(() => {
    const f = filter === "errors" ? (c: any) => c.level === "bad"
      : filter === "warnings" ? (c: any) => c.level === "warn"
      : () => true;
    return [...result.checks].filter(f).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [result, filter]);

  const counts = useMemo(() => ({
    bad: result.checks.filter((c) => c.level === "bad").length,
    warn: result.checks.filter((c) => c.level === "warn").length,
    good: result.checks.filter((c) => c.level === "good").length,
  }), [result]);

  const grade = result.level === "good" ? "A" : result.level === "warn" ? "B" : "C";
  const ringColor = result.level === "good" ? "stroke-emerald-500"
    : result.level === "warn" ? "stroke-amber-500" : "stroke-destructive";
  const textColor = result.level === "good" ? "text-emerald-600"
    : result.level === "warn" ? "text-amber-600" : "text-destructive";

  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (result.score / 100) * circumference;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="relative h-12 w-12 flex-shrink-0">
          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" strokeWidth="5" className="stroke-muted fill-none" />
            <circle
              cx="32" cy="32" r="28" strokeWidth="5" strokeLinecap="round"
              className={cn("fill-none transition-all", ringColor)}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-sm font-bold", textColor)}>{result.score}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            SEO Error Board <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", textColor, "bg-muted")}>{grade}</span>
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
            <span className="text-destructive font-medium">{counts.bad} errors</span>
            <span className="text-amber-600 font-medium">{counts.warn} warnings</span>
            <span className="text-emerald-600 font-medium">{counts.good} passing</span>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Filters */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-muted/20">
            {([
              ["all", `All ${result.checks.length}`],
              ["errors", `Errors ${counts.bad}`],
              ["warnings", `Warnings ${counts.warn}`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                  filter === key ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-2 px-3 py-3 border-b border-border bg-muted/10">
            <Stat label="Words" value={result.stats.words} />
            <Stat label="Headings" value={result.stats.h2 + result.stats.h3} />
            <Stat label="Links" value={result.stats.internalLinks + result.stats.externalLinks} />
            <Stat label="Density" value={`${result.stats.keywordDensity.toFixed(1)}%`} />
          </div>

          {/* Checks */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {sortedChecks.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                <Sparkles className="h-5 w-5 mx-auto mb-2 opacity-40" />
                Nothing to fix here. Nice work.
              </div>
            ) : (
              sortedChecks.map((c) => {
                const Icon = c.level === "good" ? CheckCircle2 : c.level === "warn" ? AlertTriangle : XCircle;
                const color = c.level === "good" ? "text-emerald-600" : c.level === "warn" ? "text-amber-600" : "text-destructive";
                const fix = FIX_MAP[c.id];
                return (
                  <div key={c.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", color)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{c.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{c.message}</p>
                    </div>
                    {fix && c.level !== "good" && props.onFix && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] font-semibold text-primary hover:bg-primary/10"
                        onClick={() => props.onFix!(fix)}
                      >
                        Fix
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
