import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const EMOJIS = ["👍", "🔥", "💡", "🤔"] as const;

export function useReviewReactions(reviewId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reactions = [] } = useQuery({
    queryKey: ["review-reactions", reviewId],
    queryFn: async () => {
      const { data } = await supabase
        .from("review_reactions")
        .select("emoji, user_id")
        .eq("review_id", reviewId);
      return data || [];
    },
  });

  const counts = EMOJIS.reduce((acc, emoji) => {
    acc[emoji] = reactions.filter((r: any) => r.emoji === emoji).length;
    return acc;
  }, {} as Record<string, number>);

  const userReactions = new Set(
    reactions.filter((r: any) => r.user_id === user?.id).map((r: any) => r.emoji)
  );

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      if (!user) throw new Error("Must be logged in");
      if (userReactions.has(emoji)) {
        await supabase
          .from("review_reactions")
          .delete()
          .eq("review_id", reviewId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
      } else {
        await supabase
          .from("review_reactions")
          .insert({ review_id: reviewId, user_id: user.id, emoji });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-reactions", reviewId] });
    },
  });

  return { counts, userReactions, toggleReaction, emojis: EMOJIS };
}
