// SEO regression: render SeoHead under HelmetProvider for representative
// "key route" configs and assert the resolved <head> output.
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { HelmetProvider, type FilledContext } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";

function renderSeo(ui: React.ReactNode) {
  cleanup();
  const helmetContext: Partial<FilledContext> = {};
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider context={helmetContext}>
        <MemoryRouter>{ui}</MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
  const helmet = (helmetContext as FilledContext).helmet;
  const linkStr = helmet.link.toString();
  const metaStr = helmet.meta.toString();
  const titleStr = helmet.title.toString();
  const scriptStr = helmet.script.toString();
  return { helmet, linkStr, metaStr, titleStr, scriptStr };
}

function canonicalsIn(linkStr: string): string[] {
  return [...linkStr.matchAll(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/g)].map((m) => m[1]);
}
function jsonLdBlocks(scriptStr: string): any[] {
  return [...scriptStr.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean);
}

describe("SeoHead — Home route", () => {
  it("emits title, description, single self-referencing canonical, og:*", () => {
    const { titleStr, metaStr, linkStr } = renderSeo(
      <SeoHead
        title="Discover the best software"
        description="Real user reviews, AI-powered insights, and curated buyer guides."
        canonicalUrl="https://reviewhunts.com/"
      />,
    );
    expect(titleStr).toMatch(/<title[^>]*>[^<]*Discover the best software/);
    expect(metaStr).toMatch(/name=["']description["'][^>]*content=["'][^"']+/);
    const cans = canonicalsIn(linkStr);
    expect(cans).toHaveLength(1);
    expect(cans[0]).toBe("https://reviewhunts.com/");
    expect(metaStr).toMatch(/property=["']og:title["']/);
    expect(metaStr).toMatch(/property=["']og:description["']/);
    expect(metaStr).toMatch(/property=["']og:url["'][^>]*content=["']https:\/\/reviewhunts\.com\/["']/);
    expect(metaStr).toMatch(/name=["']twitter:card["'][^>]*content=["']summary_large_image["']/);
  });
});

describe("SeoHead — Blog index route (CollectionPage + Blog JSON-LD)", () => {
  it("emits Blog and CollectionPage JSON-LD blocks", () => {
    const blogJsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "Blog",
        url: "https://reviewhunts.com/blog",
        blogPost: [{ "@type": "BlogPosting", headline: "Hello", url: "https://reviewhunts.com/blog/hello" }],
      },
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Blog",
        url: "https://reviewhunts.com/blog",
      },
    ];
    const { scriptStr } = renderSeo(
      <SeoHead title="Blog" description="Articles." canonicalUrl="https://reviewhunts.com/blog" jsonLd={blogJsonLd} />,
    );
    const blocks = jsonLdBlocks(scriptStr);
    const types = blocks.map((b) => b["@type"]);
    expect(types).toContain("Blog");
    expect(types).toContain("CollectionPage");
  });
});

describe("SeoHead — Product route (SoftwareApplication + BreadcrumbList + FAQPage)", () => {
  it("emits all expected schemas and a product-specific canonical", () => {
    const productJsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Acme CRM",
        applicationCategory: "BusinessApplication",
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.5", bestRating: "5", ratingCount: 12 },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://reviewhunts.com" },
          { "@type": "ListItem", position: 2, name: "Acme CRM" },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "Does it integrate?", acceptedAnswer: { "@type": "Answer", text: "Yes." } },
        ],
      },
    ];
    const { scriptStr, linkStr, metaStr } = renderSeo(
      <SeoHead
        title="Acme CRM reviews"
        description="Real users review Acme CRM."
        canonicalUrl="https://reviewhunts.com/product/acme-crm"
        type="product"
        jsonLd={productJsonLd}
      />,
    );
    const blocks = jsonLdBlocks(scriptStr);
    const types = blocks.map((b) => b["@type"]);
    expect(types).toEqual(expect.arrayContaining(["SoftwareApplication", "BreadcrumbList", "FAQPage"]));
    // SoftwareApplication has rating
    const sw = blocks.find((b) => b["@type"] === "SoftwareApplication");
    expect(sw.aggregateRating.ratingValue).toBe("4.5");
    // Canonical points to the product
    expect(canonicalsIn(linkStr)).toEqual(["https://reviewhunts.com/product/acme-crm"]);
    // og:type respects override
    expect(metaStr).toMatch(/property=["']og:type["'][^>]*content=["']product["']/);
  });
});

describe("SeoHead — falls back to a self-referencing canonical", () => {
  it("when canonicalUrl is omitted, derives from window.location", () => {
    // jsdom default origin is http://localhost
    const { linkStr } = renderSeo(<SeoHead title="Some page" description="x" />);
    const cans = canonicalsIn(linkStr);
    expect(cans).toHaveLength(1);
    expect(cans[0]).toMatch(/^http:\/\/localhost\//);
  });
});

describe("SeoHead — JSON-LD blocks must be valid JSON", () => {
  it("each script tag parses cleanly", () => {
    const { scriptStr } = renderSeo(
      <SeoHead
        title="t"
        description="d"
        jsonLd={[{ "@context": "https://schema.org", "@type": "WebPage", name: "x" }]}
      />,
    );
    const blocks = jsonLdBlocks(scriptStr);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b["@context"]).toBe("https://schema.org");
  });
});
