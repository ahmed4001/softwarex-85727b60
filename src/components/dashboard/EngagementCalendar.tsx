import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { useMemo } from "react";

interface Props {
  userId: string;
}

export function EngagementCalendar({ userId }: Props) {
  const { data: activities } = useQuery({
    queryKey: ["engagement-calendar", userId],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 3);

      const [reviews, votes, comments] = await Promise.all([
        supabase
          .from("reviews")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", sixMonthsAgo.toISOString()),
        supabase
          .from("review_votes")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", sixMonthsAgo.toISOString()),
        supabase
          .from("review_comments")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", sixMonthsAgo.toISOString()),
      ]);

      const dayMap: Record<string, number> = {};
      const allDates = [
        ...(reviews.data || []),
        ...(votes.data || []),
        ...(comments.data || []),
      ];
      allDates.forEach((item) => {
        if (item.created_at) {
          const day = item.created_at.split("T")[0];
          dayMap[day] = (dayMap[day] || 0) + 1;
        }
      });
      return dayMap;
    },
  });

  const { weeks, maxCount } = useMemo(() => {
    const now = new Date();
    const weeks: { date: string; count: number; dayOfWeek: number }[][] = [];
    let currentWeek: { date: string; count: number; dayOfWeek: number }[] = [];
    let max = 0;

    // Go back 13 weeks (91 days)
    for (let i = 90; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const count = activities?.[key] || 0;
      if (count > max) max = count;
      const dayOfWeek = d.getDay();

      currentWeek.push({ date: key, count, dayOfWeek });
      if (dayOfWeek === 6 || i === 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    return { weeks, maxCount: max };
  }, [activities]);

  function getColor(count: number): string {
    if (count === 0) return "bg-muted";
    if (maxCount <= 1) return "bg-primary/60";
    const intensity = count / maxCount;
    if (intensity > 0.75) return "bg-primary";
    if (intensity > 0.5) return "bg-primary/70";
    if (intensity > 0.25) return "bg-primary/40";
    return "bg-primary/20";
  }

  const totalActivities = Object.values(activities || {}).reduce((s, v) => s + v, 0);
  const activeDays = Object.keys(activities || {}).length;

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Engagement (90 days)</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {totalActivities} actions · {activeDays} active days
          </span>
        </div>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`h-3 w-3 rounded-sm ${getColor(day.count)} transition-colors`}
                  title={`${day.date}: ${day.count} activities`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-2 justify-end">
          <span className="text-[10px] text-muted-foreground">Less</span>
          <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
          <div className="h-2.5 w-2.5 rounded-sm bg-primary/20" />
          <div className="h-2.5 w-2.5 rounded-sm bg-primary/40" />
          <div className="h-2.5 w-2.5 rounded-sm bg-primary/70" />
          <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </CardContent>
    </Card>
  );
}
