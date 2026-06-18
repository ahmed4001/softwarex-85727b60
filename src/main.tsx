import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

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
