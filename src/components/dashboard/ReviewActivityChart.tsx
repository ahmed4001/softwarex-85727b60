import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";

interface Props {
  userId: string;
}

export function ReviewActivityChart({ userId }: Props) {
  const { data: reviews } = useQuery({
    queryKey: ["review-activity-chart", userId],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data } = await supabase
        .from("reviews")
        .select("created_at, overall_rating")
        .eq("user_id", userId)
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const chartData = useMemo(() => {
    const months: Record<string, { month: string; reviews: number; avgRating: number; total: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("en-US", { month: "short" });
      months[key] = { month: key, reviews: 0, avgRating: 0, total: 0 };
    }
    reviews?.forEach((r) => {
      const key = new Date(r.created_at!).toLocaleDateString("en-US", { month: "short" });
      if (months[key]) {
        months[key].reviews += 1;
        months[key].total += r.overall_rating;
        months[key].avgRating = +(months[key].total / months[key].reviews).toFixed(1);
      }
    });
    return Object.values(months);
  }, [reviews]);

  const totalReviews = chartData.reduce((s, d) => s + d.reviews, 0);

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Review Activity</h3>
          </div>
          <span className="text-xs text-muted-foreground">{totalReviews} in 6 months</span>
        </div>
        {totalReviews === 0 ? (
          <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
            No reviews yet — start reviewing to see your activity here!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [value, name === "reviews" ? "Reviews" : "Avg Rating"]}
              />
              <Bar dataKey="reviews" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
