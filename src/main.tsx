import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { startWebVitals } from "./lib/web-vitals";

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
