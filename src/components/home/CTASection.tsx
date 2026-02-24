import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl gradient-hero p-16 md:p-20 text-center"
        >
          <div className="absolute inset-0 noise-overlay" />
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-white/80 text-sm font-medium mb-8">
              <Sparkles className="h-4 w-4" />
              Join 10,000+ professionals
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-black text-primary-foreground mb-5 leading-tight">
              Ready to Find Your
              <br />
              Perfect Software?
            </h2>
            <p className="text-primary-foreground/60 text-lg mb-10 max-w-lg mx-auto">
              Start comparing tools today. It's free, fast, and powered by real reviews.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="bg-white text-foreground hover:bg-white/90 h-14 px-10 rounded-2xl font-bold text-base gap-2 shadow-xl">
                  Get Started Free <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/category/all">
                <Button size="lg" variant="ghost" className="text-primary-foreground border border-white/20 hover:bg-white/10 h-14 px-10 rounded-2xl font-bold text-base">
                  Browse Software
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
