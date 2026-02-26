import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

function avatarUrl(name: string, bg: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=72&bold=true&format=png`;
}

const testimonials = [
  {
    name: "Sarah Chen",
    role: "CTO, TechScale",
    text: "SoftwareHub saved us weeks of research. The comparison tools are incredibly powerful — we found the perfect project management solution in under an hour.",
    rating: 5,
    avatar: avatarUrl("Sarah Chen", "6366f1"),
  },
  {
    name: "Marcus Rodriguez",
    role: "Product Manager, Flowline",
    text: "The verified reviews gave us confidence in our purchasing decision. No more guessing — real feedback from real teams using these tools daily.",
    rating: 5,
    avatar: avatarUrl("Marcus Rodriguez", "0891b2"),
  },
  {
    name: "Emily Watson",
    role: "VP Engineering, DataBridge",
    text: "We switched our entire analytics stack based on reviews here. Best decision we made all year — the side-by-side comparisons are game-changing.",
    rating: 5,
    avatar: avatarUrl("Emily Watson", "059669"),
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-primary mb-2">Testimonials</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
            What teams are saying
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6 flex flex-col"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-star text-star" />
                ))}
              </div>

              <p className="text-foreground/80 leading-relaxed mb-6 text-[15px] flex-1">
                "{t.text}"
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <img src={t.avatar} alt={t.name} className="h-9 w-9 rounded-full object-cover" loading="lazy" />
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
