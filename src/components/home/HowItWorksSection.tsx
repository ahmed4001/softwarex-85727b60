import { motion } from "framer-motion";
import { Search, BarChart3, ArrowRight } from "lucide-react";

const steps = [
  {
    step: "1",
    title: "Search & Discover Software",
    desc: "Browse 50+ software categories or search by product name. Filter by pricing model, user rating, company size, deployment type, and key features to narrow your options.",
    icon: Search,
  },
  {
    step: "2",
    title: "Compare & Read Verified Reviews",
    desc: "See side-by-side SaaS comparisons with real reviews from verified users at real companies. Compare pricing plans, feature sets, and satisfaction scores.",
    icon: BarChart3,
  },
  {
    step: "3",
    title: "Make a Confident Decision",
    desc: "Choose the best software with data-driven confidence. Visit the vendor website, start a free trial, request a demo, or save your shortlist for later.",
    icon: ArrowRight,
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20 md:py-24 bg-muted/40" aria-labelledby="how-it-works-heading">
      <div className="container">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-primary mb-2">How It Works</p>
          <h2 id="how-it-works-heading" className="text-3xl md:text-4xl font-extrabold text-foreground">
            Find Your Perfect Software in 3 Steps
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Our streamlined process helps you go from research to decision faster than any other review platform.
          </p>
        </motion.header>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => (
            <motion.article
              key={s.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="inline-flex h-12 w-12 rounded-xl bg-primary/10 items-center justify-center mb-5" aria-hidden="true">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-xs font-bold text-muted-foreground/50 uppercase tracking-wider mb-2" aria-hidden="true">
                Step {s.step}
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
