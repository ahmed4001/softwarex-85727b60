import { useState } from "react";
import { ReviewReactions } from "@/components/ReviewReactions";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "./StarRating";
import { ThumbsUp, ThumbsDown, CheckCircle, MessageCircle, Send, Trash2, ChevronDown, ChevronUp, Store, ShieldCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { useReviewVotes } from "@/hooks/useReviewVotes";
import { useReviewComments } from "@/hooks/useReviewComments";
import { useUserBadges } from "@/hooks/useBadges";
import { BadgeRow } from "@/components/BadgeDisplay";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ReviewCardProps {
  id: string;
  title?: string;
  body?: string;
  pros?: string;
  cons?: string;
  overall_rating: number;
  ease_of_use?: number | null;
  customer_support?: number | null;
  value_for_money?: number | null;
  features_rating?: number | null;
  reviewer_name?: string;
  reviewer_user_id?: string;
  reviewer_username?: string;
  reviewer_role?: string;

  company_size?: string;
  verified_reviewer?: boolean;
  verified_purchase?: boolean;
  created_at: string;
  media?: { url: string; file_type?: string }[];
  pros_tags?: string[];
  cons_tags?: string[];
}

export function ReviewCard({ id, title, body, pros, cons, overall_rating, ease_of_use, customer_support, value_for_money, features_rating, reviewer_name, reviewer_user_id, reviewer_username, reviewer_role, company_size, verified_reviewer, verified_purchase, created_at, media, pros_tags, cons_tags }: ReviewCardProps) {
  const { user } = useAuth();
  const { up, down, userVote, vote, isVoting } = useReviewVotes(id);
  const { data: reviewerBadges = [] } = useUserBadges(reviewer_user_id);
  const { topLevel, replies, addComment, deleteComment, isAdding } = useReviewComments(id);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Reviewer verification status
  const { data: reviewerProfile } = useQuery({
    queryKey: ["reviewer-verification", reviewer_user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("verification_type, verified_domain")
        .eq("user_id", reviewer_user_id!)
        .maybeSingle();
      return data;
    },
    enabled: !!reviewer_user_id,
  });

  // Vendor response
  const { data: vendorResponse } = useQuery({
    queryKey: ["vendor-response", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_responses")
        .select("*, profiles!vendor_responses_user_id_fkey(name)")
        .eq("review_id", id)
        .maybeSingle();
      return data;
    },
  });

  const handleComment = () => {
    if (!commentText.trim()) return;
    addComment({ body: commentText.trim() });
    setCommentText("");
  };

  const handleReply = (parentId: string) => {
    if (!replyText.trim()) return;
    addComment({ body: replyText.trim(), parentId });
    setReplyText("");
    setReplyTo(null);
  };

  const totalComments = topLevel.length + topLevel.reduce((acc, c) => acc + replies(c.id).length, 0);

  return (
    <div className="glass-card p-7">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <StarRating rating={overall_rating} size="sm" />
            <span className="text-sm font-display font-bold">{overall_rating}.0</span>
          </div>
          {title && <h4 className="font-display font-bold text-lg text-foreground">{title}</h4>}
        </div>
        {verified_reviewer && (
          <div className="flex items-center gap-1.5 text-[hsl(var(--success))] text-xs font-semibold bg-[hsl(var(--success)/0.08)] px-3 py-1.5 rounded-full">
            <CheckCircle className="h-3.5 w-3.5" /> Verified
          </div>
        )}
        {reviewerProfile?.verification_type === 'email_domain' && (
          <div className="flex items-center gap-1.5 text-primary text-xs font-semibold bg-primary/8 px-3 py-1.5 rounded-full" title={`Verified via ${reviewerProfile.verified_domain}`}>
            <Building2 className="h-3.5 w-3.5" /> {reviewerProfile.verified_domain}
          </div>
        )}
        {reviewerProfile?.verification_type === 'linkedin' && (
          <div className="flex items-center gap-1.5 text-[#0A66C2] text-xs font-semibold bg-[#0A66C2]/8 px-3 py-1.5 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5" /> LinkedIn Verified
          </div>
        )}
        {verified_purchase && !verified_reviewer && (
          <div className="flex items-center gap-1.5 text-primary text-xs font-semibold bg-primary/8 px-3 py-1.5 rounded-full">
            <CheckCircle className="h-3.5 w-3.5" /> Verified Purchase
          </div>
        )}
      </div>

      {(pros || (pros_tags && pros_tags.length > 0)) && (
        <div className="mb-3 p-3 rounded-xl bg-[hsl(var(--success)/0.05)] border border-[hsl(var(--success)/0.1)]">
          <span className="text-xs font-bold text-[hsl(var(--success))] uppercase tracking-wider">Pros</span>
          {pros_tags && pros_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
              {pros_tags.map((tag, i) => (
                <span key={i} className="inline-flex items-center rounded-full bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] text-[10px] font-semibold px-2 py-0.5">{tag}</span>
              ))}
            </div>
          )}
          {pros && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{pros}</p>}
        </div>
      )}
      {(cons || (cons_tags && cons_tags.length > 0)) && (
        <div className="mb-3 p-3 rounded-xl bg-[hsl(var(--destructive)/0.05)] border border-[hsl(var(--destructive)/0.1)]">
          <span className="text-xs font-bold text-destructive uppercase tracking-wider">Cons</span>
          {cons_tags && cons_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
              {cons_tags.map((tag, i) => (
                <span key={i} className="inline-flex items-center rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold px-2 py-0.5">{tag}</span>
              ))}
            </div>
          )}
          {cons && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{cons}</p>}
        </div>
      )}
      {body && <p className="text-sm text-muted-foreground leading-relaxed mb-4">{body}</p>}

      {/* Multi-criteria breakdown */}
      {(ease_of_use || customer_support || value_for_money || features_rating) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 mb-4 text-xs text-muted-foreground">
          {ease_of_use && <div className="flex items-center gap-1.5"><span>Ease of Use</span><StarRating rating={ease_of_use} size="sm" /></div>}
          {customer_support && <div className="flex items-center gap-1.5"><span>Support</span><StarRating rating={customer_support} size="sm" /></div>}
          {value_for_money && <div className="flex items-center gap-1.5"><span>Value</span><StarRating rating={value_for_money} size="sm" /></div>}
          {features_rating && <div className="flex items-center gap-1.5"><span>Features</span><StarRating rating={features_rating} size="sm" /></div>}
        </div>
      )}

      {/* Media attachments */}
      {media && media.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {media.map((m, i) => (
            <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="h-16 w-16 rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition-all">
              <img src={m.url} alt={`Review attachment ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}

      {/* Vendor Response */}
      {vendorResponse && (
        <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
            <Store className="h-3 w-3" /> Vendor Response
          </div>
          <p className="text-sm text-foreground leading-relaxed">{vendorResponse.body}</p>
        </div>
      )}

      {/* Reactions */}
      <div className="mb-3">
        <ReviewReactions reviewId={id} />
      </div>

      {/* Footer with reviewer info, votes, comments toggle */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">{(reviewer_name || "A").charAt(0)}</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">
              {reviewer_user_id ? (
                <Link to={`/user/${reviewer_username || reviewer_user_id}`} className="hover:text-primary transition-colors">{reviewer_name || "Anonymous"}</Link>
              ) : (reviewer_name || "Anonymous")}
            </span>
            {reviewerBadges.length > 0 && <BadgeRow badges={reviewerBadges} max={3} size="xs" />}
            {reviewer_role && <span className="opacity-60"> · {reviewer_role}</span>}
            {company_size && <span className="opacity-60"> · {company_size}</span>}
          </div>
          <span className="opacity-40">· {formatDistanceToNow(new Date(created_at), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm"
            disabled={!user || isVoting}
            onClick={() => vote("up")}
            className={cn("h-8 text-xs gap-1.5 rounded-lg", userVote === "up" && "text-primary bg-primary/10")}
          >
            <ThumbsUp className={cn("h-3.5 w-3.5", userVote === "up" && "fill-current")} /> {up}
          </Button>
          <Button
            variant="ghost" size="sm"
            disabled={!user || isVoting}
            onClick={() => vote("down")}
            className={cn("h-8 text-xs gap-1.5 rounded-lg", userVote === "down" && "text-destructive bg-destructive/10")}
          >
            <ThumbsDown className={cn("h-3.5 w-3.5", userVote === "down" && "fill-current")} /> {down}
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setShowComments(!showComments)}
            className="h-8 text-xs gap-1.5 rounded-lg"
          >
            <MessageCircle className="h-3.5 w-3.5" /> {totalComments}
            {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
              {/* Add comment input */}
              {user ? (
                <div className="flex gap-2">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  />
                  <Button size="sm" onClick={handleComment} disabled={isAdding || !commentText.trim()} className="gap-1 px-3">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sign in to comment</p>
              )}

              {/* Thread list */}
              {topLevel.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <CommentItem
                    comment={comment}
                    currentUserId={user?.id}
                    onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                    onDelete={() => deleteComment(comment.id)}
                  />
                  {/* Replies */}
                  {replies(comment.id).map((reply) => (
                    <div key={reply.id} className="ml-8">
                      <CommentItem
                        comment={reply}
                        currentUserId={user?.id}
                        onDelete={() => deleteComment(reply.id)}
                      />
                    </div>
                  ))}
                  {/* Reply input */}
                  {replyTo === comment.id && user && (
                    <div className="ml-8 flex gap-2">
                      <Input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="text-sm"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleReply(comment.id)}
                      />
                      <Button size="sm" onClick={() => handleReply(comment.id)} disabled={isAdding || !replyText.trim()} className="gap-1 px-3">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {topLevel.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-2">No comments yet</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommentItem({ comment, currentUserId, onReply, onDelete }: {
  comment: any;
  currentUserId?: string;
  onReply?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2 group">
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[9px] font-bold text-muted-foreground">{(comment.profiles?.name || "A").charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">{comment.profiles?.name || "User"}</span>
          <span className="text-[10px] text-muted-foreground/50">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{comment.body}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {onReply && (
            <button onClick={onReply} className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors">
              Reply
            </button>
          )}
          {currentUserId === comment.user_id && (
            <button onClick={onDelete} className="text-[11px] font-medium text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
