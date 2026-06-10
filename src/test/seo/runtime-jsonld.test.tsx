// Runtime JSON-LD validator: invalid blocks are dropped from <head>
// and logged. Valid blocks pass through unchanged.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { validateJsonLd } from "@/lib/jsonLdValidator";

afterEach(() => {
  cleanup();
  document.head
    .querySelectorAll(
      "[data-rh],title,meta[name],meta[property],link[rel=canonical],script[type='application/ld+json']",
    )
    .forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe("validateJsonLd (pure)", () => {
  it("flags FAQPage missing mainEntity", () => {
    const { valid, invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "FAQPage" },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid[0].errors.join(" ")).toMatch(/mainEntity/);
  });

  it("flags BlogPosting missing required fields", () => {
    const { invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "BlogPosting" },
    ]);
    expect(invalid[0].errors.length).toBeGreaterThanOrEqual(3);
  });

  it("flags SoftwareApplication aggregateRating without ratingValue", () => {
    const { invalid } = validateJsonLd([
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "x",
        aggregateRating: { "@type": "AggregateRating", ratingCount: 5 },
      },
    ]);
    expect(invalid[0].errors.join(" ")).toMatch(/ratingValue/);
  });

  it("passes well-formed blocks through", () => {
    const { valid, invalid } = validateJsonLd([
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } },
        ],
      },
    ]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });
});

async function renderHead(ui: React.ReactNode) {
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
}

describe("SeoHead runtime validation", () => {
  it("drops invalid JSON-LD from <head> and keeps valid blocks", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderHead(
      <SeoHead
        title="t"
        description="d"
        canonicalUrl="https://reviewhunts.com/x"
        jsonLd={[
          // invalid: missing required fields
          { "@context": "https://schema.org", "@type": "BlogPosting" },
          // valid
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              { "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } },
            ],
          },
        ]}
      />,
    );

    const scripts = Array.from(
      document.head.querySelectorAll("script[type='application/ld+json']"),
    )
      .map((s) => {
        try { return JSON.parse(s.textContent || ""); } catch { return null; }
      })
      .filter(Boolean);

    expect(scripts).toHaveLength(1);
    expect((scripts[0] as any)["@type"]).toBe("FAQPage");
    // Logged exactly once (jsdom default host -> "development", so console.error path)
    expect(err.mock.calls.length + warn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not log when all JSON-LD blocks are valid", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderHead(
      <SeoHead
        title="t"
        description="d"
        canonicalUrl="https://reviewhunts.com/x"
        jsonLd={[{ "@context": "https://schema.org", "@type": "WebPage", name: "x" }]}
      />,
    );

    expect(warn).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });
});
