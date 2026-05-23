import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Plus, AlertTriangle, AlertCircle, CheckCircle2, Ghost, Zap } from "lucide-react";
import { useMemo } from "react";

interface Props {
  currentId?: string;
  slug?: string;
  title: string;
  tags: string[];
  category: string;
  body: string;
  onInsert: (html: string) => void;
}

// Tunable rules
const RULES = {
  minOutbound: 2,            // fewer than this = under-linked
  maxOutbound: 15,           // more than this = spammy
  maxRepeatedTarget: 3,      // same URL more than 3× = spammy
  orphanInboundThreshold: 1, // strictly less than = orphan
};

function countLinks(html: string) {
  const matches = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((m) => m[1]);
  const internal = matches.filter((h) => h.startsWith("/") || h.includes("/blog/"));
  const external = matches.filter((h) => /^https?:\/\//i.test(h) && !h.includes("/blog/"));
  const counts: Record<string, number> = {};
  for (const h of internal) counts[h] = (counts[h] || 0) + 1;
  const repeated = Object.entries(counts).filter(([, n]) => n > RULES.maxRepeatedTarget);
  return { total: matches.length, internal: internal.length, external: external.length, repeated };
}

export function InternalLinksSuggestionPanel({ currentId, slug, title, tags, category, body, onInsert }: Props) {
  const { data: posts = [] } = useQuery({
    queryKey: ["internal-link-candidates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, category, tags, excerpt, body")
        .eq("status", "published")
        .order("view_count", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const linkStats = useMemo(() => countLinks(body || ""), [body]);

  const inboundCount = useMemo(() => {
    if (!slug) return 0;
    const needle = `/blog/${slug}`;
    return posts.filter((p) => p.id !== currentId && (p.body || "").includes(needle)).length;
  }, [posts, slug, currentId]);

  const suggestions = useMemo(() => {
    const titleWords = new Set(title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const bodyLower = (body || "").toLowerCase();
    return posts
      .filter((p) => p.id !== currentId)
      .map((p) => {
        let score = 0;
        const reasons: string[] = [];
        if (p.category && p.category === category) { score += 3; reasons.push("Same category"); }
        if (Array.isArray(p.tags)) {
          const shared = (p.tags as string[]).filter((t) => tags.includes(t));
          if (shared.length) { score += 2 * shared.length; reasons.push(`${shared.length} shared tag${shared.length > 1 ? "s" : ""}`); }
        }
        const ptw = (p.title || "").toLowerCase().split(/\W+/);
        const overlap = ptw.filter((w) => titleWords.has(w)).length;
        if (overlap) { score += overlap; reasons.push(`${overlap} title word overlap`); }
        const alreadyLinked = bodyLower.includes(`/blog/${p.slug}`);
        return { ...p, score, reasons, alreadyLinked };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => Number(a.alreadyLinked) - Number(b.alreadyLinked) || b.score - a.score)
      .slice(0, 10);
  }, [posts, currentId, title, tags, category, body]);

  const alerts: { level: "error" | "warn" | "ok"; icon: any; label: string; detail: string }[] = [];

  if (slug && inboundCount < RULES.orphanInboundThreshold) {
    alerts.push({
      level: "error",
      icon: Ghost,
      label: "Orphan post",
      detail: `No other published post links to /blog/${slug}. Add inbound links from related posts to boost authority.`,
    });
  } else if (slug) {
    alerts.push({
      level: "ok",
      icon: CheckCircle2,
      label: `${inboundCount} inbound link${inboundCount === 1 ? "" : "s"}`,
      detail: "Other posts link here — good signal for SEO.",
    });
  }

  if (linkStats.internal < RULES.minOutbound) {
    alerts.push({
      level: "warn",
      icon: AlertTriangle,
      label: "Under-linked",
      detail: `Only ${linkStats.internal} internal link${linkStats.internal === 1 ? "" : "s"}. Aim for at least ${RULES.minOutbound}.`,
    });
  } else if (linkStats.internal > RULES.maxOutbound) {
    alerts.push({
      level: "error",
      icon: Zap,
      label: "Spammy link count",
      detail: `${linkStats.internal} internal links exceeds the recommended max of ${RULES.maxOutbound}.`,
    });
  } else {
    alerts.push({
      level: "ok",
      icon: CheckCircle2,
      label: `${linkStats.internal} outbound internal links`,
      detail: "Within the healthy range.",
    });
  }

  if (linkStats.repeated.length > 0) {
    alerts.push({
      level: "error",
      icon: AlertCircle,
      label: "Repeated link targets",
      detail: linkStats.repeated.map(([url, n]) => `${url} (${n}×)`).join(", "),
    });
  }

  const tone = (level: string) =>
    level === "error" ? "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300"
    : level === "warn" ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";

  return (
    <div className="space-y-4">
      {/* Health alerts */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Link health</p>
        {alerts.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className={`flex items-start gap-2 p-2 rounded-md border ${tone(a.level)}`}>
              <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{a.label}</p>
                <p className="text-[11px] opacity-80">{a.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggestions */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recommended related posts
        </p>
        {suggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No related posts found yet. Suggestions appear based on category, tags, and title overlap.
          </p>
        ) : (
          suggestions.map((s) => (
            <div key={s.id} className="flex items-start gap-2 p-2 rounded-md border border-border hover:bg-muted/40 transition-colors">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground mt-1 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">/blog/{s.slug}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.reasons.map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{r}</Badge>
                  ))}
                  {s.alreadyLinked && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Linked</Badge>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 flex-shrink-0"
                disabled={s.alreadyLinked}
                title={s.alreadyLinked ? "Already linked" : "Insert link"}
                onClick={() => onInsert(`<p><a href="/blog/${s.slug}">${s.title}</a></p>`)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
