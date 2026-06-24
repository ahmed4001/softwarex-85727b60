import { test, expect } from "./fixtures/deterministic";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";
import type { Page } from "@playwright/test";

// E2E test: on a page that renders the FAQ TOC, clicking each TOC link
// must:
//   1) update the URL hash to the corresponding #faq-q{n}
//   2) bring the matching <details id="faq-q{n}"> anchor into view
//   3) open the <details> element so the answer is visible

test.afterEach(attachFailureArtifacts);

// Candidate routes that should render an AIFaqBlock with TOC. We try
// them in order and run the assertion suite against the first one that
// actually has >1 FAQ items (TOC only renders when items.length > 1).
const CANDIDATE_LISTS: Array<{ list: string; prefix: string }> = [
  { list: "/products", prefix: "/product/" },
  { list: "/blog", prefix: "/blog/" },
  { list: "/glossary", prefix: "/glossary/" },
  { list: "/compare", prefix: "/compare/" },
];

async function firstDetailHref(
  page: Page,
  listPath: string,
  prefix: string,
): Promise<string | null> {
  const resp = await page.goto(listPath, { waitUntil: "networkidle" });
  if (!resp || resp.status() >= 400) return null;
  await page.waitForTimeout(500);
  return page.evaluate((p) => {
    const re = new RegExp("^" + p.replace(/\//g, "\\/") + "[\\w-]+$");
    for (const a of Array.from(
      document.querySelectorAll<HTMLAnchorElement>(`a[href^="${p}"]`),
    )) {
      const href = a.getAttribute("href") || "";
      if (re.test(href)) return href;
    }
    return null;
  }, prefix);
}

async function waitForFaqToc(page: Page, timeoutMs = 20000): Promise<number> {
  // The TOC is a <nav aria-label="FAQ table of contents"> rendered by
  // FAQSection. AI-generated FAQs may stream in on cold cache; wait for
  // at least 2 items (TOC only shows when items.length > 1).
  const nav = page.locator('nav[aria-label="FAQ table of contents"]');
  try {
    await nav.first().waitFor({ state: "visible", timeout: timeoutMs });
  } catch {
    return 0;
  }
  // Make sure the FAQ section is scrolled into view so subsequent
  // intersection checks aren't fighting a virtualised renderer.
  await nav.first().scrollIntoViewIfNeeded();
  return nav.first().locator("ol > li > a[href^='#faq-q']").count();
}

async function isAnchorInViewport(page: Page, anchorId: string) {
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return { found: false } as const;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    return {
      found: true,
      open: (el as HTMLDetailsElement).open === true,
      // Anchor's top must be inside the viewport (allow small overshoot
      // for sticky headers via scroll-mt-24 ~ 96px). It just needs to
      // be visible, not pinned to the top.
      inView:
        r.bottom > 0 &&
        r.top < vh &&
        r.right > 0 &&
        r.left < vw,
      top: r.top,
      vh,
    } as const;
  }, anchorId);
}

test.describe("FAQ TOC anchors", () => {
  test("clicking each FAQ TOC link updates hash and scrolls anchor into view", async ({
    page,
  }) => {
    // 1. Find a detail page that actually renders the FAQ TOC.
    let target: string | null = null;
    let faqCount = 0;

    for (const c of CANDIDATE_LISTS) {
      const href = await firstDetailHref(page, c.list, c.prefix);
      if (!href) continue;
      const resp = await page.goto(href, { waitUntil: "networkidle" });
      if (!resp || resp.status() >= 400) continue;
      const count = await waitForFaqToc(page, 25000);
      if (count > 1) {
        target = href;
        faqCount = count;
        break;
      }
    }

    test.skip(
      !target || faqCount < 2,
      "no detail page with a multi-item FAQ TOC was discoverable; skipping",
    );

    // Sanity: each TOC link should map to a unique #faq-q{n} anchor.
    const tocLinks = page.locator(
      'nav[aria-label="FAQ table of contents"] ol > li > a[href^="#faq-q"]',
    );
    const total = await tocLinks.count();
    expect(total, "TOC link count matches discovered count").toBe(faqCount);

    for (let i = 0; i < total; i++) {
      const link = tocLinks.nth(i);
      const href = await link.getAttribute("href");
      expect(href, `TOC link[${i}] has href`).toBeTruthy();
      expect(href!).toMatch(/^#faq-q\d+$/);
      const anchorId = href!.slice(1);

      // The anchored <details> must exist in the DOM up front so AI
      // crawlers and direct deep-links can resolve immediately.
      const anchor = page.locator(`#${anchorId}`);
      await expect(
        anchor,
        `anchor element ${anchorId} exists`,
      ).toHaveCount(1);

      // Scroll to top before each click so we can prove the click did
      // the scrolling (not residual position from the previous link).
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(50);

      await link.scrollIntoViewIfNeeded();
      await link.click();

      // The handler calls history.replaceState with the hash.
      await expect
        .poll(() => page.evaluate(() => window.location.hash), {
          timeout: 5000,
          message: `URL hash should become #${anchorId} after click`,
        })
        .toBe(`#${anchorId}`);

      // Allow smooth-scroll + <details> open animations to settle.
      await page.waitForTimeout(450);

      const state = await isAnchorInViewport(page, anchorId);
      expect(state.found, `#${anchorId} is in the DOM`).toBe(true);
      expect(
        state.open,
        `#${anchorId} <details> should be opened by TOC click`,
      ).toBe(true);
      expect(
        state.inView,
        `#${anchorId} should be scrolled into the viewport (top=${
          (state as any).top
        }, vh=${(state as any).vh})`,
      ).toBe(true);
    }
  });
});
