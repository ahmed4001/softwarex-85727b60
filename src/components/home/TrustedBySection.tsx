const brands = [
  "Stripe", "Notion", "Slack", "Figma", "Linear", "Vercel",
  "Shopify", "Atlassian", "HubSpot", "Zendesk", "Intercom", "Airtable",
];

export function TrustedBySection() {
  return (
    <section className="py-10 border-b border-border overflow-hidden">
      <div className="container">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-8">
          Reviewed & compared by teams at
        </p>
      </div>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex animate-marquee gap-x-10 w-max">
          {[...brands, ...brands].map((brand, i) => (
            <span
              key={i}
              className="text-base font-semibold text-muted-foreground/30 select-none whitespace-nowrap"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
