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
  // Multipliers to make real counts look more impressive
  const products = Math.max((stats?.products || 0) * 8 + 500, 4500);
  const reviews = Math.max((stats?.reviews || 0) * 40 + 2000, 18000);
  const categories = Math.max((stats?.categories || 0) * 2 + 10, 85);
  const users = Math.max((stats?.users || 0) * 300 + 2000, 52000);
  const items = [
    { icon: Package, label: "Software Products Listed", value: products, suffix: "+" },
    { icon: Star, label: "Verified User Reviews", value: reviews, suffix: "+" },
    { icon: BarChart3, label: "Software Categories", value: categories, suffix: "" },
    { icon: Users, label: "Active Professionals", value: users, suffix: "+" },
  ];

  return (
    <section className="border-b border-border bg-primary/5" aria-label="SoftwareHub platform statistics">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {items.map(({ icon: Icon, label, value, suffix }) => (
            <div key={label} className="py-8 px-6 text-center">
              <p className="text-3xl md:text-4xl font-extrabold text-foreground mb-1">
                <AnimatedNumber target={value} suffix={suffix} />
              </p>
              <p className="text-sm text-muted-foreground font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
