import { motion } from "framer-motion";
import { Award, TrendingUp, CheckCircle } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden" style={{ background: "hsl(15 60% 96%)" }} aria-label="Find the best business software">
      {/* Geometric shapes - animated */}
      <motion.div
        className="absolute top-[-60px] left-[-40px] w-48 h-48 rounded-2xl"
        style={{ background: "hsl(220 90% 56%)" }}
        animate={{ rotate: [12, 20, 5, 12], y: [0, -15, 10, 0], x: [0, 10, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute top-[-30px] left-[60px] w-36 h-36 rounded-2xl"
        style={{ background: "hsl(0 80% 60%)" }}
        animate={{ rotate: [-6, 8, -12, -6], y: [0, 12, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute top-[-50px] right-[-30px] w-44 h-44 rounded-2xl"
        style={{ background: "hsl(165 80% 48%)" }}
        animate={{ rotate: [20, 30, 15, 20], y: [0, -10, 15, 0], x: [0, -12, 5, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute bottom-[-40px] left-[5%] w-40 h-40 rounded-2xl"
        style={{ background: "hsl(0 80% 58%)" }}
        animate={{ rotate: [-12, -5, -18, -12], y: [0, 10, -12, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute bottom-[-50px] right-[8%] w-52 h-52 rounded-full"
        style={{ background: "hsl(260 60% 45%)" }}
        animate={{ rotate: [6, 15, -3, 6], scale: [1, 1.05, 0.97, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute bottom-[20px] right-[-20px] w-36 h-36 rounded-2xl"
        style={{ background: "hsl(165 80% 48%)" }}
        animate={{ rotate: [30, 40, 22, 30], y: [0, -14, 8, 0], x: [0, -8, 6, 0] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        aria-hidden="true"
      />

      <div className="container relative z-10 py-28 md:py-36 lg:py-44 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.08] mb-6">
            Find & Compare the
            <br />
            <span className="text-primary">Best Business Software</span>
          </h1>

          <p className="text-lg md:text-xl text-foreground/60 mb-4 max-w-2xl mx-auto leading-relaxed">
            Read <strong>verified user reviews</strong>, compare SaaS tools side-by-side, and discover the right
            software for your team — from <strong>CRM</strong> and <strong>project management</strong> to{" "}
            <strong>marketing automation</strong> and beyond.
          </p>
          <p className="text-sm text-foreground/40 mb-10 max-w-xl mx-auto flex items-center justify-center gap-4 flex-wrap">
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-primary" /> 10,000+ verified reviews</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-primary" /> 50+ categories</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-primary" /> 100% free</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="max-w-2xl mx-auto mb-8"
        >
          <label htmlFor="hero-search" className="sr-only">Search for business software, SaaS tools, or categories</label>
          <SearchBar variant="hero" className="w-full" />
        </motion.div>

        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-6 text-sm"
          aria-label="Quick links"
        >
          <Link to="/category/all" className="flex items-center gap-1.5 text-foreground/50 hover:text-primary transition-colors font-medium">
            <Award className="h-4 w-4" aria-hidden="true" /> Best Software 2026
          </Link>
          <Link to="/category/all" className="flex items-center gap-1.5 text-foreground/50 hover:text-primary transition-colors font-medium">
            <TrendingUp className="h-4 w-4" aria-hidden="true" /> Trending SaaS Tools
          </Link>
        </motion.nav>
      </div>
    </section>
  );
}
