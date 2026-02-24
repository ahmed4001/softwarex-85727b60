import { motion } from "framer-motion";
import { Star, TrendingUp, Users, MessageSquare } from "lucide-react";

const proofs = [
  { icon: Star, text: "4.9/5 average rating from users", highlight: "4.9/5" },
  { icon: Users, text: "10,000+ professionals trust us", highlight: "10,000+" },
  { icon: MessageSquare, text: "50,000+ verified reviews", highlight: "50,000+" },
  { icon: TrendingUp, text: "Growing 40% month-over-month", highlight: "40%" },
];

export function SocialProofBanner() {
  return (
    <section className="py-12 bg-foreground">
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
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <p.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <p className="text-sm text-white/60 leading-snug">
                <span className="text-white font-bold">{p.highlight}</span>
                <br />
                <span className="text-xs">{p.text.replace(p.highlight, "").trim()}</span>
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
