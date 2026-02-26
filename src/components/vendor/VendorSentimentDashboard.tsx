import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ThumbsUp, ThumbsDown, TrendingUp, Minus } from "lucide-react";
import { format } from "date-fns";

export function VendorSentimentDashboard({ productIds }: { productIds: string[] }) {
  const { data: reviews = [] } = useQuery({
    queryKey: ["vendor-sentiment-reviews", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("overall_rating, created_at")
        .in("product_id", productIds)
        .eq("status", "approved")
        .order("created_at");
      return data || [];
    },
  });

  // Group by month and compute avg rating
  const monthlyData = reviews.reduce((acc: Record<string, { sum: number; count: number }>, r: any) => {
    const month = format(new Date(r.created_at), "yyyy-MM");
    if (!acc[month]) acc[month] = { sum: 0, count: 0 };
    acc[month].sum += r.overall_rating;
    acc[month].count += 1;
    return acc;
  }, {});

  const chartData = Object.entries(monthlyData).map(([month, { sum, count }]) => ({
    month,
    avgRating: Number((sum / count).toFixed(2)),
    count,
  })).sort((a, b) => a.month.localeCompare(b.month));

  const latestAvg = chartData.length > 0 ? chartData[chartData.length - 1].avgRating : 0;
  const prevAvg = chartData.length > 1 ? chartData[chartData.length - 2].avgRating : latestAvg;
  const trend = latestAvg - prevAvg;

  const positive = reviews.filter((r: any) => r.overall_rating >= 4).length;
  const neutral = reviews.filter((r: any) => r.overall_rating === 3).length;
  const negative = reviews.filter((r: any) => r.overall_rating <= 2).length;

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-foreground flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Sentiment Trends</h3>
      
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <ThumbsUp className="h-4 w-4 text-[hsl(var(--success))] mx-auto mb-1" />
            <p className="text-lg font-bold">{positive}</p>
            <p className="text-[10px] text-muted-foreground">Positive (4-5★)</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Minus className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{neutral}</p>
            <p className="text-[10px] text-muted-foreground">Neutral (3★)</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <ThumbsDown className="h-4 w-4 text-destructive mx-auto mb-1" />
            <p className="text-lg font-bold">{negative}</p>
            <p className="text-[10px] text-muted-foreground">Negative (1-2★)</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Average Rating Over Time</CardTitle>
            <p className="text-xs text-muted-foreground">
              Current: {latestAvg.toFixed(1)}★ · Trend: <span className={trend >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}>{trend >= 0 ? "+" : ""}{trend.toFixed(2)}</span>
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="avgRating" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
