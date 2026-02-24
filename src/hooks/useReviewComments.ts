import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profiles?: { name: string | null; avatar_url: string | null } | null;
}

export function useReviewComments(reviewId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["review-comments", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_comments")
        .select("*")
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch profile names for comment authors
      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      let profileMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name, avatar_url")
          .in("user_id", userIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, { name: p.name, avatar_url: p.avatar_url }]));
        }
      }

      return (data || []).map((c) => ({
        ...c,
        profiles: profileMap[c.user_id] || null,
      })) as ReviewComment[];
    },
  });

  const addComment = useMutation({
    mutationFn: async ({ body, parentId }: { body: string; parentId?: string }) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("review_comments").insert({
        review_id: reviewId,
        user_id: user.id,
        parent_id: parentId || null,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-comments", reviewId] });
      toast.success("Comment posted!");
    },
    onError: () => toast.error("Failed to post comment"),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("review_comments").delete().eq("id", commentId).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-comments", reviewId] });
      toast.success("Comment deleted");
    },
    onError: () => toast.error("Failed to delete comment"),
  });

  // Build thread tree
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  return {
    comments,
    topLevel,
    replies,
    isLoading,
    addComment: addComment.mutate,
    deleteComment: deleteComment.mutate,
    isAdding: addComment.isPending,
  };
}
