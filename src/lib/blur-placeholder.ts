/**
 * Lightweight blur-up placeholders. We generate a tiny inline SVG (no network,
 * no base64 decoding cost) with a soft radial gradient derived from a seed
 * string (product name, image URL). Rendered as a `background-image` on the
 * image wrapper so it shows instantly and is covered as soon as the real
 * image paints.
 */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hslFromSeed(seed: string, sOffset = 0, lOffset = 0): string {
  const h = hash(seed);
  const hue = h % 360;
  const sat = 55 + ((h >> 8) % 20) + sOffset;
  const light = 78 + ((h >> 16) % 8) + lOffset;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/** Data-URI SVG blur placeholder. Suitable for `background-image: url(...)`. */
export function blurPlaceholderDataUri(seed: string): string {
  const c1 = hslFromSeed(seed);
  const c2 = hslFromSeed(seed + "b", -10, -18);
  // 20x12 tiny SVG scaled up by the browser gives the "blur" feel for free.
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 12' preserveAspectRatio='none'>` +
    `<defs><radialGradient id='g' cx='30%' cy='30%' r='90%'>` +
    `<stop offset='0%' stop-color='${c1}'/>` +
    `<stop offset='100%' stop-color='${c2}'/>` +
    `</radialGradient></defs>` +
    `<rect width='20' height='12' fill='url(%23g)'/>` +
    `</svg>`;
  return `url("data:image/svg+xml;utf8,${svg.replace(/"/g, "'").replace(/#/g, "%23")}")`;
}
