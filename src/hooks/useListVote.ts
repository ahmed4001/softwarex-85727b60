import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useListVote(listId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: hasVoted = false } = useQuery({
    queryKey: ["list-vote", listId, user?.id],
    enabled: !!user && !!listId,
    queryFn: async () => {
      const { data } = await supabase
        .from("list_votes")
        .select("id")
        .eq("list_id", listId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleVote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      if (hasVoted) {
        await supabase
          .from("list_votes")
          .delete()
          .eq("list_id", listId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("list_votes")
          .insert({ list_id: listId, user_id: user.id });
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["list-vote", listId, user?.id] });
      const prev = queryClient.getQueryData(["list-vote", listId, user?.id]);
      queryClient.setQueryData(["list-vote", listId, user?.id], !hasVoted);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(["list-vote", listId, user?.id], context?.prev);
      toast.error("Failed to update vote");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["list-vote", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list-detail"] });
    },
  });

  return { hasVoted, toggleVote: toggleVote.mutate, isToggling: toggleVote.isPending };
}
