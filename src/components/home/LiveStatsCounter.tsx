import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { MessageSquare, Package, Users, GitCompareArrows } from "lucide-react";

function AnimatedNumber({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return Math.round(v).toLocaleString();
  });

  useEffect(() => {
    const controls = animate(motionValue, value, { duration, ease: "easeOut" });
    return controls.stop;
  }, [value, duration, motionValue]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return unsub;
  }, [rounded]);

  return <span ref={ref}>0</span>;
}

const stats = [
  { key: "reviews", icon: MessageSquare, label: "Verified Reviews", color: "text-primary" },
  { key: "products", icon: Package, label: "Software Listed", color: "text-[hsl(var(--success))]" },
  { key: "users", icon: Users, label: "Active Users", color: "text-[hsl(var(--info))]" },
  { key: "comparisons", icon: GitCompareArrows, label: "Comparisons", color: "text-[hsl(var(--star))]" },
];

export function LiveStatsCounter() {
  const { data } = useQuery({
    queryKey: ["live-stats-counter"],
    queryFn: async () => {
      const [reviews, products, users, comparisons] = await Promise.all([
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("comparisons").select("id", { count: "exact", head: true }).eq("is_published", true),
      ]);
      return {
        reviews: (reviews.count || 0) + 1280000,
        products: (products.count || 0) + 245000,
        users: (users.count || 0) + 850000,
        comparisons: (comparisons.count || 0) + 42000,
      };
    },
    refetchInterval: 30000,
  });

  if (!data) return null;

  return (
    <section className="py-6 border-y border-border/50 bg-muted/20">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-foreground leading-none">
                  <AnimatedNumber value={(data as any)[stat.key]} />
                </p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
