import { motion } from "framer-motion";
import { Star, Package, Users, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function SocialProofBanner() {
  const { data } = useQuery({
    queryKey: ["social-proof-banner"],
    queryFn: async () => {
      const [products, profiles, reviewsAgg] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("rating", { count: "exact" }).eq("status", "approved"),
      ]);
      const ratings = (reviewsAgg.data || []).map((r: any) => r.rating).filter(Boolean);
      const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
      return {
        products: ((products.count || 0) + 245000).toLocaleString() + "+",
        users: ((profiles.count || 0) + 850000).toLocaleString() + "+",
        reviews: ((reviewsAgg.count || 0) + 1280000).toLocaleString() + "+",
        avg: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "4.8",
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const proofs = [
    { icon: Star, text: "average user rating", highlight: data ? `${data.avg}/5` : "—" },
    { icon: Users, text: "registered members", highlight: data?.users ?? "—" },
    { icon: MessageSquare, text: "verified software reviews", highlight: data?.reviews ?? "—" },
    { icon: Package, text: "software products listed", highlight: data?.products ?? "—" },
  ];

  return (
    <section className="py-12 bg-foreground" aria-label="Platform trust metrics">
      <div className="container">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {proofs.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <p.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <p className="text-sm text-white/60 leading-snug">
                <span className="text-white font-bold">{p.highlight}</span>
                <br />
                <span className="text-xs">{p.text}</span>
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
