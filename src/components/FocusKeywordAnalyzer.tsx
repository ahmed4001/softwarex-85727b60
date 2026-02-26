import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface KeywordCheck {
  label: string;
  content: string;
  /** If true, normalize spaces to hyphens before matching (for URL slugs) */
  slugMatch?: boolean;
}

interface FocusKeywordAnalyzerProps {
  keywords: string;
  onKeywordsChange: (keywords: string) => void;
  checks: KeywordCheck[];
  placeholder?: string;
}

export function FocusKeywordAnalyzer({
  keywords,
  onKeywordsChange,
  checks,
  placeholder = "Primary keyword",
}: FocusKeywordAnalyzerProps) {
  const focusKeyword = keywords.split(",")[0]?.trim() || "";

  const handleChange = (value: string) => {
    const rest = keywords.split(",").slice(1).map(k => k.trim()).filter(Boolean);
    onKeywordsChange([value.trim(), ...rest].filter(Boolean).join(", "));
  };

  const results = focusKeyword
    ? checks.map((check) => {
        const kw = focusKeyword.toLowerCase();
        const content = check.content.toLowerCase();
        const passed = check.slugMatch
          ? content.includes(kw.replace(/\s+/g, "-"))
          : content.includes(kw);
        return { label: check.label, passed };
      })
    : null;

  const score = results?.filter((r) => r.passed).length ?? 0;
  const total = checks.length;

  return (
    <div className="space-y-2">
      <Label>Focus Keyword</Label>
      <Input
        value={focusKeyword}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
      />
      {results && (
        <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">
            Keyword Analysis — "{focusKeyword}"
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {results.map((r) => (
              <span
                key={r.label}
                className={r.passed ? "text-emerald-600" : "text-destructive"}
              >
                {r.passed ? "✓" : "✗"} {r.label}
              </span>
            ))}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(score / total) * 100}%`,
                backgroundColor:
                  score >= total - 1
                    ? "hsl(var(--primary))"
                    : score >= total / 2
                      ? "hsl(45, 90%, 50%)"
                      : "hsl(var(--destructive))",
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {score}/{total} checks passed
          </p>
        </div>
      )}
    </div>
  );
}
