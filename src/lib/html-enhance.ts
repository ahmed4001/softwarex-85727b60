/**
 * Sanitize user/CMS-generated HTML for safe + performant rendering.
 *
 * - Ensures every <img> has an `alt` attribute (uses provided fallback or empty
 *   string so screen readers treat it as decorative rather than reading the URL).
 * - Adds `loading="lazy"` and `decoding="async"` to <img> tags missing them so
 *   long-form pages don't block the LCP on offscreen images.
 *
 * Pure string transform — runs on already-trusted HTML stored in the database.
 * Does NOT sanitize XSS; the rich-text editor is responsible for that on save.
 */
export function enhanceHtmlImages(html: string, altFallback = ""): string {
  if (!html) return html;
  return html.replace(/<img\b([^>]*?)\/?>/gi, (full, attrs: string) => {
    let next = attrs;
    if (!/\balt\s*=/.test(next)) {
      const safe = altFallback.replace(/"/g, "&quot;");
      next = ` alt="${safe}"` + next;
    }
    if (!/\bloading\s*=/.test(next)) next += ' loading="lazy"';
    if (!/\bdecoding\s*=/.test(next)) next += ' decoding="async"';
    return `<img${next}>`;
  });
}
