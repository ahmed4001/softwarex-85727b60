import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const reasonLabels: Record<string, string> = {
  review_posted: "Wrote a review",
  comment_added: "Posted a comment",
  qa_posted: "Asked/Answered Q&A",
  vote_cast: "Cast a vote",
  daily_streak: "Daily streak bonus",
};

const reasonPoints: Record<string, string> = {
  review_posted: "+50",
  comment_added: "+10",
  qa_posted: "+10",
  vote_cast: "+5",
  daily_streak: "+25",
};

export function PointsHistory({ userId }: { userId: string }) {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["point-transactions", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("point_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Zap className="h-8 w-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No points earned yet. Write reviews to start earning!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((t: any) => (
        <Card key={t.id} className="border-border/50">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{reasonLabels[t.reason] || t.reason}</p>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-0 font-bold">
              +{t.points}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
