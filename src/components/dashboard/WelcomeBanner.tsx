import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Search, Star, BookOpen, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: Search,
    title: "Discover Software",
    description: "Browse thousands of tools across categories to find what fits your needs.",
    link: "/search",
    cta: "Browse Software",
  },
  {
    icon: Star,
    title: "Write Reviews",
    description: "Share your experience and help others make informed decisions.",
    link: "/search",
    cta: "Find a Product",
  },
  {
    icon: BookOpen,
    title: "Compare Options",
    description: "Use side-by-side comparisons to evaluate alternatives.",
    link: "/compare",
    cta: "Start Comparing",
  },
];

export function WelcomeBanner({ userName }: { userName?: string }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("welcome-banner-dismissed") === "true";
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("welcome-banner-dismissed", "true");
    } catch {}
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="relative mb-8 rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/5 via-accent/5 to-background p-6 md:p-8 overflow-hidden"
      >
        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-accent/5 blur-2xl" />

        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Welcome{userName ? `, ${userName}` : ""}! 👋
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6 max-w-xl">
            Get the most out of SoftwareHub with these quick steps to discover, review, and compare the best software tools.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="group rounded-xl border border-border/50 bg-card/50 p-4 hover:border-primary/20 hover:bg-card transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <step.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{step.description}</p>
                <Link to={step.link}>
                  <Button variant="ghost" size="sm" className="gap-1 px-0 text-xs text-primary hover:text-primary">
                    {step.cta} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
