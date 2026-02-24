import { motion } from "framer-motion";
import { Search, Award, TrendingUp } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden" style={{ background: "hsl(15 60% 96%)" }}>
      {/* Geometric shapes like G2 */}
      <div className="absolute top-[-60px] left-[-40px] w-48 h-48 rotate-12 rounded-2xl" style={{ background: "hsl(220 90% 56%)" }} />
      <div className="absolute top-[-30px] left-[60px] w-36 h-36 -rotate-6 rounded-2xl" style={{ background: "hsl(0 80% 60%)" }} />
      <div className="absolute top-[-50px] right-[-30px] w-44 h-44 rotate-[20deg] rounded-2xl" style={{ background: "hsl(165 80% 48%)" }} />
      <div className="absolute bottom-[-40px] left-[5%] w-40 h-40 -rotate-12 rounded-2xl" style={{ background: "hsl(0 80% 58%)" }} />
      <div className="absolute bottom-[-50px] right-[8%] w-52 h-52 rotate-6 rounded-full" style={{ background: "hsl(260 60% 45%)" }} />
      <div className="absolute bottom-[20px] right-[-20px] w-36 h-36 rotate-[30deg] rounded-2xl" style={{ background: "hsl(165 80% 48%)" }} />

      <div className="container relative z-10 py-28 md:py-36 lg:py-44 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.08] mb-6">
            Where you go
            <br />
            for software.
          </h1>

          <p className="text-lg md:text-xl text-foreground/60 mb-10 max-w-xl mx-auto leading-relaxed">
            Find the right software and services based on{" "}
            <span className="text-primary font-bold">10,000+</span> real reviews.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="max-w-2xl mx-auto mb-8"
        >
          <SearchBar variant="hero" className="w-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-6 text-sm"
        >
          <Link to="/category/all" className="flex items-center gap-1.5 text-foreground/50 hover:text-primary transition-colors font-medium">
            <Award className="h-4 w-4" /> Best Products 2026
          </Link>
          <Link to="/category/all" className="flex items-center gap-1.5 text-foreground/50 hover:text-primary transition-colors font-medium">
            <TrendingUp className="h-4 w-4" /> Trending Products
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
