import { motion } from "framer-motion";
import { Shield, Search, BarChart3, Users, Clock, Zap, CheckCircle, Globe } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Verified Reviews Only",
    desc: "Every software review is verified for authenticity. No fake reviews, no paid placements in ratings — only honest feedback from real business users.",
  },
  {
    icon: BarChart3,
    title: "Side-by-Side Software Comparison",
    desc: "Compare pricing plans, features, and user ratings across multiple SaaS products in one clean, data-rich view.",
  },
  {
    icon: Search,
    title: "Advanced Search & Filters",
    desc: "Find exactly the right software with filters for pricing model, company size, industry, deployment type, and integration requirements.",
  },
  {
    icon: Users,
    title: "Community-Driven Reviews",
    desc: "Real feedback from real teams using the software daily. Know what works before you commit to a purchase decision.",
  },
  {
    icon: Clock,
    title: "Save Hours of Software Research",
    desc: "Stop juggling browser tabs. All the information you need about any business tool — pricing, features, pros, cons — in one place.",
  },
  {
    icon: Zap,
    title: "Always Up-to-Date Information",
    desc: "Software pricing and feature data are updated monthly. Never make decisions based on stale or outdated information.",
  },
  {
    icon: CheckCircle,
    title: "Free Software Reviews Forever",
    desc: "No subscriptions, no paywalls. Access every review, comparison, and software recommendation at zero cost to your team.",
  },
  {
    icon: Globe,
    title: "Global Software Coverage",
    desc: "Software reviews from professional teams across 50+ countries and every major industry — from startups to Fortune 500.",
  },
];

export function FeaturesGridSection() {
  return (
    <section className="py-20 md:py-24" aria-labelledby="features-heading">
      <div className="container">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-primary mb-2">Why Choose SoftwareHub</p>
          <h2 id="features-heading" className="text-3xl md:text-4xl font-extrabold text-foreground">
            The Smarter Way to Choose Business Software
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            We built the software review platform we wished existed when evaluating SaaS tools for our own teams.
            Trusted by thousands of professionals making better software decisions.
          </p>
        </motion.header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-5"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center mb-4" aria-hidden="true">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
