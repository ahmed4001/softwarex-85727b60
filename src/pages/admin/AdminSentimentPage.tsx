import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, ThumbsUp, ThumbsDown, Minus, Shuffle } from "lucide-react";
import { toast } from "sonner";

type SentimentResult = {
  id: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  score: number;
  keywords: string[];
  summary: string;
};

const sentimentConfig = {
  positive: { icon: ThumbsUp, color: "text-green-500", bg: "bg-green-500/10" },
  neutral: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted" },
  negative: { icon: ThumbsDown, color: "text-destructive", bg: "bg-destructive/10" },
  mixed: { icon: Shuffle, color: "text-amber-500", bg: "bg-amber-500/10" },
};

export default function AdminSentimentPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<SentimentResult[]>([]);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews-for-sentiment"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, title, body, pros, cons, overall_rating, products(name)")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const analyze = async () => {
    if (reviews.length === 0) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-sentiment", {
        body: {
          reviews: reviews.map((r: any) => ({
            id: r.id,
            title: r.title,
            body: r.body,
            pros: r.pros,
            cons: r.cons,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.results || []);
      toast.success(`Analyzed ${data.results?.length || 0} reviews`);
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const stats = {
    positive: results.filter((r) => r.sentiment === "positive").length,
    neutral: results.filter((r) => r.sentiment === "neutral").length,
    negative: results.filter((r) => r.sentiment === "negative").length,
    mixed: results.filter((r) => r.sentiment === "mixed").length,
    avgScore: results.length ? (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(2) : "—",
  };

  // Map results to reviews
  const resultMap = new Map(results.map((r) => [r.id, r]));

  return (
    <>
      <SeoHead title="Sentiment Analysis - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="h-6 w-6" /> Review Sentiment Analysis
            </h1>
            <p className="text-muted-foreground">AI-powered sentiment analysis of user reviews</p>
          </div>
          <Button onClick={analyze} disabled={analyzing || isLoading || reviews.length === 0} className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            Analyze {reviews.length} Reviews
          </Button>
        </div>

        {/* Stats */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(["positive", "neutral", "negative", "mixed"] as const).map((s) => {
              const cfg = sentimentConfig[s];
              const Icon = cfg.icon;
              return (
                <Card key={s}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${cfg.bg}`}><Icon className={`h-5 w-5 ${cfg.color}`} /></div>
                    <div>
                      <p className="text-2xl font-bold">{stats[s]}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Brain className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgScore}</p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Review list with sentiment */}
        <div className="space-y-3">
          {reviews.map((r: any) => {
            const sentiment = resultMap.get(r.id);
            const cfg = sentiment ? sentimentConfig[sentiment.sentiment] : null;
            const Icon = cfg?.icon;
            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{r.title || "Untitled Review"}</span>
                        <span className="text-xs text-muted-foreground">· {r.products?.name}</span>
                        <span className="text-xs text-muted-foreground">· ★{r.overall_rating}</span>
                      </div>
                      {sentiment && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {Icon && <Icon className={`h-4 w-4 ${cfg?.color}`} />}
                            <Badge variant="outline" className="text-xs capitalize">{sentiment.sentiment} ({sentiment.score.toFixed(2)})</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{sentiment.summary}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sentiment.keywords.map((k) => (
                              <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {!sentiment && <p className="text-xs text-muted-foreground italic">Not yet analyzed</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading reviews...</p>}
          {!isLoading && reviews.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No reviews found.</p>}
        </div>
      </div>
    </>
  );
}
