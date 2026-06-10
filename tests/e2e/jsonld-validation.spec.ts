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
    case "WebSite": {
      requireFields(["name", "url"]);
      if (block?.url && !/^https?:\/\//.test(String(block.url)))
        errs.push("WebSite.url must be an absolute http(s) URL");
      // potentialAction (SearchAction) is recommended but not required.
      if (block?.potentialAction) {
        const pa = Array.isArray(block.potentialAction)
          ? block.potentialAction
          : [block.potentialAction];
        pa.forEach((a: any, i: number) => {
          if (!a?.["@type"]) errs.push(`potentialAction[${i}] missing @type`);
        });
      }
      break;
    }
    case "Organization": {
      requireFields(["name", "url"]);
      if (block?.url && !/^https?:\/\//.test(String(block.url)))
        errs.push("Organization.url must be an absolute http(s) URL");
      // sameAs (social profile URLs) — when present, every entry must be absolute.
      if (block?.sameAs !== undefined) {
        if (!Array.isArray(block.sameAs))
          errs.push("Organization.sameAs must be an array of URLs");
        else
          block.sameAs.forEach((u: any, i: number) => {
            if (typeof u !== "string" || !/^https?:\/\//.test(u))
              errs.push(`Organization.sameAs[${i}] must be an absolute http(s) URL`);
          });
      }
      if (block?.logo) {
        const logoUrl = typeof block.logo === "string" ? block.logo : block.logo?.url;
        if (logoUrl && !/^https?:\/\//.test(String(logoUrl)))
          errs.push("Organization.logo URL must be absolute");
      }
      break;
    }
    case "BreadcrumbList": {
      if (!Array.isArray(block?.itemListElement) || block.itemListElement.length === 0) {
        errs.push("BreadcrumbList.itemListElement must be a non-empty array");
      } else {
        const positions: number[] = [];
        block.itemListElement.forEach((li: any, i: number) => {
          if (li?.["@type"] !== "ListItem")
            errs.push(`itemListElement[${i}]["@type"] must be "ListItem"`);
          const pos = li?.position;
          if (!Number.isInteger(pos) || pos < 1)
            errs.push(`itemListElement[${i}].position must be a positive integer (got ${JSON.stringify(pos)})`);
          else positions.push(pos);
          if (!li?.name && !li?.item?.name)
            errs.push(`itemListElement[${i}] missing name`);
        });
        // Sequence must be contiguous and strictly ascending: 1, 2, 3, ...
        const sorted = [...positions].sort((a, b) => a - b);
        sorted.forEach((p, i) => {
          if (p !== i + 1)
            errs.push(`BreadcrumbList positions must be a 1..N sequence (got ${sorted.join(",")})`);
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

// On failure, attach the page HTML + every extracted JSON-LD block so
// merge-gate diagnostics in CI don't require a re-run. Artifacts show
// up under each failed test in the Playwright HTML report.
test.afterEach(async ({ page }, testInfo: TestInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  try {
    const url = page.url();
    const html = await page.content().catch(() => "<unavailable>");
    const blocks = await readJsonLd(page).catch(() => []);
    await testInfo.attach("page-url.txt", { body: url, contentType: "text/plain" });
    await testInfo.attach("page.html", { body: html, contentType: "text/html" });
    await testInfo.attach("jsonld-blocks.json", {
      body: JSON.stringify(blocks, null, 2),
      contentType: "application/json",
    });
    await page.screenshot({ fullPage: true }).then((buf) =>
      testInfo.attach("page.png", { body: buf, contentType: "image/png" }),
    ).catch(() => {});
  } catch {
    // best-effort — never fail the test in cleanup.
  }
});



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

// ---------- WebSite + Organization on homepage and category pages ----------

async function findCategorySlug(page: Page): Promise<string | null> {
  await page.goto("/categories", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/category/"], a[href^="/categories/"]'))
      .map((a) => a.getAttribute("href") || "")
      .find((h) => /^\/(category|categories)\/[\w-]+$/.test(h));
    return link ? link.replace(/^\/(category|categories)\//, "") : null;
  });
}

const SITE_SCHEMA_ROUTES: Array<{ label: string; resolve: (page: Page) => Promise<string | null> }> = [
  { label: "homepage", resolve: async () => "/" },
  { label: "categories index", resolve: async () => "/categories" },
  { label: "category detail", resolve: async (page) => {
      const slug = await findCategorySlug(page);
      return slug ? `/category/${slug}` : null;
    } },
];

for (const route of SITE_SCHEMA_ROUTES) {
  test(`WebSite + Organization JSON-LD on ${route.label}`, async ({ page }) => {
    const path = await route.resolve(page);
    test.skip(!path, `no path resolved for ${route.label}`);
    const blocks = await loadAndFlatten(page, path!);

    const websites = blocks.filter((b) => b.type === "WebSite");
    const orgs = blocks.filter((b) => b.type === "Organization");

    expect(websites.length, `${route.label} must emit a WebSite schema`).toBeGreaterThan(0);
    expect(orgs.length, `${route.label} must emit an Organization schema`).toBeGreaterThan(0);

    for (const w of websites) {
      expect(typeof w.data.name === "string" && w.data.name.length > 0, "WebSite.name").toBe(true);
      expect(typeof w.data.url === "string" && /^https?:\/\//.test(w.data.url), "WebSite.url absolute").toBe(true);
    }
    for (const o of orgs) {
      expect(typeof o.data.name === "string" && o.data.name.length > 0, "Organization.name").toBe(true);
      expect(typeof o.data.url === "string" && /^https?:\/\//.test(o.data.url), "Organization.url absolute").toBe(true);
      // sameAs (social profiles) is recommended on the homepage especially.
      if (o.data.sameAs !== undefined) {
        expect(Array.isArray(o.data.sameAs), "Organization.sameAs is array").toBe(true);
        for (const u of o.data.sameAs) {
          expect(typeof u === "string" && /^https?:\/\//.test(u), `sameAs entry ${u} absolute`).toBe(true);
        }
      }
    }

    // Homepage specifically should advertise at least one social profile.
    if (route.label === "homepage") {
      const anySameAs = orgs.some((o) => Array.isArray(o.data.sameAs) && o.data.sameAs.length > 0);
      expect(anySameAs, "homepage Organization should include sameAs social profile links").toBe(true);
    }

    assertAllValid(blocks, path!);
  });
}

// ---------- BreadcrumbList on product + blog detail pages ----------

async function findDetailPath(page: Page, listPath: string, hrefPrefix: string) {
  await page.goto(listPath, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  return page.evaluate(({ prefix }) => {
    const re = new RegExp("^" + prefix.replace(/[/]/g, "\\/") + "[\\w-]+$");
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href^="${prefix}"]`))
      .map((a) => a.getAttribute("href") || "")
      .find((h) => re.test(h));
    return link;
  }, { prefix: hrefPrefix });
}

function assertBreadcrumbValid(b: any) {
  expect(b.type).toBe("BreadcrumbList");
  expect(Array.isArray(b.data.itemListElement)).toBe(true);
  expect(b.data.itemListElement.length).toBeGreaterThan(0);

  const positions: number[] = [];
  for (const li of b.data.itemListElement) {
    expect(li["@type"]).toBe("ListItem");
    expect(Number.isInteger(li.position), `position ${li.position} must be integer`).toBe(true);
    expect(li.position).toBeGreaterThanOrEqual(1);
    positions.push(li.position);
  }
  // Strict 1..N sequence with no duplicates / gaps.
  const sorted = [...positions].sort((a, b) => a - b);
  expect(new Set(sorted).size, "no duplicate breadcrumb positions").toBe(sorted.length);
  sorted.forEach((p, i) => expect(p, `position[${i}] should be ${i + 1}`).toBe(i + 1));
}

test("BreadcrumbList on product detail page", async ({ page }) => {
  const path = await findDetailPath(page, "/products", "/product/");
  test.skip(!path, "no product link found on /products");

  const blocks = await loadAndFlatten(page, path!);
  const crumbs = blocks.filter((b) => b.type === "BreadcrumbList");
  expect(crumbs.length, "product detail must emit BreadcrumbList").toBeGreaterThan(0);
  for (const c of crumbs) assertBreadcrumbValid(c);
  assertAllValid(blocks, path!);
});

test("BreadcrumbList on blog detail page", async ({ page }) => {
  const path = await findDetailPath(page, "/blog", "/blog/");
  test.skip(!path, "no blog link found on /blog");

  const blocks = await loadAndFlatten(page, path!);
  const crumbs = blocks.filter((b) => b.type === "BreadcrumbList");
  expect(crumbs.length, "blog detail must emit BreadcrumbList").toBeGreaterThan(0);
  for (const c of crumbs) assertBreadcrumbValid(c);
  assertAllValid(blocks, path!);
});
