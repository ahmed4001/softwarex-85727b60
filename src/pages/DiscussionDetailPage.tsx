import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowLeft, Pin, Lock, CheckCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { isUuid } from "@/lib/identifier";

export default function DiscussionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState("");

  const { data: discussion, isLoading } = useQuery({
    queryKey: ["discussion", id],
    queryFn: async () => {
      // Look up by slug first; UUID fallback preserves legacy /discussions/<uuid> links.
      const column = isUuid(id) ? "id" : "slug";
      const { data } = await supabase.from("discussions").select("*").eq(column, id!).maybeSingle();
      if (!data) return null;
      const { data: profile } = await supabase.from("profiles").select("user_id, username, name, avatar_url").eq("user_id", data.user_id).single();
      return { ...data, profile };
    },
    enabled: !!id,
  });

  // Canonical redirect from UUID → slug for SEO.
  useEffect(() => {
    if (discussion && isUuid(id) && (discussion as any).slug) {
      navigate(`/discussions/${(discussion as any).slug}`, { replace: true });
    }
  }, [discussion, id, navigate]);

  const discussionId = (discussion as any)?.id as string | undefined;

  const { data: replies = [] } = useQuery({
    queryKey: ["discussion-replies", discussionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussion_replies")
        .select("*")
        .eq("discussion_id", discussionId!)
        .order("created_at", { ascending: true });
      if (!data?.length) return [];
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", userIds);
      const pMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return data.map((r: any) => ({ ...r, profile: pMap.get(r.user_id) }));
    },
    enabled: !!discussionId,
  });


  const { data: myVotes = [] } = useQuery({
    queryKey: ["discussion-my-votes", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("discussion_votes").select("*").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ discussionId, replyId }: { discussionId?: string; replyId?: string }) => {
      const existing = myVotes.find((v: any) =>
        (discussionId && v.discussion_id === discussionId) || (replyId && v.reply_id === replyId)
      );
      if (existing) {
        await supabase.from("discussion_votes").delete().eq("id", existing.id);
      } else {
        await supabase.from("discussion_votes").insert({
          user_id: user!.id,
          discussion_id: discussionId || null,
          reply_id: replyId || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussion", id] });
      queryClient.invalidateQueries({ queryKey: ["discussion-replies", id] });
      queryClient.invalidateQueries({ queryKey: ["discussion-my-votes"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("discussion_replies").insert({
        discussion_id: discussionId!,
        user_id: user!.id,
        body: replyBody,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reply posted!");
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["discussion-replies", discussionId] });
      queryClient.invalidateQueries({ queryKey: ["discussion", id] });
    },
    onError: (err: any) => toast.error(err.message),
  });


  if (isLoading) return <div className="container py-20 text-center text-muted-foreground">Loading...</div>;
  if (!discussion) return <div className="container py-20 text-center text-muted-foreground">Discussion not found.</div>;

  const hasVotedDiscussion = myVotes.some((v: any) => v.discussion_id === discussion.id);

  return (
    <>
      <SeoHead
        title={discussion.title}
        description={
          (discussion as any).body
            ? String((discussion as any).body).replace(/\s+/g, " ").trim().slice(0, 155)
            : `Join the discussion: ${discussion.title}. Read community insights, replies, and expert takes on ReviewHunts.`
        }
        type="article"
      />
      <div className="container py-8 max-w-3xl">
        <Link to="/discussions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Discussions
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant={hasVotedDiscussion ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => user && voteMutation.mutate({ discussionId: discussion.id })}
                    disabled={!user}
                    aria-label={`Upvote discussion (${discussion.upvote_count})`}
                    aria-pressed={hasVotedDiscussion}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-bold text-foreground">{discussion.upvote_count}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {discussion.is_pinned && <Badge variant="outline" className="gap-1 text-xs"><Pin className="h-3 w-3" />Pinned</Badge>}
                    {discussion.is_locked && <Badge variant="outline" className="gap-1 text-xs"><Lock className="h-3 w-3" />Locked</Badge>}
                  </div>
                  <h1 className="text-2xl font-display font-bold text-foreground mb-3">{discussion.title}</h1>
                  <p className="text-muted-foreground whitespace-pre-line">{discussion.body}</p>
                  <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{discussion.profile?.name || "Anonymous"}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <h2 className="text-lg font-display font-bold text-foreground mb-4">{replies.length} Replies</h2>

        <div className="space-y-3 mb-8">
          {replies.map((r: any) => {
            const hasVoted = myVotes.some((v: any) => v.reply_id === r.id);
            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <Button
                        variant={hasVoted ? "default" : "ghost"}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => user && voteMutation.mutate({ replyId: r.id })}
                        disabled={!user}
                        aria-label={`Upvote reply (${r.upvote_count})`}
                        aria-pressed={hasVoted}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs font-bold">{r.upvote_count}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{r.profile?.name || "Anonymous"}</span>
                        {r.is_vendor_answer && <Badge className="bg-primary/10 text-primary border-0 text-[10px] gap-0.5"><CheckCircle className="h-2.5 w-2.5" />Vendor</Badge>}
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{r.body}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {user && !discussion.is_locked ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                className="rounded-xl min-h-[80px]"
              />
              <div className="flex justify-end">
                <Button onClick={() => replyMutation.mutate()} disabled={!replyBody.trim() || replyMutation.isPending} className="rounded-xl gap-1.5">
                  <MessageCircle className="h-4 w-4" /> Post Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !user ? (
          <p className="text-center text-muted-foreground text-sm">
            <Link to="/login" className="text-primary hover:underline">Sign in</Link> to reply
          </p>
        ) : (
          <p className="text-center text-muted-foreground text-sm">This discussion is locked.</p>
        )}
      </div>
    </>
  );
}
