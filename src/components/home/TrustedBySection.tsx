import { motion } from "framer-motion";

const brands = [
  "Stripe", "Notion", "Slack", "Figma", "Linear", "Vercel",
  "Shopify", "Atlassian", "HubSpot", "Zendesk", "Intercom", "Airtable",
];

export function TrustedBySection() {
  return (
    <section className="py-16 border-y border-border/30">
      <div className="container">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-10">
          Trusted by teams at leading companies
        </p>
        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
          
          <motion.div
            className="flex items-center gap-16"
            animate={{ x: [0, -1200] }}
            transition={{ duration: 30, ease: "linear", repeat: Infinity }}
          >
            {[...brands, ...brands].map((brand, i) => (
              <span
                key={`${brand}-${i}`}
                className="text-xl font-display font-bold text-muted-foreground/25 whitespace-nowrap select-none flex-shrink-0"
              >
                {brand}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
