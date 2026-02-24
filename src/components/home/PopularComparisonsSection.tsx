import { motion } from "framer-motion";
import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const comparisons = [
  { a: "Slack", b: "Microsoft Teams", category: "Communication" },
  { a: "Notion", b: "Confluence", category: "Knowledge Base" },
  { a: "HubSpot", b: "Salesforce", category: "CRM" },
  { a: "Figma", b: "Sketch", category: "Design" },
  { a: "Jira", b: "Linear", category: "Project Management" },
  { a: "Mailchimp", b: "SendGrid", category: "Email Marketing" },
];

export function PopularComparisonsSection() {
  return (
    <section className="py-20">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <p className="text-sm font-semibold text-primary mb-1">Compare</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">Popular comparisons</h2>
            <p className="text-muted-foreground mt-1">See how top tools stack up against each other</p>
          </div>
          <Link to="/compare">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              Compare Tools <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparisons.map((c, i) => (
            <motion.div
              key={`${c.a}-${c.b}`}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to="/compare"
                className="glass-card p-5 flex items-center gap-4 group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{c.a.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">{c.a} vs {c.b}</p>
                    <p className="text-xs text-muted-foreground">{c.category}</p>
                  </div>
                </div>
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
