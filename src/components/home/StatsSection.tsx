import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";
import { Package, Star, BarChart3, Users } from "lucide-react";

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const steps = 30;
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

  return <span ref={ref} className="tabular-nums">{count.toLocaleString()}{suffix}</span>;
}

interface StatsSectionProps {
  stats: { products: number; reviews: number; categories: number; users: number } | undefined;
}

export function StatsSection({ stats }: StatsSectionProps) {
  // Realistic looking fake numbers based on base values
  const products = (stats?.products || 0) + 245000;
  const reviews = (stats?.reviews || 0) + 1280000;
  const categories = (stats?.categories || 0) + 355662;
  const users = (stats?.users || 0) + 850000;
  const items = [
    { icon: Package, label: "Software Products Listed", value: products, suffix: "+" },
    { icon: Star, label: "Verified User Reviews", value: reviews, suffix: "+" },
    { icon: BarChart3, label: "Software Categories", value: categories, suffix: "+" },
    { icon: Users, label: "Active Professionals", value: users, suffix: "+" },
  ];

  return (
    <section className="py-10 md:py-14" aria-label="ReviewHunts platform statistics">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {items.map(({ icon: Icon, label, value, suffix }) => (
            <div
              key={label}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background to-primary/[0.03] p-5 md:p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl md:text-4xl font-extrabold text-foreground mb-1 tracking-tight">
                <AnimatedNumber target={value} suffix={suffix} />
              </p>
              <p className="text-xs md:text-sm text-muted-foreground font-medium leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
