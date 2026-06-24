import { Helmet } from "react-helmet-async";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSectionProps {
  items: FAQItem[];
  title?: string;
  className?: string;
  /** When true, mark FAQ as edited by a human reviewer in JSON-LD. */
  isEdited?: boolean;
  /** Optional reviewer display name (paired with isEdited). */
  editedByName?: string;
  /** Canonical page URL — used to namespace question anchors for citations. */
  pageUrl?: string;
}

/**
 * Renders an AEO/GEO-optimized FAQ block with FAQPage JSON-LD.
 *  - Adds `speakable` so voice assistants can quote answers.
 *  - Adds `author` (ReviewHunts) + optional `reviewedBy` for E-E-A-T.
 *  - Anchor-links every Q (#faq-q{n}) so AI engines can deep-link citations.
 */
export function FAQSection({
  items,
  title = "Frequently Asked Questions",
  className,
  isEdited,
  editedByName,
  pageUrl,
}: FAQSectionProps) {
  if (!items || items.length === 0) return null;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(pageUrl ? { url: pageUrl } : {}),
    author: {
      "@type": "Organization",
      name: "ReviewHunts",
      url: "https://reviewhunts.com",
    },
    ...(isEdited
      ? {
          reviewedBy: {
            "@type": "Person",
            name: editedByName || "ReviewHunts Editor",
          },
        }
      : {}),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["[data-speakable='faq-question']", "[data-speakable='faq-answer']"],
    },
    mainEntity: items.map((item, idx) => ({
      "@type": "Question",
      "@id": pageUrl ? `${pageUrl}#faq-q${idx + 1}` : undefined,
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
            id={`faq-q${idx + 1}`}
            className="group rounded-lg border border-border bg-card p-4 transition-colors open:bg-muted/30 scroll-mt-24"
          >
            <summary
              data-speakable="faq-question"
              className="cursor-pointer list-none font-semibold flex items-center justify-between gap-4"
            >
              <span>{item.q}</span>
              <span className="text-muted-foreground transition-transform group-open:rotate-45 text-xl leading-none">
                +
              </span>
            </summary>
            <p
              data-speakable="faq-answer"
              className="mt-3 text-muted-foreground leading-relaxed whitespace-pre-line"
            >
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
