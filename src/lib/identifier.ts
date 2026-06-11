// Detects whether a route param is a UUID v4 vs. a human slug/username.
// Used to dual-lookup pages (slug-first, UUID fallback) and redirect old
// UUID URLs to their canonical slug equivalent for SEO.
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: string | undefined | null): boolean =>
  !!v && UUID_RE.test(v);
