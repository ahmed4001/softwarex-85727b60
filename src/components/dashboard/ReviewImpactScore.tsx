import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, ThumbsUp, Eye, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  userId: string;
}

export function ReviewImpactScore({ userId }: Props) {
  const { data: impact } = useQuery({
    queryKey: ["review-impact", userId],
    queryFn: async () => {
      const [reviewsRes, votesRes, commentsRes] = await Promise.all([
        supabase
          .from("reviews")
          .select("id, helpful_count, not_helpful_count, status")
          .eq("user_id", userId),
        supabase
          .from("review_votes")
          .select("id")
          .eq("user_id", userId),
        supabase
          .from("review_comments")
          .select("id")
          .eq("user_id", userId),
      ]);

      const reviews = reviewsRes.data || [];
      const totalHelpful = reviews.reduce((s, r) => s + (r.helpful_count || 0), 0);
      const totalNotHelpful = reviews.reduce((s, r) => s + (r.not_helpful_count || 0), 0);
      const approvedReviews = reviews.filter((r) => r.status === "approved").length;
      const totalVotes = votesRes.data?.length || 0;
      const totalComments = commentsRes.data?.length || 0;

      // Calculate impact score (0-100)
      const reviewScore = Math.min(approvedReviews * 10, 30);
      const helpfulScore = Math.min(totalHelpful * 5, 30);
      const engagementScore = Math.min((totalVotes + totalComments) * 2, 20);
      const qualityBonus = totalNotHelpful > 0
        ? Math.max(0, 20 * (1 - totalNotHelpful / (totalHelpful + totalNotHelpful + 1)))
        : 20;

      const score = Math.round(reviewScore + helpfulScore + engagementScore + qualityBonus);

      return {
        score: Math.min(score, 100),
        totalHelpful,
        approvedReviews,
        totalVotes,
        totalComments,
      };
    },
  });

  const score = impact?.score || 0;
  const level = score >= 80 ? "Expert" : score >= 60 ? "Trusted" : score >= 30 ? "Active" : "Newcomer";
  const levelColor = score >= 80 ? "text-primary" : score >= 60 ? "text-[hsl(var(--success))]" : score >= 30 ? "text-[hsl(var(--warning))]" : "text-muted-foreground";

  return (
    <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Review Impact Score</h3>
        </div>
        <div className="flex items-center gap-5">
          <div className="relative h-20 w-20 flex-shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
              <motion.circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 213.6} 213.6`}
                initial={{ strokeDasharray: "0 213.6" }}
                animate={{ strokeDasharray: `${(score / 100) * 213.6} 213.6` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-foreground">{score}</span>
              <span className="text-[9px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <p className={`text-sm font-bold ${levelColor}`}>{level} Reviewer</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ThumbsUp className="h-3 w-3" /> {impact?.totalHelpful || 0} helpful
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" /> {impact?.approvedReviews || 0} approved
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ThumbsUp className="h-3 w-3" /> {impact?.totalVotes || 0} votes
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> {impact?.totalComments || 0} comments
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
