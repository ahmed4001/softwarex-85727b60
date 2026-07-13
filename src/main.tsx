import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { startWebVitals } from "./lib/web-vitals";

// On prerendered routes, the static <head> already carries route-specific
// title/description/canonical/og:*/twitter:* tags baked in by
// scripts/prerender-static.ts. react-helmet-async only manages tags it
// created (data-rh) and would otherwise append duplicates on hydration.
// Strip the static SEO tags before render so Helmet becomes the single
// source of truth in JS-executing clients. Non-JS crawlers still see the
// baked-in static tags in the served HTML.
if (typeof document !== "undefined" && document.documentElement.hasAttribute("data-prerendered")) {
  const head = document.head;
  const removeMatching = (selector: string) => {
    head.querySelectorAll(selector).forEach((el) => {
      if (!el.hasAttribute("data-rh")) el.remove();
    });
  };
  // Keep only one <title> — remove any static one so Helmet owns it.
  head.querySelectorAll("title").forEach((el) => {
    if (!el.hasAttribute("data-rh")) el.remove();
  });
  removeMatching('meta[name="description"]');
  removeMatching('link[rel="canonical"]');
  removeMatching('meta[property^="og:"]');
  removeMatching('meta[name^="twitter:"]');
  removeMatching('script[type="application/ld+json"]');
}

const container = document.getElementById("root")!;
const tree = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If the route was prerendered (scripts/prerender.ts), hydrate the existing
// markup so search engines get fully-rendered HTML *and* users don't see a
// flash of empty content. Falls back to client-only render for non-prerendered
// routes (dynamic detail pages).
if (container.hasChildNodes()) {
  hydrateRoot(container, tree);
} else {
  createRoot(container).render(tree);
}

// Stream Core Web Vitals beacons to Supabase for the admin dashboard.
// Defer until idle so it never competes with hydration / LCP.
if (typeof window !== "undefined") {
  const kick = () => startWebVitals();
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(kick, { timeout: 3000 });
  } else {
    setTimeout(kick, 1500);
  }
}
