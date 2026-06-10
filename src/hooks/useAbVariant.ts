import { useEffect, useState } from "react";
import { getAbVariant, trackEvent } from "@/lib/analytics";

/**
 * Sticky A/B variant per test. Tracks `ab_exposure` once per mount.
 */
export function useAbVariant(testName: string, variants: readonly string[] = ["A", "B"]) {
  const [variant, setVariant] = useState<string>(() => getAbVariant(testName, variants));

  useEffect(() => {
    trackEvent("ab_exposure", { test: testName, variant });
  }, [testName, variant]);

  return [variant, setVariant] as const;
}
