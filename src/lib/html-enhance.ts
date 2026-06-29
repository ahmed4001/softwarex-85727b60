/**
 * Sanitize user/CMS-generated HTML for safe + performant rendering.
 *
 * - Ensures every <img> has an `alt` attribute (uses provided fallback or empty
 *   string so screen readers treat it as decorative rather than reading the URL).
 * - Adds `loading="lazy"` and `decoding="async"` to <img> tags missing them so
 *   long-form pages don't block the LCP on offscreen images.
 * - For Supabase Storage URLs, emits <picture> with AVIF + WebP sources and
 *   responsive srcset/sizes via `enhanceResponsiveImages`.
 *
 * Pure string transform — runs on already-trusted HTML stored in the database.
 * Does NOT sanitize XSS; the rich-text editor is responsible for that on save.
 */
import { enhanceResponsiveImages } from "./responsive-image";

export function enhanceHtmlImages(html: string, altFallback = ""): string {
  if (!html) return html;
  // Single pass — enhanceResponsiveImages handles both responsive sources
  // and the lazy/decoding/alt fallbacks for non-storage URLs.
  return enhanceResponsiveImages(html, altFallback);
}
