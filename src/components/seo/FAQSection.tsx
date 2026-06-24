import { Helmet } from "react-helmet-async";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSectionProps {
  items: FAQItem[];
  title?: string;
  className?: string;
}

/**
 * Renders an AEO/GEO-optimized FAQ block with FAQPage JSON-LD.
 * Both human-visible HTML and machine-extractable schema markup.
 */
export function FAQSection({ items, title = "Frequently Asked Questions", className }: FAQSectionProps) {
  if (!items || items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <section className={className ?? "mt-12"} aria-labelledby="faq-heading">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <h2 id="faq-heading" className="text-2xl font-bold mb-6">
        {title}
      </h2>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <details
            key={idx}
            className="group rounded-lg border border-border bg-card p-4 transition-colors open:bg-muted/30"
          >
            <summary className="cursor-pointer list-none font-semibold flex items-center justify-between gap-4">
              <span>{item.q}</span>
              <span className="text-muted-foreground transition-transform group-open:rotate-45 text-xl leading-none">
                +
              </span>
            </summary>
            <p className="mt-3 text-muted-foreground leading-relaxed whitespace-pre-line">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
