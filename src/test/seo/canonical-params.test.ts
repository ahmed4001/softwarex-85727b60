import { describe, it, expect } from "vitest";
import {
  canonicalPolicyFor,
  isGovernedPath,
  validateParamCanonical,
} from "@/lib/canonical-params";

const SITE = "https://reviewhunts.com";

describe("param canonical policy", () => {
  it("strips query strings from the canonical path", () => {
    expect(canonicalPolicyFor("/compare", "?products=a,b").canonicalPath).toBe("/compare");
    expect(canonicalPolicyFor("/search", "?q=crm&page=2").canonicalPath).toBe("/search");
    expect(canonicalPolicyFor("/compare/").canonicalPath).toBe("/compare");
  });

  it("marks parameterised URLs noindex, follow and bare URLs indexable", () => {
    expect(canonicalPolicyFor("/search", "?q=crm").robots).toBe("noindex, follow");
    expect(canonicalPolicyFor("/compare", "?products=a,b").robots).toBe("noindex, follow");
    expect(canonicalPolicyFor("/search").robots).toBe("index, follow");
    expect(canonicalPolicyFor("/compare", "?q=").robots).toBe("index, follow");
  });

  it("only governs compare and search", () => {
    expect(isGovernedPath("/compare")).toBe(true);
    expect(isGovernedPath("/search")).toBe(true);
    expect(isGovernedPath("/category/crm")).toBe(false);
    expect(canonicalPolicyFor("/category/crm", "?sort=price").robots).toBe("index, follow");
  });
});

describe("validateParamCanonical", () => {
  it("passes a correct parameterised page", () => {
    expect(
      validateParamCanonical({
        url: "/search?q=crm",
        canonical: `${SITE}/search`,
        ogUrl: `${SITE}/search`,
        robots: "noindex, follow",
        siteUrl: SITE,
      }),
    ).toEqual([]);
  });

  it("flags a canonical that keeps the query string", () => {
    const v = validateParamCanonical({
      url: "/compare?products=a,b",
      canonical: `${SITE}/compare?products=a,b`,
      robots: "noindex, follow",
      siteUrl: SITE,
    });
    expect(v.map((x) => x.tag)).toContain("canonical");
  });

  it("flags an indexable parameterised page", () => {
    const v = validateParamCanonical({
      url: "/search?q=crm",
      canonical: `${SITE}/search`,
      robots: "index, follow",
      siteUrl: SITE,
    });
    expect(v).toHaveLength(1);
    expect(v[0].tag).toBe("robots");
  });

  it("flags a missing canonical and a cross-path canonical", () => {
    expect(
      validateParamCanonical({ url: "/search?q=x", canonical: "", robots: "noindex, follow", siteUrl: SITE }),
    ).toHaveLength(1);
    expect(
      validateParamCanonical({
        url: "/compare?products=a",
        canonical: `${SITE}/`,
        robots: "noindex, follow",
        siteUrl: SITE,
      }),
    ).toHaveLength(1);
  });

  it("ignores non-governed routes", () => {
    expect(
      validateParamCanonical({
        url: "/blog?page=2",
        canonical: `${SITE}/blog?page=2`,
        robots: "index, follow",
        siteUrl: SITE,
      }),
    ).toEqual([]);
  });
});
