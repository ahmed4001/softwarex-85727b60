import { motion } from "framer-motion";
import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const comparisons = [
  { a: "Slack", b: "Microsoft Teams", category: "Team Communication Software" },
  { a: "Notion", b: "Confluence", category: "Knowledge Management Tools" },
  { a: "HubSpot CRM", b: "Salesforce", category: "CRM Software" },
  { a: "Figma", b: "Sketch", category: "UI/UX Design Tools" },
  { a: "Jira", b: "Linear", category: "Project Management Software" },
  { a: "Mailchimp", b: "SendGrid", category: "Email Marketing Platforms" },
];

export function PopularComparisonsSection() {
  return (
    <section className="py-20" aria-labelledby="comparisons-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <p className="text-sm font-semibold text-primary mb-1">Software Comparisons</p>
            <h2 id="comparisons-heading" className="text-2xl md:text-3xl font-extrabold text-foreground">Popular Software Comparisons</h2>
            <p className="text-muted-foreground mt-1">See how leading SaaS tools stack up against each other in head-to-head comparisons</p>
          </div>
          <Link to="/compare">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              Compare More Tools <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparisons.map((c, i) => (
            <motion.article
              key={`${c.a}-${c.b}`}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to="/compare"
                className="glass-card p-5 flex items-center gap-4 group"
                aria-label={`Compare ${c.a} vs ${c.b} — ${c.category}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <span className="text-xs font-bold text-primary">{c.a.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">{c.a} vs {c.b}</p>
                    <p className="text-xs text-muted-foreground">{c.category}</p>
                  </div>
                </div>
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" aria-hidden="true" />
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
