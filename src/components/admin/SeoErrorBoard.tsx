import { useMemo, useState } from "react";
import { computeSeoScore, type SeoLevel } from "@/lib/blog-seo-score";
import {
  CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp, Sparkles,
  Globe, TrendingUp,
} from "lucide-react";
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
  "title-power": { type: "focus-title" },
  "title-number": { type: "focus-title" },
  "title-freshness": { type: "focus-title" },
  "meta-desc": { type: "focus-meta" },
  "kw-set": { type: "focus-keyword" },
  "kw-title": { type: "focus-title" },
  "kw-title-start": { type: "focus-title" },
  "kw-meta": { type: "focus-meta" },
  "kw-slug": { type: "focus-slug" },
  "kw-intro": { type: "focus-body" },
  "kw-density": { type: "focus-body" },
  "kw-heading": { type: "focus-body" },
  "kw-img-alt": { type: "focus-body" },
  "h-structure": { type: "focus-body" },
  "h1-count": { type: "focus-body" },
  "img-alt": { type: "focus-body" },
  "internal-links": { type: "focus-body" },
  "external-links": { type: "focus-body" },
  "slug": { type: "focus-slug" },
  "length": { type: "focus-body" },
  "readability": { type: "focus-body" },
  "featured": { type: "focus-featured" },
  "paragraphs": { type: "focus-body" },
  "sentence-length": { type: "focus-body" },
  "transition-words": { type: "focus-body" },
  "passive-voice": { type: "focus-body" },
  "lists": { type: "focus-body" },
  "media-rich": { type: "focus-body" },
  "title-capital": { type: "focus-title" },
  "meta-hook": { type: "focus-meta" },
  "meta-cta": { type: "focus-meta" },
  "h-hierarchy": { type: "focus-body" },
  "anchor-text": { type: "focus-body" },
  "link-safety": { type: "focus-body" },
  "img-lazy": { type: "focus-body" },
  "slug-words": { type: "focus-slug" },
  "slug-stop": { type: "focus-slug" },
  "kw-title-stuff": { type: "focus-title" },
  "title-h1-match": { type: "focus-body" },
  "read-time": { type: "focus-body" },
  "h1-missing": { type: "focus-body" },
  "kw-h1": { type: "focus-body" },
  "slug-special": { type: "focus-slug" },
  "slug-underscore": { type: "focus-slug" },
  "http-links": { type: "focus-body" },
  "external-overuse": { type: "focus-body" },
  "internal-overuse": { type: "focus-body" },
  "alt-generic": { type: "focus-body" },
  "intro-length": { type: "focus-body" },
  "conclusion": { type: "focus-body" },
  "cta-body": { type: "focus-body" },
  "authority-link": { type: "focus-body" },
  "subhead-distribution": { type: "focus-body" },
  "lsi-coverage": { type: "focus-body" },
  "title-clickbait": { type: "focus-title" },
};

// Category labels shown beside each check icon
const CATEGORY_MAP: Record<string, string> = {
  "title-length": "Title",
  "title-power": "Title",
  "title-number": "Title",
  "title-freshness": "Title",
  "meta-desc": "Meta",
  "kw-set": "Keyword",
  "kw-title": "Keyword",
  "kw-title-start": "Keyword",
  "kw-meta": "Keyword",
  "kw-slug": "Keyword",
  "kw-intro": "Keyword",
  "kw-density": "Keyword",
  "kw-heading": "Keyword",
  "kw-img-alt": "Keyword",
  "h-structure": "Headings",
  "h1-count": "Headings",
  "img-alt": "Media",
  "internal-links": "Links",
  "external-links": "Links",
  "slug": "URL",
  "length": "Content",
  "readability": "Content",
  "featured": "Media",
  "paragraphs": "Readability",
  "sentence-length": "Readability",
  "transition-words": "Readability",
  "passive-voice": "Readability",
  "lists": "Structure",
  "media-rich": "Media",
  "title-capital": "Title",
  "meta-hook": "Meta",
  "meta-cta": "Meta",
  "h-hierarchy": "Headings",
  "anchor-text": "Links",
  "link-safety": "Links",
  "img-lazy": "Performance",
  "slug-words": "URL",
  "slug-stop": "URL",
  "kw-title-stuff": "Keyword",
  "title-h1-match": "Title",
  "read-time": "Content",
  "h1-missing": "Headings",
  "kw-h1": "Keyword",
  "slug-special": "URL",
  "slug-underscore": "URL",
  "http-links": "Technical",
  "external-overuse": "Links",
  "internal-overuse": "Links",
  "alt-generic": "Media",
  "intro-length": "Content",
  "conclusion": "Content",
  "cta-body": "Engagement",
  "authority-link": "E-E-A-T",
  "subhead-distribution": "Headings",
  "lsi-coverage": "Keyword",
  "title-clickbait": "Title",
};

// Industry benchmark tiers used for the comparison bar
const BENCHMARKS = [
  { label: "Poor",      min: 0,  max: 40,  color: "bg-rose-400/70"   },
  { label: "Fair",      min: 40, max: 55,  color: "bg-orange-400/70" },
  { label: "Good",      min: 55, max: 80,  color: "bg-amber-400/70"  },
  { label: "Excellent", min: 80, max: 100, color: "bg-emerald-500/80" },
];

function getTier(score: number) {
  return BENCHMARKS.find((b) => score >= b.min && score <= b.max) ?? BENCHMARKS[0];
}

const INDUSTRY_AVG = 62; // average on-page SEO score reference

export function SeoErrorBoard(props: Props) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<"all" | "errors" | "warnings" | "passing">("all");
  const result = useMemo(() => computeSeoScore(props), [props]);

  const sortedChecks = useMemo(() => {
    const f =
      filter === "errors" ? (c: any) => c.level === "bad"
      : filter === "warnings" ? (c: any) => c.level === "warn"
      : filter === "passing" ? (c: any) => c.level === "good"
      : () => true;
    return [...result.checks].filter(f).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [result, filter]);

  const counts = useMemo(() => ({
    bad: result.checks.filter((c) => c.level === "bad").length,
    warn: result.checks.filter((c) => c.level === "warn").length,
    good: result.checks.filter((c) => c.level === "good").length,
  }), [result]);

  const tone =
    result.level === "good" ? {
      text: "text-emerald-600", bar: "bg-emerald-500",
      ring: "ring-emerald-200/60", bg: "bg-emerald-50 dark:bg-emerald-950/30",
    }
    : result.level === "warn" ? {
      text: "text-amber-600", bar: "bg-amber-500",
      ring: "ring-amber-200/60", bg: "bg-amber-50 dark:bg-amber-950/30",
    }
    : {
      text: "text-rose-600", bar: "bg-rose-500",
      ring: "ring-rose-200/60", bg: "bg-rose-50 dark:bg-rose-950/30",
    };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header — score + progress bar */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 pt-4 pb-3 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("inline-flex items-center justify-center h-7 w-7 rounded-md", tone.bg)}>
              <TrendingUp className={cn("h-3.5 w-3.5", tone.text)} />
            </span>
            <span className="text-sm font-semibold text-foreground">SEO Score</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end leading-none">
              <span className={cn("text-2xl font-bold tabular-nums", tone.text)}>
                {result.score}%
              </span>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider mt-0.5", tone.text)}>
                {getTier(result.score).label}
              </span>
            </div>
            {open
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Benchmark scale */}
        <div className="mt-3">
          <div className="relative h-2 w-full rounded-full overflow-hidden flex">
            {BENCHMARKS.map((b) => (
              <div
                key={b.label}
                className={cn("h-full", b.color)}
                style={{ width: `${b.max - b.min}%` }}
              />
            ))}
            {/* Industry average marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-px bg-foreground/40"
              style={{ left: `${INDUSTRY_AVG}%` }}
              title={`Industry avg ${INDUSTRY_AVG}%`}
            />
            {/* Your score marker */}
            <div
              className="absolute -top-0.5 h-3 w-1 rounded-sm bg-foreground shadow ring-2 ring-background"
              style={{ left: `calc(${Math.max(0, Math.min(100, result.score))}% - 2px)` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
            <span>Poor</span>
            <span>Fair</span>
            <span>Good</span>
            <span>Excellent</span>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            You: <span className={cn("font-semibold", tone.text)}>{result.score}%</span>
            <span className="mx-1.5">·</span>
            Industry avg: <span className="font-semibold text-foreground">{INDUSTRY_AVG}%</span>
            <span className="mx-1.5">·</span>
            {result.score >= INDUSTRY_AVG
              ? <span className="text-emerald-600 font-semibold">+{result.score - INDUSTRY_AVG} above avg</span>
              : <span className="text-rose-600 font-semibold">{result.score - INDUSTRY_AVG} below avg</span>}
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Compact filter chips */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-muted/10 overflow-x-auto">
            {([
              ["all", `All ${result.checks.length}`],
              ["errors", `Errors ${counts.bad}`],
              ["warnings", `Warnings ${counts.warn}`],
              ["passing", `Passing ${counts.good}`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  filter === key
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Checks — dot-bullet style like the reference */}
          <div className="max-h-[360px] overflow-y-auto">
            {sortedChecks.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                <Sparkles className="h-5 w-5 mx-auto mb-2 opacity-40" />
                Nothing to fix here. Nice work.
              </div>
            ) : (
              <ul className="py-1.5">
                {sortedChecks.map((c) => {
                  const Icon =
                    c.level === "good" ? CheckCircle2
                    : c.level === "warn" ? AlertCircle
                    : XCircle;
                  const color =
                    c.level === "good" ? "text-emerald-500"
                    : c.level === "warn" ? "text-amber-500"
                    : "text-rose-500";
                  const fix = FIX_MAP[c.id];
                  return (
                    <li
                      key={c.id}
                      className="group flex items-start gap-2.5 px-4 py-1.5 hover:bg-muted/30 transition-colors"
                    >
                      <Icon className={cn("h-3.5 w-3.5 mt-[3px] flex-shrink-0", color)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {CATEGORY_MAP[c.id] && (
                            <span className="inline-flex items-center rounded bg-muted px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {CATEGORY_MAP[c.id]}
                            </span>
                          )}
                          <p className="text-[12.5px] leading-snug text-foreground">
                            {c.label}
                          </p>
                        </div>
                        {c.level !== "good" && (
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                            {c.message}
                          </p>
                        )}
                      </div>
                      {fix && c.level !== "good" && props.onFix && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] font-semibold text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => props.onFix!(fix)}
                        >
                          Fix
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Compact stats footer */}
          <div className="grid grid-cols-4 gap-1 px-3 py-2.5 border-t border-border bg-muted/10">
            <Stat label="Words" value={result.stats.words} />
            <Stat label="Headings" value={result.stats.h2 + result.stats.h3} />
            <Stat label="Links" value={result.stats.internalLinks + result.stats.externalLinks} />
            <Stat label="Density" value={`${result.stats.keywordDensity.toFixed(1)}%`} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold text-foreground tabular-nums">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Social Preview                                                            */
/* -------------------------------------------------------------------------- */

interface SocialPreviewProps {
  title: string;
  description?: string;
  slug?: string;
  image?: string;
  siteDomain?: string;
}

export function SocialPreview({
  title, description, slug, image, siteDomain,
}: SocialPreviewProps) {
  const domain =
    siteDomain ||
    (typeof window !== "undefined" ? window.location.hostname.replace(/^www\./, "") : "yoursite.com");

  const url = slug
    ? `${domain.toUpperCase()}/${slug.toUpperCase()}`
    : domain.toUpperCase();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Social Preview</span>
      </div>
      <div className="p-3">
        <div className="rounded-lg border border-border overflow-hidden bg-background">
          {/* Image */}
          <div className="aspect-[1.91/1] bg-muted flex items-center justify-center">
            {image ? (
              <img src={image} alt="" className="w-full h-full object-cover" />
            ) : (
              <Globe className="h-8 w-8 text-muted-foreground/40" />
            )}
          </div>
          {/* Text */}
          <div className="px-3 py-2.5 border-t border-border space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
              {url}
            </p>
            <p className="text-sm font-semibold text-foreground line-clamp-1 leading-tight">
              {title || "Page Title"}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
              {description || "Page description will appear here…"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
