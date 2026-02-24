import { motion } from "framer-motion";
import { Sparkles, CheckCircle, Shield, Zap } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Hero3DScene } from "@/components/Hero3DScene";

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 noise-overlay" />
      <Hero3DScene />

      <div className="container relative z-10 py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border backdrop-blur-md text-sm font-medium mb-10"
            style={{
              background: "hsla(0, 0%, 100%, 0.08)",
              borderColor: "hsla(0, 0%, 100%, 0.15)",
              color: "hsla(0, 0%, 100%, 0.9)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            Trusted by 10,000+ professionals worldwide
          </motion.div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black text-primary-foreground leading-[0.92] mb-8 tracking-tight">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="block"
            >
              Discover the
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="block mt-1"
            >
              <span className="relative inline-block">
                <span className="hero-gradient-text">Best Software</span>
                <motion.span
                  className="absolute -bottom-2 left-0 right-0 h-1.5 rounded-full"
                  style={{ background: "linear-gradient(90deg, #06b6d4, #a78bfa, #ec4899)" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.9, duration: 0.8, ease: "easeOut" }}
                />
              </span>
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed"
            style={{ color: "hsla(0, 0%, 100%, 0.65)" }}
          >
            Real reviews from verified users. Compare features, pricing, and more
            — all in one place. Make smarter decisions, faster.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            <SearchBar variant="hero" className="max-w-2xl mx-auto mb-12" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap items-center justify-center gap-8 text-sm"
            style={{ color: "hsla(0, 0%, 100%, 0.55)" }}
          >
            {[
              { icon: CheckCircle, text: "100% Free to use" },
              { icon: Shield, text: "Verified reviews only" },
              { icon: Zap, text: "Instant comparisons" },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-green-400" /> {text}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
