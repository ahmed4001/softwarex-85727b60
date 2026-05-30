import { useEffect } from "react";
import { loadProductOrderConfig } from "@/lib/product-order";

/** Loads the real-vs-fake ordering config once on app mount. */
export function useProductOrderConfig() {
  useEffect(() => {
    loadProductOrderConfig();
  }, []);
}
