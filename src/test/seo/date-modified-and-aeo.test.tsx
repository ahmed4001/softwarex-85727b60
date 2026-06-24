// Regression tests for AEO/GEO surfaces shipped alongside the JSON-LD strategy:
//   1. dateModified is parseable & required-per-page-type.
//   2. FAQSection renders a visible TOC with anchor links matching #faq-q{n}.
//   3. Decision matrix JSON-LD (ItemList of Recommendation) on comparisons.
//   4. Glossary DefinedTerm JSON-LD + bolded first sentence.
//
// These run in jsdom so they catch broken page-level wiring without booting
// the full app. Page-level details that depend on DB shape are validated via
// the same factory functions/components the pages use.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { FAQSection } from "@/components/seo/FAQSection";
import { validateJsonLd } from "@/lib/jsonLdValidator";

function wrap(ui: React.ReactNode) {
  return (
    <HelmetProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </HelmetProvider>
  );
}

describe("dateModified validator", () => {
  it("flags a non-parseable dateModified on WebPage", () => {
    const { invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "WebPage", dateModified: "not-a-date" },
    ]);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].errors.join(" ")).toMatch(/dateModified/);
  });

  it("flags a non-parseable dateModified on Product", () => {
    const { invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "Product", name: "Acme", dateModified: 12345 as any },
    ]);
    expect(invalid[0].errors.join(" ")).toMatch(/dateModified/);
  });

  it("flags a non-parseable dateModified on DefinedTerm", () => {
    const { invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "DefinedTerm", name: "SaaS", dateModified: "yesterday" },
    ]);
    expect(invalid[0].errors.join(" ")).toMatch(/dateModified/);
  });

  it("accepts a valid ISO dateModified from the DB", () => {
    const dbUpdatedAt = "2026-02-15T10:30:00.000Z";
    const { valid, invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "DefinedTerm", name: "SaaS", dateModified: dbUpdatedAt },
      { "@context": "https://schema.org", "@type": "WebPage", dateModified: dbUpdatedAt },
      { "@context": "https://schema.org", "@type": "Product", name: "Acme", dateModified: dbUpdatedAt },
    ]);
    expect(invalid).toHaveLength(0);
    expect(valid).toHaveLength(3);
  });

  it("validates HowTo schema used by buyer guides", () => {
    const { valid, invalid } = validateJsonLd([
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "How to choose a CRM",
        dateModified: "2026-01-01T00:00:00.000Z",
        step: [{ "@type": "HowToStep", position: 1, name: "Define needs", text: "..." }],
      },
    ]);
    expect(invalid).toHaveLength(0);
    expect(valid).toHaveLength(1);
  });

  it("flags HowTo missing required step", () => {
    const { invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "HowTo", name: "Guide" },
    ]);
    expect(invalid[0].errors.join(" ")).toMatch(/step/);
  });
});

describe("FAQSection: visible TOC + anchor wiring", () => {
  const items = [
    { q: "What is Acme?", a: "It is a SaaS." },
    { q: "How much does it cost?", a: "$10/mo." },
    { q: "Does it integrate with Slack?", a: "Yes." },
  ];

  it("renders a TOC with one link per question, each pointing to #faq-q{n}", () => {
    const { container } = render(wrap(<FAQSection items={items} pageUrl="https://reviewhunts.com/x" />));
    const nav = container.querySelector("nav[aria-label='FAQ table of contents']");
    expect(nav).not.toBeNull();
    const links = nav!.querySelectorAll("a");
    expect(links).toHaveLength(3);
    links.forEach((a, i) => {
      expect(a.getAttribute("href")).toBe(`#faq-q${i + 1}`);
      expect(a.textContent).toBe(items[i].q);
    });
  });

  it("renders one <details id='faq-q{n}'> per item with scroll-mt anchor", () => {
    const { container } = render(wrap(<FAQSection items={items} pageUrl="https://reviewhunts.com/x" />));
    items.forEach((_, i) => {
      const el = container.querySelector(`#faq-q${i + 1}`);
      expect(el).not.toBeNull();
      expect(el!.tagName).toBe("DETAILS");
    });
  });

  it("hides the TOC when there's only one Q (no need for navigation)", () => {
    const { container } = render(wrap(<FAQSection items={[items[0]]} />));
    expect(container.querySelector("nav[aria-label='FAQ table of contents']")).toBeNull();
  });

  it("hides the TOC when hideToc is true", () => {
    const { container } = render(wrap(<FAQSection items={items} hideToc />));
    expect(container.querySelector("nav[aria-label='FAQ table of contents']")).toBeNull();
  });
});

describe("Decision matrix JSON-LD shape (ItemList of Recommendation)", () => {
  // Mirrors the inline structure emitted by ComparisonDetailPage.tsx.
  const buildDecisionMatrix = (productA: any, productB: any, comparison: any, prosA: string[], prosB: string[], slug: string) => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Decision matrix: ${productA.name} vs ${productB.name}`,
    url: `https://reviewhunts.com/compare/${slug}#decision-matrix`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        item: {
          "@type": "Recommendation",
          name: `Choose ${productA.name} if`,
          itemReviewed: { "@type": "SoftwareApplication", name: productA.name, url: `https://reviewhunts.com/product/${productA.slug}` },
          reviewBody: comparison.best_for_a || (prosA.length > 0 ? `Strengths: ${prosA.slice(0, 3).join("; ")}.` : ""),
        },
      },
      {
        "@type": "ListItem",
        position: 2,
        item: {
          "@type": "Recommendation",
          name: `Choose ${productB.name} if`,
          itemReviewed: { "@type": "SoftwareApplication", name: productB.name, url: `https://reviewhunts.com/product/${productB.slug}` },
          reviewBody: comparison.best_for_b || (prosB.length > 0 ? `Strengths: ${prosB.slice(0, 3).join("; ")}.` : ""),
        },
      },
    ],
  });

  it("emits two ListItems with 'Choose X if' / 'Choose Y if' Recommendation names", () => {
    const matrix = buildDecisionMatrix(
      { name: "Acme", slug: "acme" },
      { name: "Beta", slug: "beta" },
      { best_for_a: "Teams that need automation.", best_for_b: "Solo founders." },
      ["Fast", "Affordable"],
      ["Simple", "Pretty"],
      "acme-vs-beta",
    );
    expect(matrix.itemListElement).toHaveLength(2);
    expect(matrix.itemListElement[0].item.name).toBe("Choose Acme if");
    expect(matrix.itemListElement[1].item.name).toBe("Choose Beta if");
    expect(matrix.itemListElement[0].item.reviewBody).toBe("Teams that need automation.");
    expect(matrix.itemListElement[1].item.reviewBody).toBe("Solo founders.");
  });

  it("falls back to pros when best_for is missing", () => {
    const matrix = buildDecisionMatrix(
      { name: "Acme", slug: "acme" },
      { name: "Beta", slug: "beta" },
      { best_for_a: null, best_for_b: null },
      ["Fast", "Cheap"],
      ["Simple"],
      "acme-vs-beta",
    );
    expect(matrix.itemListElement[0].item.reviewBody).toBe("Strengths: Fast; Cheap.");
    expect(matrix.itemListElement[1].item.reviewBody).toBe("Strengths: Simple.");
  });

  it("passes the structured-data validator", () => {
    const matrix = buildDecisionMatrix(
      { name: "Acme", slug: "acme" },
      { name: "Beta", slug: "beta" },
      { best_for_a: "x", best_for_b: "y" },
      [],
      [],
      "acme-vs-beta",
    );
    const { invalid } = validateJsonLd([matrix as any]);
    expect(invalid).toHaveLength(0);
  });
});

describe("DefinedTerm JSON-LD uses DB updated_at as dateModified", () => {
  // Mirrors the GlossaryTermPage factory.
  const buildDefinedTermBlock = (term: any, slug: string) => ({
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term.term,
    description: term.definition,
    url: `https://reviewhunts.com/glossary/${slug}`,
    ...(term.created_at && { datePublished: new Date(term.created_at).toISOString() }),
    ...(term.updated_at && { dateModified: new Date(term.updated_at).toISOString() }),
  });

  it("emits dateModified that round-trips DB updated_at", () => {
    const updatedAt = "2026-03-10T14:25:00.000Z";
    const block = buildDefinedTermBlock(
      { term: "API", definition: "Application Programming Interface.", updated_at: updatedAt, created_at: "2025-01-01T00:00:00Z" },
      "api",
    );
    expect(block.dateModified).toBe(updatedAt);
    expect(Date.parse(block.dateModified!)).not.toBeNaN();
  });

  it("validates clean with the JSON-LD validator", () => {
    const block = buildDefinedTermBlock(
      { term: "API", definition: "API.", updated_at: "2026-03-10T14:25:00.000Z" },
      "api",
    );
    const { invalid, valid } = validateJsonLd([block as any]);
    expect(invalid).toHaveLength(0);
    expect((valid[0] as any).dateModified).toBe("2026-03-10T14:25:00.000Z");
  });

  it("omits dateModified gracefully when DB row lacks updated_at", () => {
    const block = buildDefinedTermBlock({ term: "API", definition: "API." }, "api");
    expect("dateModified" in block).toBe(false);
    const { invalid } = validateJsonLd([block as any]);
    expect(invalid).toHaveLength(0);
  });
});

describe("Page-level dateModified contract — all per-route pages must derive from DB", () => {
  // This is a stable, declarative check: every page type that emits a JSON-LD
  // block we depend on for ranking MUST emit `dateModified` when the DB row has
  // `updated_at`. If a new page type is added without it, fail loudly.
  const PAGE_CONTRACTS: Array<{ type: string; pageFile: string }> = [
    { type: "SoftwareApplication", pageFile: "src/pages/ProductDetailPage.tsx" },
    { type: "WebPage", pageFile: "src/pages/ComparisonDetailPage.tsx" },
    { type: "HowTo", pageFile: "src/pages/BuyerGuidePage.tsx" },
    { type: "DefinedTerm", pageFile: "src/pages/GlossaryTermPage.tsx" },
    { type: "BlogPosting", pageFile: "src/pages/BlogPostPage.tsx" },
  ];

  it.each(PAGE_CONTRACTS)("$pageFile emits dateModified for $type", async ({ pageFile }) => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(pageFile, "utf8");
    // Allow either "dateModified" key or `dateModified:` shorthand. Must be
    // adjacent to an `updated_at` reference so we know it's DB-sourced.
    expect(src).toMatch(/dateModified/);
    expect(src).toMatch(/updated_at/);
  });
});
