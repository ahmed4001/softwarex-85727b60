import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

// Heuristic: a row is junk if it has no website + no description + low info_score
// AND its name looks like a feature/keyword (lowercase phrase, generic word,
// or non-brand-cased common English).
const GENERIC_WORDS = new Set([
  "pros", "cons", "first", "affordable", "real", "must", "key", "support",
  "sales", "integration", "scalable", "hospitality", "conclusion", "gdpr",
  "summary", "overview", "features", "pricing", "free", "freemium",
  "enterprise", "starter", "basic", "premium", "advanced", "standard",
  "cloud-based", "on-premise", "self-hosted", "open-source",
]);

function isLikelyJunk(p: any): { junk: boolean; reason: string } {
  const name = String(p.name || "").trim();
  const lower = name.toLowerCase();
  if (!name) return { junk: true, reason: "empty name" };
  if (GENERIC_WORDS.has(lower)) return { junk: true, reason: "generic word" };
  // starts lowercase (feature phrase) or contains hyphenated lowercase like "ai-driven"
  if (/^[a-z]/.test(name)) return { junk: true, reason: "lowercase phrase" };
  // multi-word descriptive phrase with no proper-noun feel
  if (
    /\s/.test(name) &&
    !/[A-Z][a-z]+[A-Z]|^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name) &&
    /(tracking|reporting|analytics|scanning|collaboration|compliance|calculation|invoices|management|automation|integration|support|customizable)/i.test(name)
  ) {
    return { junk: true, reason: "feature phrase" };
  }
  return { junk: false, reason: "" };
}

export default function AdminProductCleanupPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("products")
      .select("id, name, slug, info_score, website_url, description, tagline, logo_url")
      .or("website_url.is.null,website_url.eq.")
      .lte("info_score", 3)
      .limit(500);
    const flagged = (data || [])
      .map((p: any) => {
        const v = isLikelyJunk(p);
        const hasContent = (p.description && p.description.length > 50) || p.logo_url;
        return { ...p, ...v, junk: v.junk && !hasContent };
      })
      .filter((p: any) => p.junk);
    setRows(flagged);
    setSelected(new Set(flagged.map((r: any) => r.id)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  async function purge() {
    if (!selected.size) return;
    if (!confirm(`Permanently delete ${selected.size} products? This cannot be undone.`)) return;
    setDeleting(true);
    const ids = Array.from(selected);
    // Chunk to stay under URL length limits
    const chunkSize = 100;
    let failed = 0;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error } = await (supabase as any).from("products").delete().in("id", chunk);
      if (error) { failed += chunk.length; console.error(error); }
    }
    setDeleting(false);
    if (failed) toast.error(`Failed to delete ${failed} rows`);
    else toast.success(`Deleted ${ids.length} junk products`);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Product Cleanup</h1>
          <p className="text-muted-foreground text-sm">
            Identifies scraped feature names misclassified as products. Review before purging.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={purge}
          disabled={!selected.size || deleting}
          className="gap-2"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Purge {selected.size}
        </Button>
      </div>

      <Card className="p-4 flex items-center gap-3 bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <p className="text-sm">
          Flagged: rows with no real website, low info_score (≤3), no description/logo,
          AND a name that looks like a feature ("Time tracking", "GDPR", "Pros", etc.).
        </p>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No junk products detected 🎉</Card>
      ) : (
        <Card className="divide-y">
          <div className="p-3 flex items-center gap-3 bg-muted/30 text-xs font-medium">
            <Checkbox
              checked={selected.size === rows.length}
              onCheckedChange={(c) =>
                setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())
              }
            />
            <span className="flex-1">Name</span>
            <span className="w-32">Reason</span>
            <span className="w-16 text-right">Score</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="p-3 flex items-center gap-3 hover:bg-muted/20">
              <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">{r.slug}</p>
              </div>
              <Badge variant="outline" className="w-32 justify-center text-xs">{r.reason}</Badge>
              <span className="w-16 text-right text-sm text-muted-foreground">{r.info_score}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
