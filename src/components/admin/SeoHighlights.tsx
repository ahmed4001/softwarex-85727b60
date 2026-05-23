import { useMemo } from "react";
import { Highlighter, AlertCircle, CheckCircle2, Hash, Link2, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  slug: string;
  body: string; // HTML
  focusKeyword?: string;
}

type Issue = { kind: "missing-kw" | "too-long" | "too-short" | "stopword" | "special" | "underscore" | "uppercase" | "stuffing"; note: string };

type Section = {
  id: string;
  icon: typeof Hash;
  label: string;
  text: string;
  issues: Issue[];
  highlightTargets: string[]; // tokens to wrap with <mark>
  empty?: boolean;
};

const STOP_WORDS = new Set(["a","an","the","and","or","but","of","in","on","at","to","for","with","by","is","are","was","were","be","been","being","this","that","these","those","it","its","as","from"]);

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0;
  const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return (haystack.match(re) || []).length;
}

function highlightHtml(text: string, targets: string[]) {
  if (!text) return "";
  let escaped = text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  const unique = Array.from(new Set(targets.filter(Boolean))).sort((a, b) => b.length - a.length);
  for (const t of unique) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    escaped = escaped.replace(re, `<mark class="bg-rose-500/20 text-rose-700 dark:text-rose-300 rounded px-0.5">$1</mark>`);
  }
  return escaped;
}

function analyzeHeading(text: string, kw: string, type: "H1" | "H2"): Issue[] {
  const issues: Issue[] = [];
  const lower = text.toLowerCase();
  const kwLower = kw.toLowerCase();
  if (kw && !lower.includes(kwLower)) issues.push({ kind: "missing-kw", note: `${type} doesn't contain focus keyword "${kw}"` });
  if (type === "H1" && text.length > 70) issues.push({ kind: "too-long", note: `H1 is ${text.length} chars (recommended ≤70)` });
  if (type === "H2" && text.length > 80) issues.push({ kind: "too-long", note: `H2 is ${text.length} chars (recommended ≤80)` });
  if (text.length > 0 && text.length < 20 && type === "H1") issues.push({ kind: "too-short", note: `H1 is only ${text.length} chars (recommended ≥20)` });
  if (text === text.toUpperCase() && text.length > 4) issues.push({ kind: "uppercase", note: "Heading is all uppercase" });
  // keyword stuffing
  if (kw) {
    const occ = countOccurrences(text, kw);
    if (occ > 1) issues.push({ kind: "stuffing", note: `Focus keyword appears ${occ}× in heading (max 1)` });
  }
  return issues;
}

function analyzeSlug(slug: string, kw: string): { issues: Issue[]; targets: string[] } {
  const issues: Issue[] = [];
  const targets: string[] = [];
  if (!slug) return { issues, targets };
  if (slug.length > 75) issues.push({ kind: "too-long", note: `Slug is ${slug.length} chars (recommended ≤75)` });
  if (slug.includes("_")) { issues.push({ kind: "underscore", note: "Use hyphens (-) instead of underscores (_)" }); targets.push("_"); }
  const special = slug.match(/[^a-z0-9-]/g);
  if (special) { issues.push({ kind: "special", note: `Contains special chars: ${[...new Set(special)].join(" ")}` }); targets.push(...special); }
  const slugStops = slug.split("-").filter((p) => STOP_WORDS.has(p));
  if (slugStops.length > 1) { issues.push({ kind: "stopword", note: `Contains stop words: ${slugStops.join(", ")}` }); targets.push(...slugStops); }
  if (kw) {
    const kwSlug = kw.toLowerCase().replace(/\s+/g, "-");
    if (!slug.includes(kwSlug)) issues.push({ kind: "missing-kw", note: `Slug missing focus keyword "${kwSlug}"` });
  }
  return { issues, targets };
}

function analyzeProse(text: string, kw: string, role: "intro" | "conclusion"): { issues: Issue[]; targets: string[] } {
  const issues: Issue[] = [];
  const targets: string[] = [];
  if (!text) return { issues, targets };
  if (kw && !text.toLowerCase().includes(kw.toLowerCase())) {
    issues.push({ kind: "missing-kw", note: `${role === "intro" ? "Intro" : "Conclusion"} doesn't contain focus keyword "${kw}" (should appear in first 100 words)` });
  }
  if (role === "intro" && text.split(/\s+/).length < 30) {
    issues.push({ kind: "too-short", note: `Intro is ${text.split(/\s+/).length} words (recommended ≥30)` });
  }
  // Keyword stuffing in prose
  if (kw) {
    const occ = countOccurrences(text, kw);
    const words = text.split(/\s+/).length || 1;
    const density = (occ / words) * 100;
    if (density > 3) {
      issues.push({ kind: "stuffing", note: `Keyword density ${density.toFixed(1)}% (max 3%)` });
      targets.push(kw);
    }
  }
  return { issues, targets };
}

export function SeoHighlights({ title, slug, body, focusKeyword = "" }: Props) {
  const sections = useMemo<Section[]>(() => {
    const kw = focusKeyword.trim();
    const result: Section[] = [];

    // ---- H1 (use post title as the H1) ----
    const h1Issues = analyzeHeading(title, kw, "H1");
    const h1Targets: string[] = [];
    if (kw && !title.toLowerCase().includes(kw.toLowerCase())) h1Targets.push(...title.split(/\s+/).slice(0, 3));
    h1Issues.filter((i) => i.kind === "uppercase").forEach(() => h1Targets.push(title));
    if (kw && countOccurrences(title, kw) > 1) h1Targets.push(kw);
    result.push({ id: "h1", icon: Type, label: "H1 (Page title)", text: title || "(empty)", issues: h1Issues, highlightTargets: h1Targets, empty: !title });

    // ---- H2s from body ----
    const h2Matches = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
    h2Matches.forEach((m, idx) => {
      const text = stripHtml(m[1]);
      const issues = analyzeHeading(text, kw, "H2");
      const targets: string[] = [];
      if (kw && !text.toLowerCase().includes(kw.toLowerCase())) targets.push(...text.split(/\s+/).slice(0, 2));
      if (kw && countOccurrences(text, kw) > 1) targets.push(kw);
      result.push({ id: `h2-${idx}`, icon: Hash, label: `H2 #${idx + 1}`, text, issues, highlightTargets: targets });
    });

    if (h2Matches.length === 0) {
      result.push({ id: "h2-empty", icon: Hash, label: "H2 headings", text: "(no H2 headings found)", issues: [{ kind: "missing-kw", note: "Add at least 2 H2 headings to improve structure" }], highlightTargets: [], empty: true });
    }

    // ---- Slug ----
    const slugCheck = analyzeSlug(slug, kw);
    result.push({ id: "slug", icon: Link2, label: "URL slug", text: slug || "(empty)", issues: slugCheck.issues, highlightTargets: slugCheck.targets, empty: !slug });

    // ---- Intro (first <p>) ----
    const pMatches = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripHtml(m[1])).filter(Boolean);
    if (pMatches.length > 0) {
      const intro = pMatches[0];
      const introCheck = analyzeProse(intro, kw, "intro");
      const introTargets = introCheck.targets.slice();
      if (kw && !intro.toLowerCase().includes(kw.toLowerCase())) introTargets.push(...intro.split(/\s+/).slice(0, 3));
      result.push({ id: "intro", icon: Type, label: "Intro paragraph", text: intro, issues: introCheck.issues, highlightTargets: introTargets });

      if (pMatches.length > 1) {
        const conclusion = pMatches[pMatches.length - 1];
        const conCheck = analyzeProse(conclusion, kw, "conclusion");
        const conTargets = conCheck.targets.slice();
        if (kw && !conclusion.toLowerCase().includes(kw.toLowerCase())) conTargets.push(...conclusion.split(/\s+/).slice(0, 3));
        result.push({ id: "conclusion", icon: Type, label: "Conclusion paragraph", text: conclusion, issues: conCheck.issues, highlightTargets: conTargets });
      }
    } else {
      result.push({ id: "intro-empty", icon: Type, label: "Intro paragraph", text: "(no paragraphs found)", issues: [{ kind: "too-short", note: "Add an intro paragraph (≥30 words) including the focus keyword" }], highlightTargets: [], empty: true });
    }

    return result;
  }, [title, slug, body, focusKeyword]);

  const totalIssues = sections.reduce((sum, s) => sum + s.issues.length, 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-br from-amber-500/5 to-transparent">
        <div className="flex items-center gap-2">
          <Highlighter className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-sm font-semibold text-foreground">SEO Highlights</span>
        </div>
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
          totalIssues === 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
        )}>
          {totalIssues === 0 ? "All clear" : `${totalIssues} issue${totalIssues === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="max-h-[480px] overflow-y-auto divide-y divide-border">
        {sections.map((s) => {
          const Icon = s.icon;
          const hasIssues = s.issues.length > 0;
          return (
            <div key={s.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={cn("h-3 w-3", hasIssues ? "text-rose-500" : "text-emerald-500")} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                {hasIssues ? (
                  <AlertCircle className="h-3 w-3 text-rose-500" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                )}
              </div>
              <p
                className={cn(
                  "text-[12.5px] leading-snug font-mono px-2 py-1.5 rounded bg-muted/40 break-words",
                  s.empty && "italic text-muted-foreground font-sans",
                )}
                dangerouslySetInnerHTML={{
                  __html: s.empty ? s.text : highlightHtml(s.text, s.highlightTargets),
                }}
              />
              {hasIssues && (
                <ul className="mt-1.5 space-y-0.5">
                  {s.issues.map((i, idx) => (
                    <li key={idx} className="text-[11px] text-rose-600 dark:text-rose-400 leading-snug flex items-start gap-1">
                      <span className="mt-1 h-1 w-1 rounded-full bg-rose-500 flex-shrink-0" />
                      {i.note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
