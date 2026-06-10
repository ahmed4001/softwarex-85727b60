import { defineConfig, devices } from "@playwright/test";

// Playwright smoke tests for SEO essentials on key public pages.
// Run against staging/preview by setting STAGING_BASE_URL (defaults to
// the Lovable preview origin). In CI, point STAGING_BASE_URL at the
// deployed preview URL for the PR.
const BASE_URL =
  process.env.STAGING_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://id-preview--8f8ab8bf-14f5-4085-9849-266b90f727c8.lovable.app";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
