/**
 * Web Vitals reporter.
 * Subscribes to LCP / CLS / INP / FCP / TTFB and posts beacons to the
 * `web_vitals` table via sendBeacon (falls back to fetch keepalive).
 *
 * The endpoint is the Supabase PostgREST insert URL; the anon key plus
 * RLS policy ("anyone can insert") allows write-only access without auth.
 */
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const SESSION_KEY = "rh_wv_session";

function getSessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "anonymous";
  }
}

function sendBeacon(metric: Metric) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const url = `${SUPABASE_URL}/rest/v1/web_vitals`;
  const conn =
    (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
      ?.effectiveType ?? null;
  const body = JSON.stringify({
    metric: metric.name,
    value: Math.round((metric.value + Number.EPSILON) * 1000) / 1000,
    rating: metric.rating,
    navigation_type: metric.navigationType,
    path: window.location.pathname,
    user_agent: navigator.userAgent.slice(0, 256),
    connection: conn,
    session_id: getSessionId(),
  });

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Prefer: "return=minimal",
  };

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      // sendBeacon can't set custom headers; fall back to fetch keepalive
      // because PostgREST requires apikey/Authorization.
      // Try fetch with keepalive first.
      void fetch(url, { method: "POST", headers, body, keepalive: true }).catch(() => {
        navigator.sendBeacon(url, blob);
      });
    } else {
      void fetch(url, { method: "POST", headers, body, keepalive: true });
    }
  } catch {
    /* swallow — vitals are best-effort */
  }
}

let started = false;
export function startWebVitals() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    onLCP(sendBeacon);
    onCLS(sendBeacon);
    onINP(sendBeacon);
    onFCP(sendBeacon);
    onTTFB(sendBeacon);
  } catch {
    /* noop */
  }
}
