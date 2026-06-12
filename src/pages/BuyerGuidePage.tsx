import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass, ChevronRight, CheckCircle2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductLogo } from "@/components/ProductLogo";
import { RelatedInternalLinks } from "@/components/RelatedInternalLinks";

export default function BuyerGuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);

  const { data: guide, isLoading } = useQuery({
    queryKey: ["buyer-guide", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("buyer_guides")
        .select("*, categories:category_id(id, name, slug)")
        .eq("slug", slug!)
        .eq("is_published", true)
        .single();
      return data;

    },
    enabled: !!slug,
  });

  const steps = (guide?.steps as any[]) || [];
  const resultProductIds = (guide?.result_product_ids as string[]) || [];

  const { data: products = [] } = useQuery({
    queryKey: ["guide-products", resultProductIds],
    enabled: completed && resultProductIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, tagline, avg_rating, starting_price")
        .in("id", resultProductIds);
      return data || [];
    },
  });

  const handleAnswer = (answer: string) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    if (currentStep + 1 >= steps.length) {
      setCompleted(true);
      // Log completion
      supabase.from("buyer_guide_completions").insert({
        guide_id: guide!.id,
        answers: newAnswers,
        recommended_product_ids: resultProductIds,
      });
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  if (isLoading) {
    return <div className="container py-12 max-w-2xl"><div className="h-64 rounded-xl bg-muted/30 animate-pulse" /></div>;
  }

  if (!guide) {
    return <div className="container py-12 text-center"><h2 className="text-xl font-bold">Guide not found</h2></div>;
  }

  return (
    <>
      <SeoHead title={guide.title} description={guide.description || "Interactive buyer guide"} />
      <main className="container py-8 md:py-12 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Compass className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">{guide.title}</h1>
            {guide.description && <p className="text-muted-foreground mt-2">{guide.description}</p>}
          </div>

          {/* Progress */}
          {!completed && (
            <div className="flex items-center gap-1 mb-8">
              {steps.map((_: any, i: number) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentStep ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {!completed ? (
              <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <Card className="border-border/50">
                  <CardContent className="p-6">
                    <p className="text-xs text-muted-foreground mb-2">Step {currentStep + 1} of {steps.length}</p>
                    <h2 className="text-lg font-bold text-foreground mb-4">{steps[currentStep]?.question}</h2>
                    <div className="space-y-2">
                      {(steps[currentStep]?.options || []).map((opt: any, oi: number) => (
                        <Button
                          key={oi}
                          variant="outline"
                          className="w-full justify-start text-left h-auto py-3 px-4 gap-3"
                          onClick={() => handleAnswer(opt.label)}
                        >
                          <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{opt.label}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="text-center mb-6">
                  <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-foreground">Here are your top picks!</h2>
                  <p className="text-sm text-muted-foreground mt-1">Based on your answers, we recommend these tools.</p>
                </div>
                <div className="space-y-3">
                  {products.map((p: any) => (
                    <Link key={p.id} to={`/product/${p.slug}`}>
                      <Card className="border-border/50 hover:border-primary/30 transition-all group mb-3">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            <ProductLogo name={p.name} logoUrl={p.logo_url} size="sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</h3>
                            <p className="text-xs text-muted-foreground">{p.tagline}</p>
                          </div>
                          {p.avg_rating > 0 && <Badge variant="secondary">★ {Number(p.avg_rating).toFixed(1)}</Badge>}
                          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary flex-shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {products.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No specific recommendations. Browse our <Link to="/categories" className="text-primary hover:underline">categories</Link> to explore.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </>
  );
}
