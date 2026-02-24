import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useReviewVotes(reviewId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: votes = { up: 0, down: 0, userVote: null as string | null } } = useQuery({
    queryKey: ["review-votes", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_votes")
        .select("user_id, vote_type")
        .eq("review_id", reviewId);
      if (error) throw error;
      const up = data.filter((v) => v.vote_type === "up").length;
      const down = data.filter((v) => v.vote_type === "down").length;
      const userVote = user ? data.find((v) => v.user_id === user.id)?.vote_type ?? null : null;
      return { up, down, userVote };
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (voteType: "up" | "down") => {
      if (!user) throw new Error("Must be logged in");

      if (votes.userVote === voteType) {
        // Remove vote
        await supabase.from("review_votes").delete().eq("review_id", reviewId).eq("user_id", user.id);
      } else if (votes.userVote) {
        // Change vote
        await supabase.from("review_votes").update({ vote_type: voteType }).eq("review_id", reviewId).eq("user_id", user.id);
      } else {
        // New vote
        await supabase.from("review_votes").insert({ review_id: reviewId, user_id: user.id, vote_type: voteType });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["review-votes", reviewId] }),
    onError: () => toast.error("Failed to vote"),
  });

  return { ...votes, vote: voteMutation.mutate, isVoting: voteMutation.isPending };
}
