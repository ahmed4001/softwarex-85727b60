import { test, expect, Page } from "@playwright/test";

// Parse every <script type="application/ld+json"> block on each key
// public page and validate the required fields per @type. We mirror
// the rules in src/lib/jsonLdValidator.ts so the live pages get the
// same guarantees CI gives the unit tests.

const ROUTES = [
  "/",
  "/products",
  "/blog",
  "/categories",
  "/compare",
];

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
    case "SoftwareApplication": {
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
      break;
    }
    case "Product": {
      requireFields(["name"]);
      break;
    }
    default:
      // Unknown @type — context check already ran above.
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

for (const path of ROUTES) {
  test(`JSON-LD on ${path} is well-formed`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res, "page must respond").toBeTruthy();
    expect(res!.status()).toBeLessThan(500);
    await page.waitForTimeout(500);

    const parsed = await readJsonLd(page);
    expect(parsed.length, `${path} should emit at least one JSON-LD block`).toBeGreaterThan(0);

    const issues: ValidationIssue[] = [];
    parsed.forEach((entry, i) => {
      if (!entry.ok) {
        issues.push({ index: i, type: "(parse error)", errors: [String(entry.error)] });
        return;
      }
      const blocks = Array.isArray(entry.data) ? entry.data : [entry.data];
      blocks.forEach((b: any, j: number) => {
        const issue = validateBlock(b, i * 100 + j);
        if (issue) issues.push(issue);
      });
    });

    expect(
      issues,
      `JSON-LD validation errors on ${path}:\n${JSON.stringify(issues, null, 2)}`,
    ).toEqual([]);
  });
}
