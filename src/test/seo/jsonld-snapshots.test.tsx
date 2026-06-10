// JSON-LD snapshot tests — render SeoHead with representative inputs for
// FAQPage, BlogPosting, and Product/SoftwareApplication and snapshot the
// serialized blocks. Any drift in our generated schema fails CI until the
// snapshot is intentionally updated (`bunx vitest -u src/test/seo`).
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";

afterEach(() => {
  cleanup();
  document.head
    .querySelectorAll(
      "[data-rh],title,meta[name],meta[property],link[rel=canonical],script[type='application/ld+json']",
    )
    .forEach((el) => el.remove());
});

async function renderAndCaptureJsonLd(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
  });
  await new Promise((r) => setTimeout(r, 50));
  await act(async () => { await Promise.resolve(); });
  return Array.from(
    document.head.querySelectorAll("script[type='application/ld+json']"),
  ).map((s) => JSON.parse(s.textContent || "null"));
}

describe("JSON-LD snapshots", () => {
  it("FAQPage snapshot", async () => {
    const blocks = await renderAndCaptureJsonLd(
      <SeoHead
        title="Acme CRM FAQ"
        description="Frequently asked questions about Acme CRM."
        canonicalUrl="https://reviewhunts.com/product/acme-crm"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Does Acme CRM integrate with Slack?",
              acceptedAnswer: { "@type": "Answer", text: "Yes, via the official Slack app." },
            },
            {
              "@type": "Question",
              name: "Is there a free tier?",
              acceptedAnswer: { "@type": "Answer", text: "Yes, up to 3 seats." },
            },
          ],
        }}
      />,
    );
    expect(blocks).toMatchSnapshot();
  });

  it("BlogPosting snapshot", async () => {
    const blocks = await renderAndCaptureJsonLd(
      <SeoHead
        title="How we ship faster"
        description="Engineering notes."
        canonicalUrl="https://reviewhunts.com/blog/how-we-ship-faster"
        type="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: "How we ship faster",
          description: "Engineering notes.",
          author: { "@type": "Person", name: "Jane Doe" },
          datePublished: "2026-01-01T00:00:00.000Z",
          dateModified: "2026-01-02T00:00:00.000Z",
          image: "https://reviewhunts.com/og/how-we-ship-faster.png",
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": "https://reviewhunts.com/blog/how-we-ship-faster",
          },
          publisher: {
            "@type": "Organization",
            name: "ReviewHunts",
            logo: { "@type": "ImageObject", url: "https://reviewhunts.com/logo.png" },
          },
        }}
      />,
    );
    expect(blocks).toMatchSnapshot();
  });

  it("SoftwareApplication (Product) snapshot", async () => {
    const blocks = await renderAndCaptureJsonLd(
      <SeoHead
        title="Acme CRM reviews"
        description="Real user reviews of Acme CRM."
        canonicalUrl="https://reviewhunts.com/product/acme-crm"
        type="product"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Acme CRM",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://reviewhunts.com/product/acme-crm",
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.5",
            bestRating: "5",
            ratingCount: 128,
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        }}
      />,
    );
    expect(blocks).toMatchSnapshot();
  });
});
