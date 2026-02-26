import { useReviewReactions } from "@/hooks/useReviewReactions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export function ReviewReactions({ reviewId }: { reviewId: string }) {
  const { user } = useAuth();
  const { counts, userReactions, toggleReaction, emojis } = useReviewReactions(reviewId);

  return (
    <div className="flex items-center gap-1">
      {emojis.map((emoji) => {
        const count = counts[emoji] || 0;
        const active = userReactions.has(emoji);
        return (
          <button
            key={emoji}
            onClick={() => user && toggleReaction.mutate(emoji)}
            disabled={!user || toggleReaction.isPending}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all border",
              active
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50",
              !user && "opacity-50 cursor-not-allowed"
            )}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
