import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Star } from "lucide-react";

const COLORS = [
  "hsl(var(--destructive))",
  "hsl(var(--warning))",
  "hsl(38, 92%, 50%)",
  "hsl(var(--success))",
  "hsl(var(--primary))",
];

interface Props {
  userId: string;
}

export function RatingDistributionChart({ userId }: Props) {
  const { data: distribution } = useQuery({
    queryKey: ["rating-distribution", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("overall_rating")
        .eq("user_id", userId);
      const counts = [0, 0, 0, 0, 0];
      (data || []).forEach((r) => {
        if (r.overall_rating >= 1 && r.overall_rating <= 5) {
          counts[r.overall_rating - 1]++;
        }
      });
      return counts.map((count, i) => ({
        name: `${i + 1} Star`,
        value: count,
        stars: i + 1,
      }));
    },
  });

  const total = distribution?.reduce((s, d) => s + d.value, 0) || 0;

  if (total === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5 text-center">
          <Star className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No rating data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-4 w-4 text-[hsl(var(--star))]" />
          <h3 className="text-sm font-bold text-foreground">Your Rating Distribution</h3>
        </div>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie
                data={distribution?.filter((d) => d.value > 0)}
                innerRadius={35}
                outerRadius={55}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {distribution?.filter((d) => d.value > 0).map((_, i) => (
                  <Cell key={i} fill={COLORS[distribution!.findIndex((d) => d.value > 0 && distribution!.filter((x) => x.value > 0).indexOf(d) === i) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {distribution?.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground w-12">{d.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${total > 0 ? (d.value / total) * 100 : 0}%`, backgroundColor: COLORS[i] }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-6 text-right">{d.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
