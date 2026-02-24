import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "CTO at TechScale",
    avatar: "SC",
    text: "SoftwareHub saved us weeks of research. The comparison tools are incredibly powerful — we found the perfect project management solution in under an hour.",
    rating: 5,
  },
  {
    name: "Marcus Rodriguez",
    role: "Product Manager at Flowline",
    avatar: "MR",
    text: "The verified reviews gave us confidence in our purchasing decision. No more guessing — real feedback from real teams.",
    rating: 5,
  },
  {
    name: "Emily Watson",
    role: "VP Engineering at DataBridge",
    avatar: "EW",
    text: "We switched our entire analytics stack based on SoftwareHub reviews. Best decision we made all year. The side-by-side comparisons are game-changing.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-40" />
      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">
            What People Say
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-black text-foreground">
            Loved by <span className="gradient-text">Thousands</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="glass-card p-8 relative group"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-primary/10" />
              
              <div className="flex gap-0.5 mb-5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-star text-star" />
                ))}
              </div>

              <p className="text-foreground/80 leading-relaxed mb-8 text-[15px]">
                "{t.text}"
              </p>

              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
