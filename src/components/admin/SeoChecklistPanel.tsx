import { useMemo, useState } from "react";
import { ChevronDown, AlertCircle, AlertTriangle, CheckCircle2, ListChecks, Lightbulb } from "lucide-react";
import { computeSeoScore, type SeoScoreInput, type SeoLevel } from "@/lib/blog-seo-score";
import { cn } from "@/lib/utils";

// Detailed "how to fix" guidance per check id.
// Falls back to the check's own message when no guidance exists.
const FIX_GUIDE: Record<string, { how: string; why: string }> = {
  "title-length": {
    how: "Edit the SEO title so it lands between 50–60 characters. Lead with the primary benefit and include your focus keyword early.",
    why: "Google truncates titles longer than ~60 chars in search results, hurting click-through.",
  },
  "meta-desc": {
    how: "Write a meta description of 140–160 chars summarising the post, including the focus keyword and a soft CTA.",
    why: "A compelling meta description is your free ad copy in search results — it directly impacts CTR.",
  },
  "kw-set": {
    how: "Open the SEO meta strip and set a focus keyword (1–4 words) that matches what readers would search for.",
    why: "Without a focus keyword the editor can't guide optimisation and rankings become accidental.",
  },
  "kw-title": {
    how: "Add your focus keyword to the SEO title — ideally in the first 60% of the title.",
    why: "Keywords near the start of the title carry the most weight for ranking and relevance.",
  },
  "kw-title-start": {
    how: "Rewrite the title so the focus keyword appears within the first 3–4 words.",
    why: "Title front-loading is a small but consistent ranking signal.",
  },
  "kw-meta": {
    how: "Mention the focus keyword naturally once in the meta description.",
    why: "Google bolds matching query terms in the description, increasing CTR.",
  },
  "kw-slug": {
    how: "Use a slug like /blog/your-focus-keyword. Keep it short, lowercase, hyphen-separated.",
    why: "Slugs are a visible ranking & UX signal that appears in SERPs and shares.",
  },
  "kw-intro": {
    how: "Work the focus keyword into the first paragraph (ideally the first sentence) of the body.",
    why: "Search engines weight the opening 100 words heavily for topical relevance.",
  },
  "kw-density": {
    how: "Aim for 0.5–2.5% keyword density. Use natural synonyms and variations instead of repeating the exact phrase.",
    why: "Too few mentions = unclear topic. Too many = keyword stuffing penalty.",
  },
  "kw-heading": {
    how: "Include the focus keyword (or a close variant) in at least one H2 or H3 heading.",
    why: "Headings give crawlers a structured signal of what each section is about.",
  },
  "kw-img-alt": {
    how: "Edit one image and add alt text that includes your focus keyword (descriptively, not stuffed).",
    why: "Image alt text is a ranking factor for both web and Google Images traffic.",
  },
  "h-structure": {
    how: "Break content into clear sections with at least 2 H2 headings. Add H3 subheadings where helpful.",
    why: "Structured headings improve scannability, dwell time, and featured-snippet eligibility.",
  },
  "h1-count": {
    how: "Remove extra H1 tags from the body — the post title is already your H1.",
    why: "Multiple H1s confuse crawlers about the main topic of the page.",
  },
  "img-alt": {
    how: "Open the editor, click each image, and add descriptive alt text. Skip purely decorative images.",
    why: "Alt text is required for accessibility and unlocks image search traffic.",
  },
  "internal-links": {
    how: "Add 2+ links to related posts on your site. Use the 'Internal links' tab for AI suggestions.",
    why: "Internal links spread link equity and keep readers engaged across your site.",
  },
  "external-links": {
    how: "Cite at least one authoritative external source (study, docs, official site). Open in a new tab.",
    why: "Outbound links to high-authority sites signal trust and improve E-E-A-T.",
  },
  slug: {
    how: "Use lowercase, hyphen-separated words. Keep under 60 chars and remove stop words (the, a, of).",
    why: "Clean URLs rank better, get clicked more, and look professional when shared.",
  },
  length: {
    how: "Expand the post to 1200+ words. Add examples, screenshots, FAQs, or a comparison section.",
    why: "Longer in-depth content correlates strongly with first-page rankings for competitive queries.",
  },
  readability: {
    how: "Shorten sentences (<20 words), use simpler words, and add subheadings every 250–300 words.",
    why: "Higher readability improves comprehension and reduces bounce rate.",
  },
  featured: {
    how: "Upload a featured image (1200×630 recommended) — it's used for social shares and previews.",
    why: "Posts with featured images get up to 2.3× more engagement on social platforms.",
  },
  "title-power": {
    how: "Add a power word (Best, Ultimate, Proven, Complete, Essential) to make the title more clickable.",
    why: "Power words trigger emotional response, boosting CTR by 12–20% on average.",
  },
  "title-number": {
    how: "Add a number to the title (e.g. '7 Ways…', '10 Best…', 'Top 5…').",
    why: "Listicle-style numbered titles consistently outperform plain titles in CTR studies.",
  },
  "title-freshness": {
    how: `Add the current year to the title to signal up-to-date content.`,
    why: "Year stamps reassure searchers that content isn't outdated — especially in fast-moving niches.",
  },
  paragraphs: {
    how: "Keep paragraphs to 2–3 sentences (≤120 words). Use line breaks generously.",
    why: "Wall-of-text paragraphs kill mobile readability and drive users to bounce.",
  },
  "sentence-length": {
    how: "Shorten sentences over 25 words. Split into two, or replace commas with periods.",
    why: "Long sentences hurt comprehension and Flesch reading-ease scores.",
  },
  "transition-words": {
    how: "Sprinkle transitions like 'however', 'therefore', 'for example', 'as a result' between ideas.",
    why: "Transitions improve flow and signal logical progression to readers and crawlers.",
  },
  "passive-voice": {
    how: "Rewrite passive sentences in active voice: 'The report was written by Sam' → 'Sam wrote the report.'",
    why: "Active voice is shorter, clearer, and stronger — preferred by both readers and Google.",
  },
};

const LEVEL_META: Record<SeoLevel, { color: string; bg: string; icon: typeof AlertCircle; label: string }> = {
  bad: { color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", icon: AlertCircle, label: "Critical" },
  warn: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertTriangle, label: "Improve" },
  good: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2, label: "Passed" },
};

export function SeoChecklistPanel(props: SeoScoreInput) {
  const result = useMemo(() => computeSeoScore(props), [props]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showPassed, setShowPassed] = useState(false);

  const failing = result.checks.filter((c) => c.level === "bad").sort((a, b) => b.weight - a.weight);
  const warnings = result.checks.filter((c) => c.level === "warn").sort((a, b) => b.weight - a.weight);
  const passed = result.checks.filter((c) => c.level === "good");

  // Estimate potential point gain (sum of weights for failing+warn, capped)
  const potentialGain = Math.min(
    100 - result.score,
    Math.round(failing.reduce((s, c) => s + c.weight, 0) + warnings.reduce((s, c) => s + c.weight * 0.5, 0)),
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderGroup = (items: typeof result.checks, level: SeoLevel) => {
    if (!items.length) return null;
    const meta = LEVEL_META[level];
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-1">
          <meta.icon className={cn("h-3.5 w-3.5", meta.color)} />
          <span className={cn("text-[11px] font-semibold uppercase tracking-wider", meta.color)}>
            {meta.label} · {items.length}
          </span>
        </div>
        <div className="space-y-1">
          {items.map((c) => {
            const isOpen = expanded.has(c.id);
            const guide = FIX_GUIDE[c.id];
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg border transition-colors",
                  meta.bg,
                  isOpen && "ring-1 ring-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-background/30 transition-colors rounded-lg"
                >
                  <meta.icon className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", meta.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{c.label}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {level !== "good" && (
                          <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", meta.color, "bg-background/50")}>
                            +{c.weight}
                          </span>
                        )}
                        <ChevronDown
                          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{c.message}</p>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-150">
                    {guide ? (
                      <>
                        <div className="flex items-start gap-1.5">
                          <Lightbulb className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">How to fix</p>
                            <p className="text-[11.5px] text-foreground leading-relaxed">{guide.how}</p>
                          </div>
                        </div>
                        <div className="pl-4.5 pl-[18px]">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1.5">Why it matters</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed italic">{guide.why}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">{c.message}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden mt-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">SEO Checklist</span>
          </div>
          {potentialGain > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              +{potentialGain} pts available
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Click any item to see exactly how to fix it.
        </p>
      </div>

      <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
        {failing.length === 0 && warnings.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">All checks passed!</p>
            <p className="text-[11px] text-muted-foreground">Your post is fully optimized.</p>
          </div>
        ) : (
          <>
            {renderGroup(failing, "bad")}
            {renderGroup(warnings, "warn")}
          </>
        )}

        {passed.length > 0 && (
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowPassed((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors px-1 py-1"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {passed.length} passed checks
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPassed && "rotate-180")} />
            </button>
            {showPassed && <div className="mt-2">{renderGroup(passed, "good")}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
