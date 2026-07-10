import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductLogo } from "@/components/ProductLogo";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, ArrowRight, ArrowLeft, RotateCcw, Star, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const STEPS = [
  {
    question: "What's your team size?",
    key: "company_size",
    options: [
      { label: "Solo / Freelancer", value: "1-10" },
      { label: "Small Team (2-50)", value: "11-50" },
      { label: "Mid-Market (51-500)", value: "51-200" },
      { label: "Enterprise (500+)", value: "201-1000" },
    ],
  },
  {
    question: "What's your budget?",
    key: "pricing",
    options: [
      { label: "Free only", value: "free" },
      { label: "Freemium OK", value: "freemium" },
      { label: "Paid is fine", value: "paid" },
      { label: "No budget limit", value: "any" },
    ],
  },
  {
    question: "What matters most?",
    key: "priority",
    options: [
      { label: "Ease of use", value: "ease" },
      { label: "Advanced features", value: "features" },
      { label: "Best value", value: "value" },
      { label: "Top rated", value: "rating" },
    ],
  },
];

export function ProductFinderQuiz() {
  const [step, setStep] = useState(-1); // -1 = intro
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const { data: results, isLoading } = useQuery({
    queryKey: ["finder-results", answers],
    enabled: showResults,
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, slug, logo_url, avg_rating, total_reviews, tagline, pricing_model, categories!products_category_id_fkey(name)")
        .eq("is_active", true);

      if (answers.pricing === "free") query = query.eq("pricing_model", "free");
      else if (answers.pricing === "freemium") query = query.in("pricing_model", ["free", "freemium"]);

      query = query.order("info_score", { ascending: false });
      if (answers.priority === "rating") query = query.order("avg_rating", { ascending: false });
      else if (answers.priority === "value") query = query.order("avg_rating", { ascending: false });
      else query = query.order("total_reviews", { ascending: false });

      query = query.gte("avg_rating", 3).limit(6);
      const { data } = await query;
      return data || [];
    },
  });

  const handleSelect = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setShowResults(true);
    }
  };

  const reset = () => {
    setStep(-1);
    setAnswers({});
    setShowResults(false);
  };

  return (
    <section className="py-16" aria-labelledby="finder-heading">
      <div className="container max-w-3xl">
        <AnimatePresence mode="wait">
          {step === -1 && !showResults && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden">
                <CardContent className="p-8 md:p-12 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Wand2 className="h-7 w-7 text-primary" />
                  </div>
                  <h3 id="finder-heading" className="t-h2 mb-2">
                    Smart Product Finder
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Answer 3 quick questions and we'll recommend the best software for your needs
                  </p>
                  <Button onClick={() => setStep(0)} size="lg" className="rounded-xl gap-2 font-semibold">
                    Start Quiz <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step >= 0 && !showResults && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="border-border/50">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      {step > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} className="gap-1">
                          <ArrowLeft className="h-3.5 w-3.5" /> Back
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {STEPS.map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 rounded-full transition-all ${
                            i <= step ? "w-8 bg-primary" : "w-2 bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-6">{STEPS[step].question}</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {STEPS[step].options.map((opt) => (
                      <Button
                        key={opt.value}
                        variant="outline"
                        className={`h-auto py-4 px-5 rounded-xl text-left justify-start font-medium transition-all ${
                          answers[STEPS[step].key] === opt.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "hover:border-primary/30"
                        }`}
                        onClick={() => handleSelect(STEPS[step].key, opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {showResults && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Your Recommendations</h3>
                  <p className="text-sm text-muted-foreground">Based on your preferences</p>
                </div>
                <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 rounded-xl">
                  <RotateCcw className="h-3.5 w-3.5" /> Retake
                </Button>
              </div>

              {isLoading ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : results && results.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {results.map((p: any, i: number) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link to={`/product/${p.slug}`}>
                        <Card className="border-border/50 hover:border-primary/30 transition-all hover:shadow-md group">
                          <CardContent className="p-4 flex items-center gap-3">
                            <ProductLogo name={p.name} logoUrl={p.logo_url} size="md" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-sm">
                                {p.name}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">{p.tagline || (p.categories as any)?.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Star className="h-3 w-3 text-[hsl(var(--star))] fill-[hsl(var(--star))]" />
                                <span className="text-xs font-medium">{Number(p.avg_rating).toFixed(1)}</span>
                                <span className="text-xs text-muted-foreground">({p.total_reviews})</span>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-border/50">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No matching products found. Try different criteria.
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
