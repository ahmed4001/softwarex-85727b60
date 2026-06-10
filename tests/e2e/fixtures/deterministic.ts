// Shared Playwright fixture that freezes browser-side sources of
// non-determinism BEFORE any page script runs. Use via:
//
//   import { test, expect } from "./fixtures/deterministic";
//
// Frozen surfaces:
//   - Date / Date.now / performance.now — pinned to FROZEN_EPOCH_MS.
//   - Math.random — seeded mulberry32 PRNG.
//   - crypto.randomUUID — deterministic counter.
//   - Intl.DateTimeFormat / Intl.NumberFormat / toLocale* — forced to en-US + UTC.
// These overrides are installed with addInitScript so they apply to
// every navigation (including SPA route changes) without races.

import { test as base, expect } from "@playwright/test";

export const FROZEN_EPOCH_MS = Date.UTC(2026, 0, 15, 12, 0, 0); // 2026-01-15T12:00:00Z

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(
      ({ epoch }) => {
        // ---- Date ----
        const RealDate = Date;
        class FrozenDate extends RealDate {
          constructor(...args: any[]) {
            // @ts-expect-error - spread into Date constructor
            super(...(args.length ? args : [epoch]));
          }
          static now() { return epoch; }
        }
        // @ts-expect-error - assign over global
        globalThis.Date = FrozenDate;

        // ---- performance.now ----
        if (typeof performance !== "undefined") {
          const start = epoch;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (performance as any).now = () => 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (performance as any).timeOrigin = start;
        }

        // ---- Math.random (mulberry32) ----
        let seed = 0x12345678;
        Math.random = () => {
          seed |= 0;
          seed = (seed + 0x6d2b79f5) | 0;
          let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        // ---- crypto.randomUUID ----
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
          let n = 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (crypto as any).randomUUID = () => {
            n += 1;
            return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
          };
        }

        // ---- Force locale + timezone on Intl + toLocale* ----
        const FIXED_LOCALE = "en-US";
        const FIXED_TZ = "UTC";
        const wrap = <T extends new (...args: any[]) => any>(Ctor: T): T => {
          const Wrapped: any = function (this: any, locale?: any, options?: any) {
            const opts = { timeZone: FIXED_TZ, ...(options || {}) };
            return new (Ctor as any)(FIXED_LOCALE, opts);
          };
          Wrapped.prototype = (Ctor as any).prototype;
          Wrapped.supportedLocalesOf = (Ctor as any).supportedLocalesOf?.bind(Ctor);
          return Wrapped;
        };
        if (typeof Intl !== "undefined") {
          // @ts-expect-error - override
          Intl.DateTimeFormat = wrap(Intl.DateTimeFormat);
          // @ts-expect-error - override
          Intl.NumberFormat = wrap(Intl.NumberFormat);
        }
        const dProto = RealDate.prototype as any;
        const origToLocaleDate = dProto.toLocaleDateString;
        const origToLocaleTime = dProto.toLocaleTimeString;
        const origToLocaleStr = dProto.toLocaleString;
        dProto.toLocaleDateString = function (_l?: any, o?: any) {
          return origToLocaleDate.call(this, FIXED_LOCALE, { timeZone: FIXED_TZ, ...(o || {}) });
        };
        dProto.toLocaleTimeString = function (_l?: any, o?: any) {
          return origToLocaleTime.call(this, FIXED_LOCALE, { timeZone: FIXED_TZ, ...(o || {}) });
        };
        dProto.toLocaleString = function (_l?: any, o?: any) {
          return origToLocaleStr.call(this, FIXED_LOCALE, { timeZone: FIXED_TZ, ...(o || {}) });
        };
      },
      { epoch: FROZEN_EPOCH_MS },
    );

    await page.emulateMedia({ reducedMotion: "reduce" });

    // Capture browser console + page errors so failing CI tests can
    // attach a complete log via test.info().attach(...).
    const consoleLog: string[] = [];
    page.on("console", (msg) => {
      consoleLog.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      consoleLog.push(`[pageerror] ${err.message}\n${err.stack || ""}`);
    });
    (page as any).__consoleLog = consoleLog;

    await use(page);
  },
});

export { expect };
