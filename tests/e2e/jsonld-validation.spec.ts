import { test, expect } from "./fixtures/deterministic";
import type { Page, TestInfo } from "@playwright/test";

// Parse every <script type="application/ld+json"> block on each key
// public page and validate the required fields per @type. We mirror
// the rules in src/lib/jsonLdValidator.ts so the live pages get the
// same guarantees CI gives the unit tests.
//
// Coverage includes paginated and filtered list variants so search-
// crawler-visible URL parameters cannot ship broken structured data.

interface ValidationIssue {
  index: number;
  type: string;
  errors: string[];
}

function validateBlock(block: any, index: number): ValidationIssue | null {
  const errs: string[] = [];
  const type = String(block?.["@type"] ?? "");
  const ctx = block?.["@context"];

  if (!type) errs.push('missing "@type"');
  if (!ctx) errs.push('missing "@context"');
  else if (typeof ctx === "string" && !/schema\.org/i.test(ctx))
    errs.push('"@context" must reference schema.org');

  const requireFields = (fields: string[]) => {
    for (const f of fields) {
      const v = block?.[f];
      if (v === undefined || v === null || v === "")
        errs.push(`missing required field "${f}"`);
    }
  };

  switch (type) {
    case "FAQPage": {
      if (!Array.isArray(block?.mainEntity) || block.mainEntity.length === 0) {
        errs.push("FAQPage.mainEntity must be a non-empty array");
      } else {
        block.mainEntity.forEach((q: any, i: number) => {
          if (q?.["@type"] !== "Question")
            errs.push(`mainEntity[${i}]["@type"] must be "Question"`);
          if (!q?.name) errs.push(`mainEntity[${i}].name is required`);
          const a = q?.acceptedAnswer;
          if (!a || a["@type"] !== "Answer" || !a.text)
            errs.push(
              `mainEntity[${i}].acceptedAnswer must be { "@type": "Answer", text }`,
            );
        });
      }
      break;
    }
    case "BlogPosting": {
      requireFields(["headline", "author", "datePublished"]);
      if (typeof block?.headline === "string" && block.headline.length > 110)
        errs.push("headline exceeds 110 chars (rich-results limit)");
      if (block?.datePublished && Number.isNaN(Date.parse(block.datePublished)))
        errs.push("datePublished is not a parseable date");
      if (block?.dateModified && Number.isNaN(Date.parse(block.dateModified)))
        errs.push("dateModified is not a parseable date");
      break;
    }
    case "SoftwareApplication":
    case "Product": {
      requireFields(["name"]);
      const ar = block?.aggregateRating;
      if (ar) {
        if (ar["@type"] !== "AggregateRating")
          errs.push('aggregateRating["@type"] must be "AggregateRating"');
        if (ar.ratingValue === undefined)
          errs.push("aggregateRating.ratingValue is required");
        if (ar.ratingCount === undefined && ar.reviewCount === undefined)
          errs.push("aggregateRating requires ratingCount or reviewCount");
      }
      const offers = block?.offers;
      if (offers) {
        const offerArr = Array.isArray(offers) ? offers : [offers];
        offerArr.forEach((o: any, i: number) => {
          if (!o?.["@type"]) errs.push(`offers[${i}] missing @type`);
          if (o?.price !== undefined && o?.priceCurrency === undefined)
            errs.push(`offers[${i}] price requires priceCurrency`);
        });
      }
      break;
    }
    default:
      break;
  }

  return errs.length ? { index, type: type || "(none)", errors: errs } : null;
}

async function readJsonLd(page: Page) {
  return page.evaluate(() => {
    return Array.from(
      document.head.querySelectorAll('script[type="application/ld+json"]'),
    ).map((s) => {
      try {
        return { ok: true, data: JSON.parse(s.textContent || "null") };
      } catch (e) {
        return { ok: false, error: String(e), text: s.textContent };
      }
    });
  });
}

interface FlatBlock {
  index: number;
  type: string;
  data: any;
}

async function loadAndFlatten(page: Page, path: string): Promise<FlatBlock[]> {
  const res = await page.goto(path, { waitUntil: "networkidle" });
  expect(res, `response for ${path}`).toBeTruthy();
  expect(res!.status(), `${path} should not 5xx`).toBeLessThan(500);
  await page.waitForTimeout(600);

  const parsed = await readJsonLd(page);
  const flat: FlatBlock[] = [];
  parsed.forEach((entry, i) => {
    if (!entry.ok) {
      throw new Error(`Invalid JSON-LD on ${path}: ${entry.error}`);
    }
    const blocks = Array.isArray(entry.data) ? entry.data : [entry.data];
    blocks.forEach((b: any, j: number) => {
      flat.push({ index: i * 100 + j, type: String(b?.["@type"] ?? ""), data: b });
    });
  });
  return flat;
}

function assertAllValid(blocks: FlatBlock[], label: string) {
  const issues: ValidationIssue[] = [];
  for (const b of blocks) {
    const issue = validateBlock(b.data, b.index);
    if (issue) issues.push(issue);
  }
  expect(
    issues,
    `JSON-LD validation errors on ${label}:\n${JSON.stringify(issues, null, 2)}`,
  ).toEqual([]);
}

// ---------- Base routes (every variant gets the general validator) ----------

const LIST_ROUTES = [
  // index pages
  "/",
  "/products",
  "/blog",
  "/categories",
  "/compare",
  // paginated variants
  "/products?page=2",
  "/blog?page=2",
  // filtered variants
  "/products?category=crm",
  "/products?sort=top-rated",
  "/search?q=crm",
  "/search?q=crm&page=2",
];

for (const path of LIST_ROUTES) {
  test(`JSON-LD on ${path} is well-formed`, async ({ page }) => {
    const blocks = await loadAndFlatten(page, path);
    expect(blocks.length, `${path} should emit at least one JSON-LD block`).toBeGreaterThan(0);
    assertAllValid(blocks, path);
  });
}

// ---------- Product detail variants ----------
// Discover a real product slug from the products index, then validate
// the detail page (and a filtered alternatives variant if present).

test("Product detail emits a SoftwareApplication/Product schema with required fields", async ({ page }) => {
  await page.goto("/products", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const slug = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/product/"]'))
      .map((a) => a.getAttribute("href") || "")
      .find((h) => /^\/product\/[\w-]+$/.test(h));
    return link ? link.replace(/^\/product\//, "") : null;
  });
  test.skip(!slug, "no product link found on /products to verify");

  const blocks = await loadAndFlatten(page, `/product/${slug}`);
  const productBlocks = blocks.filter(
    (b) => b.type === "SoftwareApplication" || b.type === "Product",
  );
  expect(productBlocks.length, "product detail must emit Product/SoftwareApplication").toBeGreaterThan(0);
  assertAllValid(blocks, `/product/${slug}`);
});

// ---------- Blog post + FAQ variants ----------

test("Blog post emits BlogPosting with required fields and any FAQ items are valid", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const slug = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/blog/"]'))
      .map((a) => a.getAttribute("href") || "")
      .find((h) => /^\/blog\/[\w-]+$/.test(h));
    return link ? link.replace(/^\/blog\//, "") : null;
  });
  test.skip(!slug, "no blog link found on /blog to verify");

  const blocks = await loadAndFlatten(page, `/blog/${slug}`);
  const posts = blocks.filter((b) => b.type === "BlogPosting");
  expect(posts.length, "blog post must emit BlogPosting").toBeGreaterThan(0);

  // BlogPosting required-field deep check.
  for (const p of posts) {
    expect(p.data.headline, "BlogPosting.headline present").toBeTruthy();
    expect(p.data.author, "BlogPosting.author present").toBeTruthy();
    expect(p.data.datePublished, "BlogPosting.datePublished present").toBeTruthy();
    expect(Number.isNaN(Date.parse(p.data.datePublished))).toBe(false);
  }

  // If a FAQPage block is present, every Question/Answer must be valid.
  const faqs = blocks.filter((b) => b.type === "FAQPage");
  for (const f of faqs) {
    expect(Array.isArray(f.data.mainEntity)).toBe(true);
    expect(f.data.mainEntity.length).toBeGreaterThan(0);
    for (const q of f.data.mainEntity) {
      expect(q["@type"]).toBe("Question");
      expect(typeof q.name === "string" && q.name.length > 0).toBe(true);
      expect(q.acceptedAnswer?.["@type"]).toBe("Answer");
      expect(typeof q.acceptedAnswer?.text === "string" && q.acceptedAnswer.text.length > 0).toBe(true);
    }
  }

  assertAllValid(blocks, `/blog/${slug}`);
});
