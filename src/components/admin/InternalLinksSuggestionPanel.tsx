import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon, Plus } from "lucide-react";
import { useMemo } from "react";

interface Props {
  currentId?: string;
  title: string;
  tags: string[];
  category: string;
  body: string;
  onInsert: (html: string) => void;
}

export function InternalLinksSuggestionPanel({ currentId, title, tags, category, body, onInsert }: Props) {
  const { data: posts = [] } = useQuery({
    queryKey: ["internal-link-candidates", category],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, category, tags, excerpt")
        .eq("status", "published")
        .order("view_count", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const suggestions = useMemo(() => {
    const titleWords = new Set(title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const bodyLower = body.toLowerCase();
    return posts
      .filter((p) => p.id !== currentId)
      .map((p) => {
        let score = 0;
        if (p.category && p.category === category) score += 3;
        if (Array.isArray(p.tags)) {
          for (const t of p.tags as string[]) if (tags.includes(t)) score += 2;
        }
        const ptw = (p.title || "").toLowerCase().split(/\W+/);
        for (const w of ptw) if (titleWords.has(w)) score += 1;
        // already linked?
        const alreadyLinked = bodyLower.includes(`/blog/${p.slug}`);
        return { ...p, score, alreadyLinked };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [posts, currentId, title, tags, category, body]);

  if (suggestions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No related posts found yet. Suggestions appear based on category, tags, and title overlap.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Boost SEO by linking to related posts. Click + to insert a contextual link.
      </p>
      {suggestions.map((s) => (
        <div key={s.id} className="flex items-start gap-2 p-2 rounded-md border border-border hover:bg-muted/40 transition-colors">
          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground mt-1 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
            <p className="text-[11px] text-muted-foreground font-mono truncate">/blog/{s.slug}</p>
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
      ))}
    </div>
  );
}
