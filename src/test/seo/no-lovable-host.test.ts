import { describe, it, expect } from "vitest";
import { canonicalFor, SITE_URL } from "@/lib/seo-canonical";

describe("canonical never leaks Lovable preview hosts", () => {
  it("ignores softwarex.lovable.app override and falls back to SITE_URL", () => {
    expect(canonicalFor("/foo", "https://softwarex.lovable.app/foo")).toBe(
      `${SITE_URL}/foo`,
    );
  });

  it("ignores id-preview lovable.app override", () => {
    expect(
      canonicalFor("/bar", "https://id-preview--abc.lovable.app/bar"),
    ).toBe(`${SITE_URL}/bar`);
  });

  it("honors non-Lovable overrides", () => {
    expect(canonicalFor("/x", "https://reviewhunts.com/x")).toBe(
      "https://reviewhunts.com/x",
    );
  });
});
