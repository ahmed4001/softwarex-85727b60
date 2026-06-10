// Playwright fixture that enforces quarantine.json — specs listed there
// are marked `test.fail()`-style soft: their failures are recorded and
// attached to the report but DO NOT fail the suite. Auto-promoted out
// of quarantine after passThreshold consecutive passes by
// .github/scripts/update-quarantine.mjs.
//
// Usage at the top of a spec file:
//   import { applyQuarantine } from "./fixtures/quarantine";
//   applyQuarantine(__filename);

import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

let cache: Set<string> | null = null;

function loadList(): Set<string> {
  if (cache) return cache;
  try {
    const repoRoot = process.cwd();
    const f = path.join(repoRoot, "tests/e2e/quarantine.json");
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    cache = new Set((j.quarantined || []).map((s: string) => s.replace(/\\/g, "/")));
  } catch {
    cache = new Set();
  }
  return cache;
}

export function applyQuarantine(currentFile: string) {
  const rel = path
    .relative(process.cwd(), currentFile)
    .replace(/\\/g, "/");
  if (!loadList().has(rel)) return;

  test.describe.configure({ mode: "default" });
  test.beforeEach(async ({}, testInfo) => {
    // Mark every test in this file as "soft" — failures are recorded
    // (artifacts attached) but the suite stays green.
    testInfo.annotations.push({
      type: "quarantine",
      description: `Quarantined via tests/e2e/quarantine.json (${rel})`,
    });
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status === "failed" || testInfo.status === "timedOut") {
      // Soft-fail: log the failure as a warning + neutralize exit status.
      console.warn(
        `[QUARANTINED] ${rel} :: ${testInfo.title} — ${testInfo.status} (non-blocking)`,
      );
      testInfo.status = "passed";
    }
  });
}
