import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Clock, Percent, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  userId: string;
  productIds: string[];
}

export function VendorResponseMetrics({ userId, productIds }: Props) {
  const { data: metrics } = useQuery({
    queryKey: ["vendor-response-metrics", userId, productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const [reviewsRes, responsesRes] = await Promise.all([
        supabase
          .from("reviews")
          .select("id, created_at, status")
          .in("product_id", productIds)
          .eq("status", "approved"),
        supabase
          .from("vendor_responses")
          .select("id, created_at, review_id")
          .eq("user_id", userId),
      ]);

      const reviews = reviewsRes.data || [];
      const responses = responsesRes.data || [];
      const respondedIds = new Set(responses.map((r) => r.review_id));

      const totalApproved = reviews.length;
      const totalResponded = reviews.filter((r) => respondedIds.has(r.id)).length;
      const responseRate = totalApproved > 0 ? Math.round((totalResponded / totalApproved) * 100) : 0;

      // Avg response time (if we can match review and response dates)
      let avgResponseHours = 0;
      let matchCount = 0;
      responses.forEach((resp) => {
        const review = reviews.find((r) => r.id === resp.review_id);
        if (review && review.created_at && resp.created_at) {
          const diff = new Date(resp.created_at).getTime() - new Date(review.created_at).getTime();
          if (diff > 0) {
            avgResponseHours += diff / (1000 * 60 * 60);
            matchCount++;
          }
        }
      });
      if (matchCount > 0) avgResponseHours = Math.round(avgResponseHours / matchCount);

      // This month's responses
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const thisMonthResponses = responses.filter((r) => r.created_at?.startsWith(thisMonth)).length;

      return {
        totalApproved,
        totalResponded,
        responseRate,
        avgResponseHours,
        thisMonthResponses,
        unanswered: totalApproved - totalResponded,
      };
    },
  });

  if (!metrics) return null;

  const cards = [
    { icon: Percent, label: "Response Rate", value: `${metrics.responseRate}%`, color: metrics.responseRate >= 80 ? "text-[hsl(var(--success))]" : metrics.responseRate >= 50 ? "text-[hsl(var(--warning))]" : "text-destructive" },
    { icon: Clock, label: "Avg Response Time", value: metrics.avgResponseHours > 0 ? `${metrics.avgResponseHours}h` : "—", color: "text-[hsl(var(--info))]" },
    { icon: MessageSquare, label: "Unanswered", value: metrics.unanswered, color: metrics.unanswered > 0 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]" },
    { icon: TrendingUp, label: "This Month", value: metrics.thisMonthResponses, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <card.icon className={`h-5 w-5 mx-auto mb-2 ${card.color}`} />
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.label}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
