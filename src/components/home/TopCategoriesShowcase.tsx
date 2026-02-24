import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp } from "lucide-react";

const showcaseCategories = [
  {
    name: "CRM Software",
    slug: "crm",
    description: "Manage customer relationships, track deals, and grow revenue with the right CRM.",
    tools: ["Salesforce", "HubSpot", "Pipedrive", "Zoho CRM"],
    count: "45+",
  },
  {
    name: "Project Management",
    slug: "project-management",
    description: "Plan, track, and deliver projects on time with tools your whole team will love.",
    tools: ["Asana", "Monday.com", "ClickUp", "Jira"],
    count: "38+",
  },
  {
    name: "Marketing Automation",
    slug: "marketing-automation",
    description: "Automate campaigns, nurture leads, and measure ROI across every channel.",
    tools: ["Mailchimp", "ActiveCampaign", "Marketo", "Klaviyo"],
    count: "32+",
  },
  {
    name: "Analytics & BI",
    slug: "analytics",
    description: "Turn data into decisions with dashboards, reports, and real-time insights.",
    tools: ["Tableau", "Looker", "Mixpanel", "Amplitude"],
    count: "28+",
  },
];

export function TopCategoriesShowcase() {
  return (
    <section className="py-20 md:py-24 bg-muted/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-primary mb-2">Trending</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
            Most explored categories
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Dive deeper into the most popular software categories our users are researching right now.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {showcaseCategories.map((cat, i) => (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link
                to={`/category/${cat.slug}`}
                className="glass-card p-6 group block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                      {cat.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">{cat.count} products</span>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {cat.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.tools.map((tool) => (
                    <span
                      key={tool}
                      className="text-[11px] font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore category <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
