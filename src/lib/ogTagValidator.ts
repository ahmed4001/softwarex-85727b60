// Pure OG / Twitter Card validator. Kept dependency-free — used by the
// build-time gate (scripts/validate-structured-data-build.ts) and unit
// tests. Given a flat { name: content } map of head meta tags, returns
// an array of human-readable errors.
//
// Required: og:title, og:description, og:type, og:url, twitter:card.
// og:image is required only for pages that also set twitter:card=summary_large_image
// (otherwise Twitter falls back to text-only). If og:image is present it
// MUST be an absolute https URL and og:image:width/height should look sane.

export interface OgTagValidationOptions {
  /** Origin the page belongs to (e.g. https://reviewhunts.com). If set, og:url
   *  must resolve to this host. */
  expectedHost?: string;
}

export interface OgTagInput {
  /** Keys: `og:title`, `twitter:card`, etc. Values: content attribute. */
  tags: Record<string, string>;
  /** Optional URL of the page these tags came from — used in error messages only. */
  source?: string;
}

const REQUIRED = ["og:title", "og:description", "og:type", "og:url", "twitter:card"] as const;

const VALID_TWITTER_CARDS = new Set(["summary", "summary_large_image", "app", "player"]);
const VALID_OG_TYPES = new Set([
  "website", "article", "book", "profile",
  "video.movie", "video.episode", "video.tv_show", "video.other",
  "music.song", "music.album", "music.playlist", "music.radio_station",
  "product",
]);

export function validateOgTags({ tags, source }: OgTagInput, opts: OgTagValidationOptions = {}): string[] {
  const errs: string[] = [];
  const at = (k: string) => (tags[k] ?? "").trim();

  for (const key of REQUIRED) {
    if (!at(key)) errs.push(`missing required meta ${key}`);
  }

  const title = at("og:title");
  if (title && title.length > 95) errs.push(`og:title too long (${title.length} > 95)`);

  const desc = at("og:description");
  if (desc && (desc.length < 50 || desc.length > 200))
    errs.push(`og:description length ${desc.length} outside 50–200 range`);

  const type = at("og:type");
  if (type && !VALID_OG_TYPES.has(type))
    errs.push(`og:type "${type}" not in allowed vocabulary`);

  const card = at("twitter:card");
  if (card && !VALID_TWITTER_CARDS.has(card))
    errs.push(`twitter:card "${card}" invalid`);

  const url = at("og:url");
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") errs.push(`og:url must be https (got ${parsed.protocol})`);
      if (opts.expectedHost) {
        const expected = opts.expectedHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
        if (parsed.hostname.toLowerCase() !== expected)
          errs.push(`og:url host ${parsed.hostname} != ${expected}`);
      }
    } catch {
      errs.push(`og:url is not a valid absolute URL: ${url}`);
    }
  }

  // og:image is only strictly required for summary_large_image cards.
  const image = at("og:image");
  if (card === "summary_large_image" && !image)
    errs.push("twitter:card=summary_large_image requires og:image");
  if (image) {
    if (!/^https:\/\//i.test(image)) errs.push(`og:image must be an absolute https URL: ${image}`);
    const w = Number(at("og:image:width"));
    const h = Number(at("og:image:height"));
    if (w && (w < 200 || w > 4096)) errs.push(`og:image:width ${w} outside 200–4096 range`);
    if (h && (h < 200 || h > 4096)) errs.push(`og:image:height ${h} outside 200–4096 range`);
  }

  return source ? errs.map((e) => `[${source}] ${e}`) : errs;
}
