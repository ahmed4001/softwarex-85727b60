import { motion } from "framer-motion";
import { Shield, Search, BarChart3, Users, Clock, Zap, CheckCircle, Globe } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Verified reviews only",
    desc: "Every review is checked for authenticity. No fake reviews, no paid placements in ratings.",
  },
  {
    icon: BarChart3,
    title: "Side-by-side comparison",
    desc: "Compare pricing, features, and ratings across multiple products in one clean view.",
  },
  {
    icon: Search,
    title: "Smart search & filters",
    desc: "Find exactly what you need with advanced filters for pricing, company size, and industry.",
  },
  {
    icon: Users,
    title: "Community driven",
    desc: "Real feedback from real teams. Know what works before you commit to a purchase.",
  },
  {
    icon: Clock,
    title: "Save hours of research",
    desc: "Stop juggling tabs. All the info you need about any tool is in one place.",
  },
  {
    icon: Zap,
    title: "Always up to date",
    desc: "Pricing and features are updated regularly so you're never working with stale data.",
  },
  {
    icon: CheckCircle,
    title: "Free forever",
    desc: "No subscriptions, no paywalls. Access every review and comparison at zero cost.",
  },
  {
    icon: Globe,
    title: "Global coverage",
    desc: "Software reviews from teams across 50+ countries and every major industry.",
  },
];

export function FeaturesGridSection() {
  return (
    <section className="py-20 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-primary mb-2">Why SoftwareHub</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
            Everything you need to choose wisely
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            We built the platform we wished existed when evaluating software for our own teams.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-5"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
