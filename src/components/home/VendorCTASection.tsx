import { motion } from "framer-motion";
import { ArrowRight, Building2, BarChart3, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const benefits = [
  { icon: Star, text: "Collect verified reviews from real software users" },
  { icon: BarChart3, text: "Track how your product compares to competitors" },
  { icon: Building2, text: "Reach thousands of potential B2B buyers monthly" },
];

export function VendorCTASection() {
  return (
    <section className="py-20 md:py-24" aria-labelledby="vendor-cta-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-8"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary mb-2">For Software Vendors</p>
            <h2 id="vendor-cta-heading" className="text-2xl md:text-3xl font-extrabold text-foreground mb-3">
              List Your Software on SoftwareHub
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6 max-w-lg">
              Showcase your SaaS product to thousands of teams actively researching business software solutions.
              Get discovered by qualified B2B buyers. Free to get started — no credit card required.
            </p>
            <ul className="space-y-3 mb-6" aria-label="Vendor benefits">
              {benefits.map((b) => (
                <li key={b.text} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <b.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{b.text}</p>
                </li>
              ))}
            </ul>
            <Link to="/register">
              <Button className="bg-primary text-primary-foreground rounded-xl font-semibold gap-2 h-11 px-6">
                Submit Your Product <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <aside className="hidden md:flex flex-col gap-3 w-64 flex-shrink-0" aria-label="Platform statistics">
            {[
              { label: "Software Products Listed", value: "500+", color: "primary" },
              { label: "Monthly B2B Visitors", value: "120K", color: "secondary" },
              { label: "Avg. Review Score", value: "4.6★", color: "primary" },
            ].map((stat) => (
              <div key={stat.label} className="bg-muted/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              </div>
            ))}
          </aside>
        </motion.div>
      </div>
    </section>
  );
}
