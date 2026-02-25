import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Award, Lock, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  tier: string;
  criteria_type: string;
  criteria_threshold: number;
}

const tierOrder: Record<string, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

export function BadgeShowcase({ userId }: { userId: string }) {
  const { data: allBadges = [] } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("badges")
        .select("*")
        .eq("is_active", true)
        .order("criteria_threshold", { ascending: true });
      return (data || []) as Badge[];
    },
  });

  const { data: earnedBadgeIds = [] } = useQuery({
    queryKey: ["user-badges", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId);
      return (data || []).map((b: any) => b.badge_id);
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile-stats", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("review_count, helpful_votes_received")
        .eq("user_id", userId)
        .single();
      return data;
    },
  });

  if (allBadges.length === 0) return null;

  const getUserProgress = (badge: Badge): number => {
    if (!profile) return 0;
    switch (badge.criteria_type) {
      case "review_count":
        return profile.review_count || 0;
      case "helpful_votes":
        return profile.helpful_votes_received || 0;
      default:
        return 0;
    }
  };

  const earned = allBadges.filter((b) => earnedBadgeIds.includes(b.id));
  const upcoming = allBadges
    .filter((b) => !earnedBadgeIds.includes(b.id))
    .sort((a, b) => (tierOrder[a.tier] ?? 0) - (tierOrder[b.tier] ?? 0))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-foreground">Your Badges</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {earned.length}/{allBadges.length} earned
        </span>
      </div>

      {earned.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {earned.map((badge, i) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-sm"
                style={{ backgroundColor: `${badge.color}20`, color: badge.color }}
              >
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground leading-tight">{badge.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{badge.tier}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {earned.length === 0 && (
        <p className="text-sm text-muted-foreground">No badges earned yet. Start reviewing to unlock your first badge!</p>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Next to unlock
          </h4>
          {upcoming.map((badge) => {
            const progress = getUserProgress(badge);
            const pct = Math.min(100, Math.round((progress / badge.criteria_threshold) * 100));
            return (
              <div key={badge.id} className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center text-xs opacity-50"
                    style={{ backgroundColor: `${badge.color}15`, color: badge.color }}
                  >
                    <Award className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground/70">{badge.name}</p>
                    {badge.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{badge.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {progress}/{badge.criteria_threshold}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
