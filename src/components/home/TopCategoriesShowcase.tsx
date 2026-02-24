import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp } from "lucide-react";

const showcaseCategories = [
  {
    name: "Best CRM Software",
    slug: "crm",
    description: "Manage customer relationships, track sales pipelines, and grow revenue. Compare top CRM platforms like Salesforce, HubSpot, and Pipedrive.",
    tools: ["Salesforce", "HubSpot", "Pipedrive", "Zoho CRM"],
    count: "45+",
  },
  {
    name: "Best Project Management Tools",
    slug: "project-management",
    description: "Plan, track, and deliver projects on time. Compare leading project management software including Asana, Monday.com, and ClickUp.",
    tools: ["Asana", "Monday.com", "ClickUp", "Jira"],
    count: "38+",
  },
  {
    name: "Best Marketing Automation Platforms",
    slug: "marketing-automation",
    description: "Automate email campaigns, nurture leads, and measure marketing ROI. Compare top automation tools like Mailchimp and ActiveCampaign.",
    tools: ["Mailchimp", "ActiveCampaign", "Marketo", "Klaviyo"],
    count: "32+",
  },
  {
    name: "Best Analytics & BI Software",
    slug: "analytics",
    description: "Turn business data into actionable insights with dashboards, reports, and real-time analytics. Compare Tableau, Looker, and Mixpanel.",
    tools: ["Tableau", "Looker", "Mixpanel", "Amplitude"],
    count: "28+",
  },
];

export function TopCategoriesShowcase() {
  return (
    <section className="py-20 md:py-24 bg-muted/30" aria-labelledby="trending-categories-heading">
      <div className="container">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-primary mb-2">Trending Software Categories</p>
          <h2 id="trending-categories-heading" className="text-3xl md:text-4xl font-extrabold text-foreground">
            Most Researched Software Categories in 2026
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Explore the most popular business software categories our users are actively researching, reviewing, and comparing right now.
          </p>
        </motion.header>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {showcaseCategories.map((cat, i) => (
            <motion.article
              key={cat.slug}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link
                to={`/category/${cat.slug}`}
                className="glass-card p-6 group block"
                aria-label={`Explore ${cat.name} — ${cat.count} products reviewed`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                      {cat.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">{cat.count} products reviewed</span>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {cat.description}
                </p>
                <div className="flex flex-wrap gap-1.5" aria-label="Top tools in this category">
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
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
