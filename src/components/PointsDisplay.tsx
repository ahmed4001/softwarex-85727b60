import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Zap } from "lucide-react";

export function PointsDisplay() {
  const { user } = useAuth();

  const { data: points } = useQuery({
    queryKey: ["user-points", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("total_points")
        .eq("user_id", user!.id)
        .single();
      return (data as any)?.total_points ?? 0;
    },
  });

  if (!user) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-bold">
      <Zap className="h-3.5 w-3.5" />
      {points ?? 0}
    </div>
  );
}
