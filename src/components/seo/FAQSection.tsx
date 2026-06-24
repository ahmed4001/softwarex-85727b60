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
  /** Hide the visible table of contents above the FAQs. */
  hideToc?: boolean;
}

/**
 * Renders an AEO/GEO-optimized FAQ block with FAQPage JSON-LD.
 *  - Visible TOC with anchor jumps to each #faq-q{n} (also opens the <details>).
 *  - Adds `speakable` so voice assistants can quote answers.
 *  - Adds `author` (ReviewHunts) + optional `reviewedBy` for E-E-A-T.
 */
export function FAQSection({
  items,
  title = "Frequently Asked Questions",
  className,
  isEdited,
  editedByName,
  pageUrl,
  hideToc,
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

  // Anchor click → open target <details> + smooth-scroll. Works without JS too
  // (native fragment navigation jumps to the element; <details> just stays closed).
  const handleTocClick = (e: React.MouseEvent<HTMLAnchorElement>, idx: number) => {
    const target = document.getElementById(`faq-q${idx + 1}`) as HTMLDetailsElement | null;
    if (target) {
      e.preventDefault();
      target.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      // Update the URL hash so the link is shareable.
      history.replaceState(null, "", `#faq-q${idx + 1}`);
    }
  };

  return (
    <section className={className ?? "mt-12"} aria-labelledby="faq-heading">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <h2 id="faq-heading" className="text-2xl font-bold mb-6">
        {title}
      </h2>

      {!hideToc && items.length > 1 && (
        <nav
          aria-label="FAQ table of contents"
          className="mb-6 rounded-lg border border-border bg-muted/30 p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            On this page
          </p>
          <ol className="space-y-1.5 list-decimal list-inside marker:text-muted-foreground/60">
            {items.map((item, idx) => (
              <li key={idx} className="text-sm">
                <a
                  href={`#faq-q${idx + 1}`}
                  onClick={(e) => handleTocClick(e, idx)}
                  className="text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                  {item.q}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

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
