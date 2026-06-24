import { ReactNode } from "react";

interface AnswerBlockProps {
  /** Short label like "Quick answer" or "TL;DR". */
  label?: string;
  /** 1–3 sentence direct answer. Plain text wins for AI extraction. */
  children: ReactNode;
  className?: string;
}

/**
 * "Above-the-fold" answer block. AI engines (ChatGPT, Perplexity, Google AI
 * Overviews) heavily favor the first plain-text paragraph after an H1/H2 that
 * looks like a direct answer. Keep content factual, 1–3 sentences.
 */
export function AnswerBlock({ label = "Quick answer", children, className }: AnswerBlockProps) {
  return (
    <aside
      className={
        className ??
        "my-6 rounded-lg border-l-4 border-primary bg-primary/5 p-4 md:p-5"
      }
      role="note"
      aria-label={label}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">
        {label}
      </div>
      <div className="text-base leading-relaxed text-foreground">{children}</div>
    </aside>
  );
}
