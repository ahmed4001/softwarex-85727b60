// Lightweight runtime JSON-LD validator. Kept dependency-free so it stays
// cheap in the client bundle — AJV is reserved for CI tests.
// Returns { valid, errors } per block. Invalid blocks should be dropped
// from <head> and logged so staging surfaces regressions early.

export interface JsonLdValidationError {
  index: number;
  type: string;
  errors: string[];
}

export interface JsonLdValidationResult {
  valid: object[];
  invalid: JsonLdValidationError[];
}

type Rule = (node: any, errs: string[]) => void;

const required = (keys: string[]): Rule => (node, errs) => {
  for (const k of keys) {
    const v = node?.[k];
    if (v === undefined || v === null || v === "") errs.push(`missing required field "${k}"`);
  }
};

const isHttpsSchemaContext = (node: any, errs: string[]) => {
  const ctx = node?.["@context"];
  if (!ctx) errs.push('missing "@context"');
  else if (typeof ctx === "string" && !/schema\.org/i.test(ctx))
    errs.push(`"@context" must reference schema.org`);
};

const RULES: Record<string, Rule[]> = {
  FAQPage: [
    isHttpsSchemaContext,
    required(["mainEntity"]),
    (node, errs) => {
      if (!Array.isArray(node?.mainEntity) || node.mainEntity.length === 0) {
        errs.push("FAQPage.mainEntity must be a non-empty array");
        return;
      }
      node.mainEntity.forEach((q: any, i: number) => {
        if (q?.["@type"] !== "Question") errs.push(`mainEntity[${i}]["@type"] must be "Question"`);
        if (!q?.name) errs.push(`mainEntity[${i}].name is required`);
        const a = q?.acceptedAnswer;
        if (!a || a["@type"] !== "Answer" || !a.text)
          errs.push(`mainEntity[${i}].acceptedAnswer must be { "@type": "Answer", text }`);
      });
    },
  ],
  BlogPosting: [
    isHttpsSchemaContext,
    required(["headline", "author", "datePublished"]),
    (node, errs) => {
      if (typeof node?.headline === "string" && node.headline.length > 110)
        errs.push("headline exceeds 110 chars (Google rich-results limit)");
      if (node?.datePublished && Number.isNaN(Date.parse(node.datePublished)))
        errs.push("datePublished is not a parseable date");
      if (node?.dateModified && Number.isNaN(Date.parse(node.dateModified)))
        errs.push("dateModified is not a parseable date");
    },
  ],
  Product: [isHttpsSchemaContext, required(["name"]), checkDateModified],
  SoftwareApplication: [
    isHttpsSchemaContext,
    required(["name"]),
    checkDateModified,
    (node, errs) => {
      const ar = node?.aggregateRating;
      if (ar) {
        if (ar["@type"] !== "AggregateRating") errs.push('aggregateRating["@type"] must be "AggregateRating"');
        if (ar.ratingValue === undefined) errs.push("aggregateRating.ratingValue is required");
        if (ar.ratingCount === undefined && ar.reviewCount === undefined)
          errs.push("aggregateRating requires ratingCount or reviewCount");
      }
    },
  ],
  BreadcrumbList: [
    isHttpsSchemaContext,
    (node, errs) => {
      if (!Array.isArray(node?.itemListElement) || node.itemListElement.length === 0)
        errs.push("BreadcrumbList.itemListElement must be a non-empty array");
    },
  ],
  Blog: [isHttpsSchemaContext],
  CollectionPage: [isHttpsSchemaContext, checkDateModified],
  WebPage: [isHttpsSchemaContext, checkDateModified],
  DefinedTerm: [isHttpsSchemaContext, required(["name"]), checkDateModified],
  HowTo: [isHttpsSchemaContext, required(["name", "step"]), checkDateModified],
  Article: [isHttpsSchemaContext, required(["headline", "author", "datePublished"]), checkDateModified],
  Organization: [isHttpsSchemaContext, required(["name"])],
  WebSite: [isHttpsSchemaContext, required(["name"])],
};

/** Soft-validates dateModified: must be parseable when present. We don't make
 *  it required at the validator level so types like WebPage stay flexible —
 *  the regression test suite enforces presence per-page-type. */
function checkDateModified(node: any, errs: string[]) {
  if (node?.dateModified !== undefined) {
    if (typeof node.dateModified !== "string" || Number.isNaN(Date.parse(node.dateModified))) {
      errs.push("dateModified must be a parseable ISO date string");
    }
  }
}

export function validateJsonLd(blocks: object[]): JsonLdValidationResult {
  const valid: object[] = [];
  const invalid: JsonLdValidationError[] = [];
  blocks.forEach((block, index) => {
    const node: any = block;
    const type = String(node?.["@type"] ?? "");
    const errs: string[] = [];
    if (!type) {
      errs.push('missing "@type"');
    } else {
      const rules = RULES[type];
      if (!rules) {
        // Unknown type — keep, but do a context sanity check so typos surface.
        isHttpsSchemaContext(node, errs);
      } else {
        for (const rule of rules) rule(node, errs);
      }
    }
    if (errs.length === 0) valid.push(block);
    else invalid.push({ index, type: type || "(none)", errors: errs });
  });
  return { valid, invalid };
}
