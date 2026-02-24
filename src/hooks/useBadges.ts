import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  tier: string;
}

export interface UserBadge {
  id: string;
  badge_id: string;
  awarded_at: string;
  badges: Badge;
}

export function useUserBadges(userId?: string) {
  return useQuery({
    queryKey: ["user-badges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", userId!)
        .order("awarded_at", { ascending: false });
      return (data || []) as unknown as UserBadge[];
    },
  });
}

export function useAllBadges() {
  return useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("badges")
        .select("*")
        .eq("is_active", true)
        .order("tier", { ascending: true });
      return (data || []) as Badge[];
    },
  });
}

export interface LeaderboardEntry {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  review_count: number | null;
  helpful_votes_received: number | null;
  is_verified_reviewer: boolean | null;
  badge_count: number;
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      // Get profiles with stats
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, review_count, helpful_votes_received, is_verified_reviewer")
        .order("review_count", { ascending: false })
        .limit(50);

      if (!profiles?.length) return [];

      // Get badge counts per user
      const userIds = profiles.map((p) => p.user_id);
      const { data: badgeCounts } = await supabase
        .from("user_badges")
        .select("user_id, id")
        .in("user_id", userIds);

      const countMap = new Map<string, number>();
      badgeCounts?.forEach((b) => {
        countMap.set(b.user_id, (countMap.get(b.user_id) || 0) + 1);
      });

      const entries: LeaderboardEntry[] = profiles
        .map((p) => ({
          ...p,
          badge_count: countMap.get(p.user_id) || 0,
        }))
        .filter((p) => (p.review_count || 0) > 0)
        .sort((a, b) => {
          const scoreA = (a.review_count || 0) * 2 + (a.helpful_votes_received || 0);
          const scoreB = (b.review_count || 0) * 2 + (b.helpful_votes_received || 0);
          return scoreB - scoreA;
        });

      return entries;
    },
  });
}
