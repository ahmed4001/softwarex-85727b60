import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useProductQA(productId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["product-qa", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("review_qa")
        .select("*")
        .eq("product_id", productId!)
        .is("parent_id", null)
        .eq("status", "active")
        .order("upvote_count", { ascending: false });
      
      if (!data || data.length === 0) return [];
      
      // Fetch profiles for user_ids
      const userIds = [...new Set(data.map((q) => q.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      
      return data.map((q) => ({ ...q, profiles: profileMap.get(q.user_id) || null })) as any[];
      return (data || []) as any[];
    },
    enabled: !!productId,
  });

  const questionIds = questions.map((q: any) => q.id);
  const { data: allAnswers = [] } = useQuery({
    queryKey: ["product-qa-answers", questionIds],
    queryFn: async () => {
      // Order by upvote_count desc so the first answer rendered under each
      // question matches the `acceptedAnswer` emitted in QAPage JSON-LD
      // (both here and in scripts/generate-product-md.ts).
      const { data } = await supabase
        .from("review_qa")
        .select("*")
        .in("parent_id", questionIds)
        .eq("status", "active")
        .order("upvote_count", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      return data.map((a) => ({ ...a, profiles: profileMap.get(a.user_id) || null })) as any[];
    },
    enabled: questionIds.length > 0,
  });

  const answers = (questionId: string) =>
    allAnswers.filter((a: any) => a.parent_id === questionId);

  // User votes
  const { data: userVotes = [] } = useQuery({
    queryKey: ["qa-user-votes", user?.id, productId],
    queryFn: async () => {
      const allIds = [...questionIds, ...allAnswers.map((a: any) => a.id)];
      if (!allIds.length) return [];
      const { data } = await supabase
        .from("review_qa_votes")
        .select("qa_id")
        .eq("user_id", user!.id)
        .in("qa_id", allIds);
      return (data || []).map((v: any) => v.qa_id);
    },
    enabled: !!user && (questionIds.length > 0 || allAnswers.length > 0),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["product-qa", productId] });
    queryClient.invalidateQueries({ queryKey: ["product-qa-answers"] });
    queryClient.invalidateQueries({ queryKey: ["qa-user-votes"] });
  };

  const askQuestion = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("review_qa").insert({
        product_id: productId!,
        user_id: user!.id,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Question posted!"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const postAnswer = useMutation({
    mutationFn: async ({ questionId, body, isVendor }: { questionId: string; body: string; isVendor?: boolean }) => {
      const { error } = await supabase.from("review_qa").insert({
        product_id: productId!,
        user_id: user!.id,
        parent_id: questionId,
        body: body.trim(),
        is_vendor_answer: isVendor || false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Answer posted!"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleVote = useMutation({
    mutationFn: async (qaId: string) => {
      const hasVoted = userVotes.includes(qaId);
      if (hasVoted) {
        await supabase.from("review_qa_votes").delete().eq("qa_id", qaId).eq("user_id", user!.id);
      } else {
        await supabase.from("review_qa_votes").insert({ qa_id: qaId, user_id: user!.id });
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteQA = useMutation({
    mutationFn: async (qaId: string) => {
      const { error } = await supabase.from("review_qa").delete().eq("id", qaId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    questions,
    answers,
    userVotes,
    isLoading,
    askQuestion,
    postAnswer,
    toggleVote,
    deleteQA,
  };
}
