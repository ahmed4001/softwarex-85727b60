import { describe, it, expect } from "vitest";
import { validateJsonLd } from "@/lib/jsonLdValidator";
import { validateOgTags } from "@/lib/ogTagValidator";

describe("Review schema validator", () => {
  it("flags missing reviewRating", () => {
    const { invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "Review", author: "x", itemReviewed: { "@type": "Product", name: "p" } },
    ]);
    expect(invalid[0].errors.join(" ")).toMatch(/reviewRating/);
  });

  it("flags ratingValue above bestRating", () => {
    const { invalid } = validateJsonLd([{
      "@context": "https://schema.org", "@type": "Review", author: "x",
      itemReviewed: { "@type": "Product", name: "p" },
      reviewRating: { "@type": "Rating", ratingValue: 6, bestRating: 5 },
    }]);
    expect(invalid[0].errors.join(" ")).toMatch(/exceeds bestRating/);
  });

  it("passes a well-formed Review", () => {
    const { valid } = validateJsonLd([{
      "@context": "https://schema.org", "@type": "Review", author: "x",
      itemReviewed: { "@type": "Product", name: "p" },
      reviewRating: { "@type": "Rating", ratingValue: 4, bestRating: 5 },
    }]);
    expect(valid).toHaveLength(1);
  });
});

describe("Dataset schema validator", () => {
  it("flags short description and missing creator", () => {
    const { invalid } = validateJsonLd([
      { "@context": "https://schema.org", "@type": "Dataset", name: "d", description: "too short" },
    ]);
    const msg = invalid[0].errors.join(" ");
    expect(msg).toMatch(/≥50 chars/);
    expect(msg).toMatch(/creator or publisher/);
  });

  it("passes well-formed Dataset", () => {
    const { valid } = validateJsonLd([{
      "@context": "https://schema.org", "@type": "Dataset",
      name: "d",
      description: "A comprehensive dataset containing several thousand rows of test data for validation.",
      creator: { "@type": "Organization", name: "x" },
      url: "https://example.com/d",
    }]);
    expect(valid).toHaveLength(1);
  });
});

describe("OG tag validator", () => {
  const base = {
    "og:title": "Bean There Coffee — Specialty Roastery",
    "og:description": "Small-batch specialty coffee roasted in Portland. Order beans, find our cafés, book a tasting today.",
    "og:type": "website",
    "og:url": "https://reviewhunts.com/",
    "twitter:card": "summary",
  };

  it("passes minimum well-formed tags", () => {
    expect(validateOgTags({ tags: base })).toEqual([]);
  });

  it("flags missing required tags", () => {
    const errs = validateOgTags({ tags: { "og:title": "x" } });
    expect(errs.join(" ")).toMatch(/og:description/);
    expect(errs.join(" ")).toMatch(/og:url/);
    expect(errs.join(" ")).toMatch(/twitter:card/);
  });

  it("flags summary_large_image without og:image", () => {
    const errs = validateOgTags({ tags: { ...base, "twitter:card": "summary_large_image" } });
    expect(errs.join(" ")).toMatch(/requires og:image/);
  });

  it("flags cross-host og:url when expectedHost is set", () => {
    const errs = validateOgTags(
      { tags: { ...base, "og:url": "https://other.com/x" } },
      { expectedHost: "reviewhunts.com" },
    );
    expect(errs.join(" ")).toMatch(/host other.com/);
  });

  it("flags non-https og:image", () => {
    const errs = validateOgTags({
      tags: { ...base, "twitter:card": "summary_large_image", "og:image": "http://reviewhunts.com/x.png" },
    });
    expect(errs.join(" ")).toMatch(/absolute https/);
  });
});
