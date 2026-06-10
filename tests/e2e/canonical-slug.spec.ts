import { test, expect } from "./fixtures/deterministic";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";
import type { Page } from "@playwright/test";

// Canonical URLs on detail pages MUST point at exactly the route the
// user is on — same slug, no `?category=`, `?page=`, or any other
// filter/pagination state leaking into the canonical. A drifted
// canonical de-duplicates the wrong page in Google's index.

test.afterEach(attachFailureArtifacts);

async function readCanonical(page: Page) {
  return page.evaluate(() => {
    const links = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'),
    );
    return {
      count: links.length,
      hrefs: links.map((l) => l.href),
      ogUrl:
        document.head
          .querySelector('meta[property="og:url"]')
          ?.getAttribute("content") || "",
    };
  });
}

async function findFirstDetailHref(page: Page, listPath: string, prefix: string) {
  await page.goto(listPath, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  return page.evaluate(({ prefix }) => {
    const re = new RegExp("^" + prefix.replace(/[/]/g, "\\/") + "[\\w-]+$");
    const link = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(`a[href^="${prefix}"]`),
    )
      .map((a) => a.getAttribute("href") || "")
      .find((h) => re.test(h));
    return link || null;
  }, { prefix });
}

function assertCanonicalMatchesSlug(opts: {
  canonical: string;
  expectedPath: string; // e.g. "/product/acme-crm"
  expectedSlug: string; // e.g. "acme-crm"
  routePrefix: string; // e.g. "/product/"
}) {
  const { canonical, expectedPath, expectedSlug, routePrefix } = opts;
  expect(canonical, "canonical href present").toBeTruthy();
  expect(canonical, "canonical absolute").toMatch(/^https?:\/\//);

  const u = new URL(canonical);
  expect(u.pathname, `canonical pathname must be ${expectedPath}`).toBe(expectedPath);

  // No query params allowed — canonicals must never carry pagination
  // (`?page=`) or filter state (`?category=`, `?sort=`, `?q=`).
  expect(u.search, `canonical must not include query string (got "${u.search}")`).toBe("");
  expect(u.hash, "canonical must not include fragment").toBe("");

  // Slug position check — guards against a canonical that drifted to
  // a sibling slug (e.g. wrong category, neighbouring blog post).
  const slugFromPath = u.pathname.slice(routePrefix.length);
  expect(slugFromPath, `canonical slug must equal "${expectedSlug}"`).toBe(expectedSlug);
}

test.describe("Detail-page canonical slug correctness", () => {
  test("product detail canonical matches its slug and has no query state", async ({ page }) => {
    const detailHref = await findFirstDetailHref(page, "/products", "/product/");
    test.skip(!detailHref, "no product link discovered on /products");

    const slug = detailHref!.replace(/^\/product\//, "");

    // Visit with extra junk query params to make sure the page doesn't
    // echo them into the canonical.
    await page.goto(`${detailHref}?page=3&category=crm&utm_source=test`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(600);

    const snap = await readCanonical(page);
    expect(snap.count, "exactly one canonical").toBe(1);

    assertCanonicalMatchesSlug({
      canonical: snap.hrefs[0],
      expectedPath: `/product/${slug}`,
      expectedSlug: slug,
      routePrefix: "/product/",
    });

    // og:url must track the canonical exactly.
    expect(snap.ogUrl, "og:url tracks canonical").toBe(snap.hrefs[0]);
  });

  test("blog detail canonical matches its slug and has no pagination", async ({ page }) => {
    const detailHref = await findFirstDetailHref(page, "/blog", "/blog/");
    test.skip(!detailHref, "no blog link discovered on /blog");

    const slug = detailHref!.replace(/^\/blog\//, "");

    await page.goto(`${detailHref}?page=2&tag=engineering&utm_campaign=test`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(600);

    const snap = await readCanonical(page);
    expect(snap.count, "exactly one canonical").toBe(1);

    assertCanonicalMatchesSlug({
      canonical: snap.hrefs[0],
      expectedPath: `/blog/${slug}`,
      expectedSlug: slug,
      routePrefix: "/blog/",
    });

    expect(snap.ogUrl, "og:url tracks canonical").toBe(snap.hrefs[0]);
  });
});
