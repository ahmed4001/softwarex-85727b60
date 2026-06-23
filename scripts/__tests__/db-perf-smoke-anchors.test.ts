/**
 * Static-analysis test: every `[label](#anchor)` link the runner emits into
 * the PR comment's "Jump to" TOC must point at a real `#### Heading` we
 * actually render in the same file. Catches typos and renames before they
 * ship dead links to reviewers.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "..", "db-perf-smoke.ts"),
  "utf8",
);

/** GitHub's heading-anchor slug, simplified to what we actually emit. */
function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Extract anchor targets from every `[…](#anchor)` literal in the source. */
function tocAnchors(src: string): string[] {
  const anchors = new Set<string>();
  // Only TOC-style links (skip the runUrl#artifacts deep-links).
  const re = /\[[^\]]+\]\(#([a-z0-9-]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) anchors.add(m[1]);
  return Array.from(anchors);
}

/** Extract every `#### Heading` literal we emit as a markdown heading. */
function headingLiterals(src: string): string[] {
  const out: string[] = [];
  const re = /["']####\s+([^"'\\]+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1].trim());
  return out;
}

function headingSlugs(src: string): string[] {
  return headingLiterals(src).map(slugifyHeading);
}

describe("db-perf-smoke PR comment anchors", () => {
  const anchors = tocAnchors(SOURCE);
  const slugs = new Set(headingSlugs(SOURCE));

  it("source emits at least one TOC link and one heading", () => {
    expect(anchors.length).toBeGreaterThan(0);
    expect(slugs.size).toBeGreaterThan(0);
  });

  it("every TOC anchor resolves to a `#### Heading` in the same file", () => {
    const dangling = anchors.filter((a) => !slugs.has(a));
    expect(
      dangling,
      `Dangling TOC anchors with no matching heading: ${dangling.join(", ")}\n` +
        `Known heading slugs: ${Array.from(slugs).join(", ")}`,
    ).toEqual([]);
  });

  it("covers the documented section anchors", () => {
    // Sanity-check: at minimum these sections must be reachable from the TOC.
    for (const expected of [
      "breaches",
      "coverage-gaps",
      "missing-indexes",
      "active-thresholds",
      "suggested-patch",
    ]) {
      expect(slugs.has(expected), `Missing heading for #${expected}`).toBe(true);
      expect(anchors.includes(expected), `TOC never links to #${expected}`).toBe(true);
    }
  });

  it("no duplicate `#### Heading` literals in the source", () => {
    const headings = headingLiterals(SOURCE);
    const counts = new Map<string, number>();
    for (const h of headings) counts.set(h, (counts.get(h) ?? 0) + 1);
    const dupes = Array.from(counts.entries()).filter(([, n]) => n > 1);
    expect(
      dupes,
      `Duplicate heading literals: ${dupes.map(([h, n]) => `"${h}" ×${n}`).join(", ")}`,
    ).toEqual([]);
  });

  it("no duplicate slugs after normalization (two headings → same anchor)", () => {
    const slugList = headingSlugs(SOURCE);
    const counts = new Map<string, number>();
    for (const s of slugList) counts.set(s, (counts.get(s) ?? 0) + 1);
    const collisions = Array.from(counts.entries()).filter(([, n]) => n > 1);
    expect(
      collisions,
      `Anchor slug collisions (GitHub would suffix -1/-2 and break TOC links): ` +
        collisions.map(([s, n]) => `#${s} ×${n}`).join(", "),
    ).toEqual([]);
  });

  it("every TOC entry is itself unique (no duplicate `[…](#anchor)` links)", () => {
    const re = /\[[^\]]+\]\(#([a-z0-9-]+)\)/g;
    const seen = new Map<string, number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(SOURCE))) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
    // Only flag duplicates that appear inside a literal beginning with
    // "**Jump to:**" — same anchor referenced twice from the TOC line.
    const tocMatch = SOURCE.match(/\*\*Jump to:\*\*[^"`]*?(?=["`])/);
    if (tocMatch) {
      const inToc = Array.from(tocMatch[0].matchAll(/#([a-z0-9-]+)/g)).map((x) => x[1]);
      const tocCounts = new Map<string, number>();
      for (const a of inToc) tocCounts.set(a, (tocCounts.get(a) ?? 0) + 1);
      const tocDupes = Array.from(tocCounts.entries()).filter(([, n]) => n > 1);
      expect(tocDupes, `TOC has duplicate anchors: ${tocDupes.map(([a]) => `#${a}`).join(", ")}`).toEqual([]);
    }
    expect(seen.size).toBeGreaterThan(0);
  });
});
