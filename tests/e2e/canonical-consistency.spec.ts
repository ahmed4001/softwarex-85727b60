import { test, expect } from "./fixtures/deterministic";
import type { Page } from "@playwright/test";

// Verify SEO tags stay consistent across full reloads AND client-side
// (SPA) navigations. react-helmet-async should swap head tags cleanly
// when the user navigates without a hard reload.

async function readSeoTags(page: Page) {
  return page.evaluate(() => {
    const canonical = document.head
      .querySelector('link[rel="canonical"]')
      ?.getAttribute("href") || "";
    const ogUrl = document.head
      .querySelector('meta[property="og:url"]')
      ?.getAttribute("content") || "";
    const ogTitle = document.head
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content") || "";
    const title = document.title;
    const canonicalCount = document.head.querySelectorAll(
      'link[rel="canonical"]',
    ).length;
    return { canonical, ogUrl, ogTitle, title, canonicalCount };
  });
}

test.describe("Canonical / OG consistency", () => {
  test("tags are stable across full reloads", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const first = await readSeoTags(page);

    expect(first.canonicalCount, "exactly one canonical").toBe(1);
    expect(first.canonical).toMatch(/^https?:\/\//);
    expect(first.ogUrl).toMatch(/^https?:\/\//);
    expect(first.ogTitle.length).toBeGreaterThan(0);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const second = await readSeoTags(page);

    expect(second.canonicalCount).toBe(1);
    expect(second.canonical, "canonical stable across reloads").toBe(first.canonical);
    expect(second.ogUrl).toBe(first.ogUrl);
    expect(second.ogTitle).toBe(first.ogTitle);
    expect(second.title).toBe(first.title);
  });

  test("tags update correctly during client-side navigation", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const home = await readSeoTags(page);
    expect(home.canonicalCount).toBe(1);

    // Navigate via client-side router (anchor click if available, fall
    // back to history.pushState + popstate which the router listens to).
    const blogLink = page.locator('a[href="/blog"]').first();
    if (await blogLink.count()) {
      await blogLink.click();
    } else {
      await page.evaluate(() => {
        window.history.pushState({}, "", "/blog");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    }
    await page.waitForURL("**/blog");
    await page.waitForTimeout(700);
    const blog = await readSeoTags(page);

    expect(blog.canonicalCount, "still exactly one canonical after SPA nav").toBe(1);
    expect(blog.canonical, "canonical must change with route").not.toBe(home.canonical);
    expect(new URL(blog.canonical).pathname).toBe("/blog");
    expect(blog.ogUrl, "og:url tracks canonical").toBe(blog.canonical);
    expect(blog.ogTitle.length).toBeGreaterThan(0);
    expect(blog.title).not.toBe(home.title);

    // Navigate back; tags must restore.
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const back = await readSeoTags(page);
    expect(back.canonicalCount).toBe(1);
    expect(back.canonical).toBe(home.canonical);
    expect(back.ogUrl).toBe(home.ogUrl);
    expect(back.title).toBe(home.title);
  });
});
