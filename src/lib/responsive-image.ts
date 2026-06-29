/**
 * Responsive image helpers for CMS / Supabase Storage images.
 *
 * Supabase Storage exposes an on-the-fly image transformer at
 *   /storage/v1/render/image/public/<bucket>/<path>?width=...&format=webp
 * We use it to emit srcset entries at common breakpoints plus an
 * AVIF / WebP <picture> when rendering raw HTML.
 */

const WIDTHS = [320, 640, 960, 1280, 1600];
const DEFAULT_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1280px";

/**
 * Returns true when the URL is a Supabase Storage public object URL.
 * Only those URLs support the render-image transformer.
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return /\/storage\/v1\/object\/public\//.test(url);
}

function toRenderUrl(url: string, width: number, format?: "webp" | "avif"): string {
  // Switch /object/public/ → /render/image/public/ and append transform params.
  const rendered = url.replace("/object/public/", "/render/image/public/");
  const u = new URL(rendered, "https://placeholder.local");
  u.searchParams.set("width", String(width));
  u.searchParams.set("quality", "78");
  u.searchParams.set("resize", "contain");
  if (format) u.searchParams.set("format", format);
  // Preserve the original origin if the input was absolute.
  if (/^https?:\/\//.test(rendered)) return rendered.split("?")[0] + "?" + u.searchParams.toString();
  return u.pathname + "?" + u.searchParams.toString();
}

export function buildSrcSet(url: string, format?: "webp" | "avif"): string {
  if (!isSupabaseStorageUrl(url)) return "";
  return WIDTHS.map((w) => `${toRenderUrl(url, w, format)} ${w}w`).join(", ");
}

/**
 * Transforms raw CMS HTML so each <img> uses srcset + sizes and is wrapped
 * in <picture> with AVIF + WebP sources for browsers that support them.
 * Falls back gracefully for non-storage URLs (just adds lazy + decoding).
 */
export function enhanceResponsiveImages(html: string, altFallback = ""): string {
  if (!html) return html;
  return html.replace(/<img\b([^>]*?)\/?>/gi, (full, raw: string) => {
    const attrs = raw;
    const srcMatch = attrs.match(/\bsrc\s*=\s*"([^"]+)"/i) || attrs.match(/\bsrc\s*=\s*'([^']+)'/i);
    const src = srcMatch?.[1];

    // Ensure alt / loading / decoding hints exist on the <img>.
    let imgAttrs = attrs;
    if (!/\balt\s*=/.test(imgAttrs)) {
      imgAttrs = ` alt="${altFallback.replace(/"/g, "&quot;")}"` + imgAttrs;
    }
    if (!/\bloading\s*=/.test(imgAttrs)) imgAttrs += ' loading="lazy"';
    if (!/\bdecoding\s*=/.test(imgAttrs)) imgAttrs += ' decoding="async"';

    if (!src || !isSupabaseStorageUrl(src)) {
      return `<img${imgAttrs}>`;
    }

    const avif = buildSrcSet(src, "avif");
    const webp = buildSrcSet(src, "webp");
    const fallback = buildSrcSet(src);

    // Add srcset + sizes to the <img> as well, so non-<picture> consumers
    // (RSS readers, scrapers) still get responsive variants.
    if (!/\bsrcset\s*=/.test(imgAttrs) && fallback) {
      imgAttrs += ` srcset="${fallback}" sizes="${DEFAULT_SIZES}"`;
    }

    return [
      "<picture>",
      avif ? `<source type="image/avif" srcset="${avif}" sizes="${DEFAULT_SIZES}">` : "",
      webp ? `<source type="image/webp" srcset="${webp}" sizes="${DEFAULT_SIZES}">` : "",
      `<img${imgAttrs}>`,
      "</picture>",
    ].join("");
  });
}
