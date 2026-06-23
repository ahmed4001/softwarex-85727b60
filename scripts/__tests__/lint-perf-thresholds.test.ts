import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const linter = path.resolve(__dirname, "../lint-perf-thresholds.ts");

function writeTempFile(obj: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-perf-"));
  const p = path.join(dir, "perf-thresholds.json");
  fs.writeFileSync(p, typeof obj === "string" ? obj : JSON.stringify(obj));
  return p;
}

function runLinter(file: string, env: Record<string, string> = {}, args: string[] = []) {
  return spawnSync("npx", ["tsx", linter, ...args], {
    env: { ...process.env, PERF_THRESHOLDS_FILE: file, ...env },
    encoding: "utf8",
  });
}

describe("lint-perf-thresholds CLI", () => {
  it("exits 0 on a valid file and prints the resolved profile", () => {
    const f = writeTempFile({
      default: { mean_ms: 200, max_ms: 800 },
      ci: { mean_ms: 250, max_ms: 1000, queries: [{ label: "x", match: "x", mean_ms: 5 }] },
    });
    const r = runLinter(f, { PERF_ENV: "ci" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/perf-thresholds is valid/);
    expect(r.stdout).toMatch(/Resolved PERF_ENV profile: ci/);
    expect(r.stdout).toMatch(/per-query overrides \(1\)/);
  });

  it("exits 1 when required keys are missing", () => {
    const f = writeTempFile({ default: { max_ms: 800 } });
    const r = runLinter(f);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/mean_ms/);
  });

  it("exits 1 when types are wrong", () => {
    const f = writeTempFile({ default: { mean_ms: "fast", max_ms: 800 } });
    const r = runLinter(f);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/mean_ms/);
  });

  it("exits 1 on invalid JSON", () => {
    const f = writeTempFile("{ broken");
    const r = runLinter(f);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Invalid JSON/);
  });

  it("--dry-run succeeds and mentions dry-run", () => {
    const f = writeTempFile({ default: { mean_ms: 200, max_ms: 800 } });
    const r = runLinter(f, {}, ["--dry-run"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/dry-run/);
  });
}, { timeout: 30000 });
