import { Award, Crown, Heart, Shield, Star, Trophy, Zap, PenTool, Edit3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UserBadge } from "@/hooks/useBadges";

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  award: Award,
  crown: Crown,
  heart: Heart,
  "shield-check": Shield,
  star: Star,
  trophy: Trophy,
  zap: Zap,
  "pen-tool": PenTool,
  "edit-3": Edit3,
};

const tierRing: Record<string, string> = {
  bronze: "ring-amber-600/30",
  silver: "ring-slate-400/40",
  gold: "ring-yellow-400/50",
  platinum: "ring-violet-400/50",
};

export function BadgeIcon({ badge, size = "sm" }: { badge: { icon: string; color: string; name: string; tier: string; description?: string | null }; size?: "xs" | "sm" | "md" }) {
  const Icon = iconMap[badge.icon] || Award;
  const dims = size === "xs" ? "h-5 w-5" : size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const iconDims = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn("rounded-full flex items-center justify-center ring-2 cursor-default", tierRing[badge.tier] || "ring-border", dims)}
          style={{ backgroundColor: `${badge.color}18` }}
        >
          <Icon className={iconDims} style={{ color: badge.color }} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold">{badge.name}</p>
        {badge.description && <p className="text-muted-foreground">{badge.description}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function BadgeRow({ badges, max = 4, size = "xs" }: { badges: UserBadge[]; max?: number; size?: "xs" | "sm" }) {
  if (!badges.length) return null;
  const shown = badges.slice(0, max);
  const extra = badges.length - max;

  return (
    <div className="flex items-center gap-0.5 -space-x-1">
      {shown.map((ub) => (
        <BadgeIcon key={ub.id} badge={ub.badges} size={size} />
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-muted-foreground ml-1.5">+{extra}</span>
      )}
    </div>
  );
}
