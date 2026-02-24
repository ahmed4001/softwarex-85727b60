import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Package, Star, BarChart3, Users } from "lucide-react";

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref} className="tabular-nums">{count}{suffix}</span>;
}

interface StatsSectionProps {
  stats: { products: number; reviews: number; categories: number } | undefined;
}

export function StatsSection({ stats }: StatsSectionProps) {
  const items = [
    { icon: Package, label: "Products Listed", value: stats?.products || 0, color: "from-primary to-primary/70" },
    { icon: Star, label: "Reviews Written", value: stats?.reviews || 0, color: "from-star to-amber-400" },
    { icon: BarChart3, label: "Categories", value: stats?.categories || 0, color: "from-secondary to-cyan-400" },
    { icon: Users, label: "Active Users", value: 10000, color: "from-success to-emerald-400", suffix: "+" },
  ];

  return (
    <section className="relative -mt-20 z-10">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-0 max-w-5xl mx-auto overflow-hidden"
        >
          <div className="grid grid-cols-2 md:grid-cols-4">
            {items.map(({ icon: Icon, label, value, color, suffix }, i) => (
              <div
                key={label}
                className="relative text-center py-10 px-6 group hover:bg-primary/[0.03] transition-colors duration-300"
              >
                {i < items.length - 1 && (
                  <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-12 w-px bg-border/50" />
                )}
                <div className={`inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br ${color} items-center justify-center mb-3 shadow-lg`}>
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <p className="text-4xl font-display font-black text-foreground mb-1">
                  <AnimatedNumber target={typeof value === "number" ? value : 10000} suffix={suffix} />
                </p>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-[0.15em]">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
