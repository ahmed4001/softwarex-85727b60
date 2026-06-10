/**
 * Lightweight analytics + A/B variant helper.
 * - trackEvent: dispatches to window.gtag when available, console.debug in dev,
 *   and emits a CustomEvent so any in-app dashboard can listen.
 * - getAbVariant: deterministic sticky bucket per test name via localStorage.
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export type EventParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(name: string, params: EventParams = {}) {
  try {
    const payload = { ...params, ts: Date.now() };
    if (typeof window !== "undefined") {
      if (typeof window.gtag === "function") {
        window.gtag("event", name, payload as any);
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: name, ...payload });
      }
      window.dispatchEvent(new CustomEvent("app:analytics", { detail: { name, params: payload } }));
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[analytics]", name, payload);
    }
  } catch {
    /* noop */
  }
}

const AB_KEY_PREFIX = "ab:";

export function getAbVariant(testName: string, variants: readonly string[] = ["A", "B"]): string {
  if (typeof window === "undefined") return variants[0];
  const key = AB_KEY_PREFIX + testName;
  try {
    // URL override for QA: ?ab_<testName>=B
    const url = new URL(window.location.href);
    const override = url.searchParams.get(`ab_${testName}`);
    if (override && variants.includes(override)) {
      localStorage.setItem(key, override);
      return override;
    }
    const existing = localStorage.getItem(key);
    if (existing && variants.includes(existing)) return existing;
    const pick = variants[Math.floor(Math.random() * variants.length)];
    localStorage.setItem(key, pick);
    trackEvent("ab_assign", { test: testName, variant: pick });
    return pick;
  } catch {
    return variants[0];
  }
}
