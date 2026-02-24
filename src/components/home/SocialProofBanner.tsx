import { motion } from "framer-motion";
import { Star, TrendingUp, Users, MessageSquare } from "lucide-react";

const proofs = [
  { icon: Star, text: "average user rating", highlight: "4.9/5" },
  { icon: Users, text: "professionals trust SoftwareHub", highlight: "10,000+" },
  { icon: MessageSquare, text: "verified software reviews", highlight: "50,000+" },
  { icon: TrendingUp, text: "month-over-month growth", highlight: "40%" },
];

export function SocialProofBanner() {
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
