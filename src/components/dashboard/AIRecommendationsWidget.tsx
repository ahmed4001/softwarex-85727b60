import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";

export function AIRecommendationsWidget({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ["ai-recommendations", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_recommendations")
        .select("*, products!user_recommendations_product_id_fkey(id, name, slug, logo_url, avg_rating, total_reviews, tagline)")
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-recommendations", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Recommendations refreshed!");
      queryClient.invalidateQueries({ queryKey: ["ai-recommendations", userId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to generate recommendations"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground">AI Recommendations</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="gap-1.5 text-xs"
        >
          {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : recommendations && recommendations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recommendations.map((rec: any) => (
            <Link key={rec.id} to={`/product/${rec.products?.slug}`}>
              <Card className="border-border/50 hover:border-primary/30 transition-all group cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {rec.products?.logo_url ? (
                      <img decoding="async" loading="lazy" src={rec.products.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-primary">{rec.products?.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{rec.products?.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StarRating rating={Number(rec.products?.avg_rating || 0)} size="sm" />
                      <span>{Number(rec.products?.avg_rating || 0).toFixed(1)}</span>
                    </div>
                    {rec.reason && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{rec.reason}</p>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">No recommendations yet. Click refresh to generate personalized suggestions.</p>
            <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="gap-1.5">
              {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate Recommendations
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
