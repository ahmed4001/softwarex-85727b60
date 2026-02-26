import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Wand2, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ReviewDigestCardProps {
  productId: string;
  isAdmin?: boolean;
}

interface ReviewDigest {
  id: string;
  product_id: string;
  overall_verdict: string | null;
  pros_summary: string | null;
  cons_summary: string | null;
  top_themes: string[];
  sentiment_pct: { positive: number; neutral: number; negative: number };
  avg_sub_ratings: Record<string, number | null>;
  review_count: number;
  updated_at: string;
}

const subRatingLabels: Record<string, string> = {
  ease_of_use: "Ease of Use",
  customer_support: "Customer Support",
  value_for_money: "Value for Money",
  features: "Features",
};

export function ReviewDigestCard({ productId, isAdmin }: ReviewDigestCardProps) {
  const queryClient = useQueryClient();

  const { data: digest, isLoading } = useQuery({
    queryKey: ["review-digest", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_digests")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ReviewDigest | null;
    },
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-review-summary", {
        body: { product_id: productId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("AI Review Digest regenerated!");
      queryClient.invalidateQueries({ queryKey: ["review-digest", productId] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to generate digest"),
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader><div className="h-5 bg-muted rounded w-48" /></CardHeader>
        <CardContent><div className="h-24 bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  if (!digest) {
    if (!isAdmin) return null;
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No AI digest generated yet.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
            className="gap-1.5"
          >
            {regenerate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Generate Digest
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sentiment = digest.sentiment_pct || { positive: 0, neutral: 0, negative: 0 };
  const themes = Array.isArray(digest.top_themes) ? digest.top_themes : [];
  const subRatings = digest.avg_sub_ratings || {};

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-display">AI Review Digest</CardTitle>
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending}
              className="gap-1.5 text-xs h-7"
            >
              {regenerate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              Regenerate
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall Verdict */}
        {digest.overall_verdict && (
          <p className="text-sm text-foreground leading-relaxed font-medium">
            {digest.overall_verdict}
          </p>
        )}

        {/* Pros & Cons */}
        <div className="grid md:grid-cols-2 gap-4">
          {digest.pros_summary && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-1.5 mb-2">
                <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Pros</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{digest.pros_summary}</p>
            </div>
          )}
          {digest.cons_summary && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 border-l-4 border-l-red-500">
              <div className="flex items-center gap-1.5 mb-2">
                <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Cons</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{digest.cons_summary}</p>
            </div>
          )}
        </div>

        {/* Top Themes */}
        {themes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Themes</h4>
            <div className="flex flex-wrap gap-1.5">
              {themes.map((theme, i) => (
                <Badge key={i} variant="secondary" className="text-xs rounded-md">
                  {theme}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Sentiment Bar */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sentiment Breakdown</h4>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {sentiment.positive > 0 && (
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${sentiment.positive}%` }}
                title={`Positive: ${sentiment.positive}%`}
              />
            )}
            {sentiment.neutral > 0 && (
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${sentiment.neutral}%` }}
                title={`Neutral: ${sentiment.neutral}%`}
              />
            )}
            {sentiment.negative > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${sentiment.negative}%` }}
                title={`Negative: ${sentiment.negative}%`}
              />
            )}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Positive {sentiment.positive}%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Neutral {sentiment.neutral}%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Negative {sentiment.negative}%</span>
          </div>
        </div>

        {/* Sub-Ratings */}
        {Object.entries(subRatings).some(([, v]) => v != null) && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Average Sub-Ratings</h4>
            <div className="space-y-2">
              {Object.entries(subRatings).map(([key, value]) => {
                if (value == null) return null;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-32 shrink-0">{subRatingLabels[key] || key}</span>
                    <Progress value={(value / 5) * 100} className="h-2 flex-1" />
                    <span className="text-xs font-medium w-8 text-right">{value}/5</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
          Based on {digest.review_count} reviews • Last updated {formatDistanceToNow(new Date(digest.updated_at), { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
