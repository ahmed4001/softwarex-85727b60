import { motion } from "framer-motion";
import { Search, BarChart3, Rocket } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Search & Discover",
    desc: "Find software by category, features, or search. Filter by pricing, rating, and more.",
    icon: Search,
    color: "from-primary to-violet-500",
  },
  {
    step: "02",
    title: "Compare & Read",
    desc: "Side-by-side comparisons with real reviews from verified users who've actually used the products.",
    icon: BarChart3,
    color: "from-secondary to-cyan-400",
  },
  {
    step: "03",
    title: "Decide & Act",
    desc: "Make confident decisions backed by data. Visit the vendor directly or save for later.",
    icon: Rocket,
    color: "from-pink-500 to-rose-400",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">
            Simple Process
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-black text-foreground">
            How It Works
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-px bg-gradient-to-r from-primary/20 via-secondary/30 to-pink-500/20" />

          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center relative"
            >
              <div className={`inline-flex h-16 w-16 rounded-3xl bg-gradient-to-br ${s.color} items-center justify-center mb-6 shadow-xl relative z-10`}>
                <s.icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 mb-3">
                Step {s.step}
              </div>
              <h3 className="font-display font-bold text-xl text-foreground mb-3">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
