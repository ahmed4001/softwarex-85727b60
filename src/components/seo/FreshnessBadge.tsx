import { Clock, RefreshCw } from "lucide-react";

interface FreshnessBadgeProps {
  /** ISO date string. */
  updatedAt?: string | null;
  /** Plain text body to estimate reading time from (~200 wpm). */
  contentForReadingTime?: string | null;
  className?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * AIO + SXO trust signal: shows "Updated <date> · X min read".
 * AI engines (Perplexity especially) rank fresher sources higher.
 */
export function FreshnessBadge({ updatedAt, contentForReadingTime, className }: FreshnessBadgeProps) {
  if (!updatedAt && !contentForReadingTime) return null;
  const mins = contentForReadingTime ? readingTime(contentForReadingTime) : null;

  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center gap-3 text-xs text-muted-foreground my-3"
      }
    >
      {updatedAt && (
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>
            Updated <time dateTime={updatedAt}>{formatDate(updatedAt)}</time>
          </span>
        </span>
      )}
      {mins !== null && (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {mins} min read
        </span>
      )}
    </div>
  );
}
