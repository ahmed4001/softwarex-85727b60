import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ValidationLevel = "good" | "warn" | "bad";

export interface ValidationMessage {
  level: ValidationLevel;
  text: string;
}

const ICON = {
  good: CheckCircle2,
  warn: Info,
  bad: AlertCircle,
};

const COLOR = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-rose-600 dark:text-rose-400",
};

export function InlineFieldValidation({
  messages,
  current,
  recommended,
  max,
}: {
  messages: ValidationMessage[];
  current?: number;
  recommended?: [number, number];
  max?: number;
}) {
  if (!messages.length && current === undefined) return null;
  const pct = max && current !== undefined ? Math.min(100, (current / max) * 100) : null;
  const inRange = recommended && current !== undefined && current >= recommended[0] && current <= recommended[1];

  return (
    <div className="space-y-1 mt-1">
      {pct !== null && (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-200 rounded-full",
                inRange ? "bg-emerald-500" : current! > max! ? "bg-rose-500" : "bg-amber-500",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "text-[10px] font-mono tabular-nums",
              current! > max! ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
            )}
          >
            {current}
            {max ? `/${max}` : ""}
          </span>
        </div>
      )}
      {messages.map((m, i) => {
        const Icon = ICON[m.level];
        return (
          <div key={i} className={cn("flex items-start gap-1.5 text-[11px] leading-snug", COLOR[m.level])}>
            <Icon className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{m.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// Validators
export function validateSlug(slug: string): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];
  if (!slug) {
    msgs.push({ level: "bad", text: "Slug is required" });
    return msgs;
  }
  if (slug.length < 3) msgs.push({ level: "bad", text: "Slug too short (min 3 chars)" });
  if (slug.length > 75) msgs.push({ level: "bad", text: `Slug too long (${slug.length}/75)` });
  else if (slug.length > 60) msgs.push({ level: "warn", text: `Slug getting long (${slug.length}/75) — aim for ≤60` });
  if (slug.includes("_")) msgs.push({ level: "bad", text: "Use hyphens (-), not underscores (_)" });
  if (/[^a-z0-9-]/.test(slug)) msgs.push({ level: "bad", text: "Only lowercase letters, numbers, and hyphens" });
  if (/^-|-$/.test(slug)) msgs.push({ level: "warn", text: "Slug shouldn't start or end with a hyphen" });
  if (/--/.test(slug)) msgs.push({ level: "warn", text: "Avoid consecutive hyphens" });
  const STOP = new Set(["a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for", "with", "by", "is"]);
  const stops = slug.split("-").filter((p) => STOP.has(p));
  if (stops.length > 1) msgs.push({ level: "warn", text: `Remove stop words: ${stops.join(", ")}` });
  if (msgs.length === 0) msgs.push({ level: "good", text: "Looks good — SEO-friendly URL" });
  return msgs;
}

export function validateSeoTitle(title: string, focusKw = ""): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];
  const len = title.length;
  if (!title) return [{ level: "bad", text: "SEO title is required" }];
  if (len < 30) msgs.push({ level: "warn", text: `Too short (${len}/60) — aim for 50–60 chars` });
  else if (len > 60) msgs.push({ level: "bad", text: `Too long (${len}/60) — may be truncated in search` });
  if (focusKw && !title.toLowerCase().includes(focusKw.toLowerCase().split(",")[0].trim())) {
    msgs.push({ level: "warn", text: "Focus keyword missing from title" });
  }
  if (title === title.toUpperCase() && len > 5) msgs.push({ level: "warn", text: "Avoid ALL CAPS titles" });
  if (msgs.length === 0) msgs.push({ level: "good", text: "Title length is optimal" });
  return msgs;
}

export function validateMetaDescription(desc: string, focusKw = ""): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];
  const len = desc.length;
  if (!desc) return [{ level: "bad", text: "Meta description is required" }];
  if (len < 120) msgs.push({ level: "warn", text: `Too short (${len}/160) — aim for 140–160 chars` });
  else if (len > 160) msgs.push({ level: "bad", text: `Too long (${len}/160) — will be truncated` });
  if (focusKw && !desc.toLowerCase().includes(focusKw.toLowerCase().split(",")[0].trim())) {
    msgs.push({ level: "warn", text: "Focus keyword missing from description" });
  }
  if (msgs.length === 0) msgs.push({ level: "good", text: "Description length is optimal" });
  return msgs;
}
