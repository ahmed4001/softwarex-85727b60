import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  postId: string;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profile?: { name: string | null; avatar_url: string | null; username?: string | null };
}

export function PostComments({ postId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data } = await supabase
        .from("post_comments" as any)
        .select("id, body, created_at, user_id, parent_id")
        .eq("post_id", postId)
        .eq("status", "approved")
        .order("created_at", { ascending: true });
      const rows = (data as any[]) || [];
      if (rows.length === 0) return [];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return rows.map((r) => ({ ...r, profile: profileMap.get(r.user_id) }));
    },
  });

  const submit = async () => {
    if (!user) return toast.error("Sign in to comment");
    if (!body.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("post_comments" as any).insert({
      post_id: postId,
      user_id: user.id,
      body: body.trim(),
      parent_id: replyTo,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setBody("");
    setReplyTo(null);
    qc.invalidateQueries({ queryKey: ["post-comments", postId] });
    toast.success("Comment posted");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("post_comments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["post-comments", postId] });
  };

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <section id="comments" className="mt-16 pt-12 border-t border-border">
      <h2
        className="text-2xl font-bold mb-6 flex items-center gap-2"
        style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
      >
        <MessageCircle className="h-5 w-5" /> {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
      </h2>

      {user ? (
        <div className="mb-8">
          {replyTo && (
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
              Replying to a comment
              <button onClick={() => setReplyTo(null)} className="underline">cancel</button>
            </div>
          )}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts…"
            rows={4}
            className="mb-3"
          />
          <Button onClick={submit} disabled={submitting || !body.trim()}>
            {submitting ? "Posting…" : "Post comment"}
          </Button>
        </div>
      ) : (
        <div className="mb-8 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Link to="/login" className="text-primary underline">Sign in</Link> to join the conversation.
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading comments…</div>
      ) : topLevel.length === 0 ? (
        <div className="text-sm text-muted-foreground">Be the first to comment.</div>
      ) : (
        <ul className="space-y-6">
          {topLevel.map((c) => (
            <li key={c.id}>
              <CommentRow c={c} onReply={() => setReplyTo(c.id)} onDelete={() => remove(c.id)} currentUserId={user?.id} />
              {repliesOf(c.id).length > 0 && (
                <ul className="mt-4 ml-10 space-y-4 border-l border-border pl-5">
                  {repliesOf(c.id).map((r) => (
                    <li key={r.id}>
                      <CommentRow c={r} onDelete={() => remove(r.id)} currentUserId={user?.id} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentRow({
  c,
  onReply,
  onDelete,
  currentUserId,
}: {
  c: Comment;
  onReply?: () => void;
  onDelete: () => void;
  currentUserId?: string;
}) {
  const name = c.profile?.name || "Anonymous";
  const initial = name[0]?.toUpperCase() || "?";
  return (
    <div className="flex gap-3">
      <Link to={`/author/${c.profile?.username || c.user_id}`} className="flex-shrink-0">
        {c.profile?.avatar_url ? (
          <img src={c.profile.avatar_url} alt={name} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
            {initial}
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1 text-sm">
          <Link to={`/author/${c.profile?.username || c.user_id}`} className="font-semibold text-foreground hover:text-primary">{name}</Link>
          <time className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</time>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.body}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {onReply && <button onClick={onReply} className="hover:text-foreground">Reply</button>}
          {currentUserId === c.user_id && (
            <button onClick={onDelete} className="hover:text-destructive flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
