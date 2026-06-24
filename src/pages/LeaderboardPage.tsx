import { SeoHead } from "@/components/SeoHead";
import { useLeaderboard, useAllBadges } from "@/hooks/useBadges";
import { BadgeIcon } from "@/components/BadgeDisplay";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, Star, Crown, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const rankIcons = [
  <Trophy className="h-5 w-5 text-yellow-500" />,
  <Medal className="h-5 w-5 text-slate-400" />,
  <Award className="h-5 w-5 text-amber-600" />,
];

export default function LeaderboardPage() {
  const { data: leaders = [], isLoading } = useLeaderboard();
  const { data: allBadges = [] } = useAllBadges();
  const { t } = useTranslation();

  return (
    <>
      <SeoHead title={t("leaderboard.title")} description={t("leaderboard.subtitle")} />
      <main className="container py-10 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">{t("leaderboard.title")}</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">{t("leaderboard.subtitle")}</p>
        </motion.div>

        {leaders.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
            {[1, 0, 2].map((idx) => {
              const l = leaders[idx];
              const rank = idx + 1;
              const isFirst = rank === 1;
              return (
                <motion.div
                  key={l.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn("glass-card p-3 sm:p-5 text-center", isFirst && "ring-2 ring-primary/20 -mt-4")}
                >
                  <div className="mb-2 flex justify-center">{rankIcons[idx]}</div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    {l.avatar_url ? (
                      <img src={l.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="text-base sm:text-lg font-bold text-primary">{(l.name || "?").charAt(0)}</span>
                    )}
                  </div>
                  <p className="font-display font-bold text-xs sm:text-sm text-foreground truncate">{l.name || t("leaderboard.anonymous")}</p>
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 text-[11px] sm:text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3" />{l.review_count || 0}</span>
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{l.helpful_votes_received || 0}</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground/60 mt-1">{l.badge_count} {t("leaderboard.badges").toLowerCase()}</p>
                </motion.div>
              );
            })}
          </div>
        )}


        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide -mx-px">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[2.5rem_1fr_4rem_4rem_3.5rem_3.5rem] gap-2 px-4 sm:px-5 py-3 border-b border-border/50 text-xs font-semibold text-muted-foreground">
                <span>#</span><span>{t("leaderboard.reviewer")}</span><span className="text-center">{t("leaderboard.reviews")}</span><span className="text-center">{t("leaderboard.helpful")}</span><span className="text-center">Pts</span><span className="text-center">{t("leaderboard.badges")}</span>
              </div>
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{t("common.loading")}</div>
              ) : leaders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{t("leaderboard.noReviewers")}</div>
              ) : (
                leaders.map((l, i) => (
                  <motion.div
                    key={l.user_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      "grid grid-cols-[2.5rem_1fr_4rem_4rem_3.5rem_3.5rem] gap-2 px-4 sm:px-5 py-3 items-center border-b border-border/30 last:border-0",
                      i < 3 && "bg-primary/[0.02]"
                    )}
                  >
                    <span className="text-sm font-bold text-muted-foreground">{i < 3 ? rankIcons[i] : i + 1}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        {l.avatar_url ? (
                          <img src={l.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">{(l.name || "?").charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{l.name || t("leaderboard.anonymous")}</p>
                        {l.is_verified_reviewer && <span className="text-[10px] text-[hsl(var(--success))] font-medium">{t("leaderboard.verifiedExpert")}</span>}
                      </div>
                    </div>
                    <span className="text-sm text-center font-medium text-foreground">{l.review_count || 0}</span>
                    <span className="text-sm text-center font-medium text-foreground">{l.helpful_votes_received || 0}</span>
                    <span className="text-sm text-center font-medium text-primary flex items-center justify-center gap-0.5"><Zap className="h-3 w-3" />{(l as any).total_points || 0}</span>
                    <span className="text-sm text-center font-medium text-primary">{l.badge_count}</span>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>


        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-12">
          <h2 className="text-xl font-display font-bold text-foreground mb-4 text-center">{t("leaderboard.availableBadges")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allBadges.map((b) => (
              <div key={b.id} className="glass-card p-4 text-center">
                <BadgeIcon badge={b} size="md" />
                <p className="text-sm font-semibold text-foreground mt-2">{b.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>
                <span className={cn(
                  "inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                  b.tier === "platinum" ? "bg-violet-100 text-violet-700" :
                  b.tier === "gold" ? "bg-yellow-100 text-yellow-700" :
                  b.tier === "silver" ? "bg-slate-100 text-slate-600" :
                  "bg-amber-100 text-amber-700"
                )}>{b.tier}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </>
  );
}
