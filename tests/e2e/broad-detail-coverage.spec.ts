import { test, expect } from "./fixtures/deterministic";
import { attachFailureArtifacts } from "./fixtures/failure-artifacts";
import type { Page } from "@playwright/test";

// Broad pre-merge coverage: instead of validating only the *first*
// product/blog detail page discovered, walk the first N links in each
// listing and assert canonical + JSON-LD on every one. This catches
// regressions that only show up on a subset of detail routes (e.g.
// a single category's products emitting a broken Product schema, or
// a specific blog template missing BlogPosting fields).

const MAX_PRODUCTS = Number(process.env.SEO_BROAD_PRODUCT_COUNT || 5);
const MAX_BLOGS = Number(process.env.SEO_BROAD_BLOG_COUNT || 5);

test.afterEach(attachFailureArtifacts);

async function collectDetailHrefs(
  page: Page,
  listPath: string,
  prefix: string,
  max: number,
): Promise<string[]> {
  await page.goto(listPath, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  return page.evaluate(
    ({ prefix, max }) => {
      const re = new RegExp("^" + prefix.replace(/\//g, "\\/") + "[\\w-]+$");
      const seen = new Set<string>();
      for (const a of Array.from(
        document.querySelectorAll<HTMLAnchorElement>(`a[href^="${prefix}"]`),
      )) {
        const href = a.getAttribute("href") || "";
        if (re.test(href)) seen.add(href);
        if (seen.size >= max) break;
      }
      return Array.from(seen);
    },
    { prefix, max },
  );
}

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

async function readJsonLdBlocks(page: Page): Promise<any[]> {
  const raw = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]',
      ),
    ).map((s) => s.textContent || ""),
  );
  const flat: any[] = [];
  for (const text of raw) {
    if (!text.trim()) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON-LD payload: ${String(e)}`);
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    for (const b of arr) flat.push(b);
  }
  return flat;
}

function assertCanonicalSlug(
  hrefs: string[],
  ogUrl: string,
  expectedPath: string,
) {
  expect(hrefs.length, "exactly one canonical").toBe(1);
  const c = hrefs[0];
  expect(c, "canonical absolute").toMatch(/^https?:\/\//);
  const u = new URL(c);
  expect(u.pathname, `canonical pathname must be ${expectedPath}`).toBe(
    expectedPath,
  );
  expect(u.search, "canonical must not include query string").toBe("");
  expect(u.hash, "canonical must not include fragment").toBe("");
  expect(ogUrl, "og:url tracks canonical").toBe(c);
}

function assertProductSchema(blocks: any[], expectedPath: string) {
  const product = blocks.find(
    (b) => b?.["@type"] === "Product" || b?.["@type"] === "SoftwareApplication",
  );
  expect(
    product,
    `Product/SoftwareApplication JSON-LD required on ${expectedPath}`,
  ).toBeTruthy();
  expect(product.name, "Product.name required").toBeTruthy();
  const ar = product.aggregateRating;
  if (ar) {
    expect(ar["@type"]).toBe("AggregateRating");
    expect(ar.ratingValue, "ratingValue required when aggregateRating set")
      .toBeDefined();
  }
}

function assertBlogPostingSchema(blocks: any[], expectedPath: string) {
  const post = blocks.find((b) => b?.["@type"] === "BlogPosting");
  expect(post, `BlogPosting JSON-LD required on ${expectedPath}`).toBeTruthy();
  expect(post.headline, "headline required").toBeTruthy();
  expect(post.author, "author required").toBeTruthy();
  expect(post.datePublished, "datePublished required").toBeTruthy();
  expect(
    Number.isNaN(Date.parse(post.datePublished)),
    `datePublished must parse (${post.datePublished})`,
  ).toBe(false);
}

function assertBreadcrumbSchema(blocks: any[], expectedPath: string) {
  const bc = blocks.find((b) => b?.["@type"] === "BreadcrumbList");
  if (!bc) return; // optional but if present, validate
  expect(Array.isArray(bc.itemListElement)).toBe(true);
  bc.itemListElement.forEach((it: any, i: number) => {
    expect(it["@type"], `${expectedPath} crumb[${i}] type`).toBe("ListItem");
    expect(Number.isInteger(it.position), `crumb[${i}] position int`).toBe(true);
    expect(it.position, `crumb[${i}] position sequential`).toBe(i + 1);
  });
}

test.describe("Broad product detail SEO coverage", () => {
  test("first N product details have valid canonical + Product JSON-LD", async ({
    page,
  }) => {
    const hrefs = await collectDetailHrefs(
      page,
      "/products",
      "/product/",
      MAX_PRODUCTS,
    );
    test.skip(
      hrefs.length === 0,
      "no product detail links discovered on /products",
    );

    const failures: string[] = [];
    for (const href of hrefs) {
      try {
        await page.goto(`${href}?utm_source=ci-broad`, {
          waitUntil: "networkidle",
        });
        await page.waitForTimeout(400);

        const snap = await readCanonical(page);
        assertCanonicalSlug(snap.hrefs, snap.ogUrl, href);

        const blocks = await readJsonLdBlocks(page);
        expect(
          blocks.length,
          `${href} must emit at least one JSON-LD block`,
        ).toBeGreaterThan(0);
        assertProductSchema(blocks, href);
        assertBreadcrumbSchema(blocks, href);
      } catch (e) {
        failures.push(`${href}: ${(e as Error).message}`);
      }
    }
    expect(failures, `product detail SEO failures:\n${failures.join("\n")}`)
      .toEqual([]);
  });
});

test.describe("Broad blog detail SEO coverage", () => {
  test("first N blog posts have valid canonical + BlogPosting JSON-LD", async ({
    page,
  }) => {
    const hrefs = await collectDetailHrefs(page, "/blog", "/blog/", MAX_BLOGS);
    test.skip(hrefs.length === 0, "no blog detail links discovered on /blog");

    const failures: string[] = [];
    for (const href of hrefs) {
      try {
        await page.goto(`${href}?utm_source=ci-broad&page=4`, {
          waitUntil: "networkidle",
        });
        await page.waitForTimeout(400);

        const snap = await readCanonical(page);
        assertCanonicalSlug(snap.hrefs, snap.ogUrl, href);

        const blocks = await readJsonLdBlocks(page);
        expect(
          blocks.length,
          `${href} must emit at least one JSON-LD block`,
        ).toBeGreaterThan(0);
        assertBlogPostingSchema(blocks, href);
        assertBreadcrumbSchema(blocks, href);
      } catch (e) {
        failures.push(`${href}: ${(e as Error).message}`);
      }
    }
    expect(failures, `blog detail SEO failures:\n${failures.join("\n")}`)
      .toEqual([]);
  });
});
