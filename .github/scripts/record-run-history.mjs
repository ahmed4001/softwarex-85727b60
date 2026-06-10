#!/usr/bin/env node
// Records the current run's per-spec pass/fail status into the rolling
// history file (.ci-history/spec-history.json), capped at HISTORY_MAX
// runs. The history file is round-tripped between CI runs as an
// artifact ("seo-ci-history"), since GitHub Actions has no built-in
// "last N runs" persistent store.

import fs from "node:fs";
import path from "node:path";

const HFILE = ".ci-history/spec-history.json";
const RESULTS_DIR = "pw-merged-results";
const HISTORY_MAX = Number(process.env.HISTORY_MAX || 50);

fs.mkdirSync(path.dirname(HFILE), { recursive: true });
const history = fs.existsSync(HFILE)
  ? JSON.parse(fs.readFileSync(HFILE, "utf8"))
  : { runs: [] };

// Collect spec status from Playwright JSON reporter output, if present.
// We accept any *.json under RESULTS_DIR whose shape looks like a
// Playwright report (has `.suites` or `.stats`).
function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const specStatus = {}; // "tests/e2e/foo.spec.ts" -> "pass"|"fail"

function visit(suite, fileHint) {
  const file = suite.file || fileHint;
  for (const t of suite.tests || []) {
    const failed = (t.results || []).some(
      (r) => r.status !== "passed" && r.status !== "skipped",
    );
    const cur = specStatus[file];
    if (failed) specStatus[file] = "fail";
    else if (!cur) specStatus[file] = "pass";
  }
  for (const s of suite.suites || []) visit(s, file);
}

for (const f of walk(RESULTS_DIR)) {
  if (!f.endsWith(".json")) continue;
  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const s of j.suites || []) visit(s, s.file);
  } catch {}
}

history.runs.push({
  ts: new Date().toISOString(),
  runId: process.env.GITHUB_RUN_ID || null,
  sha: (process.env.GITHUB_SHA || "").slice(0, 7) || null,
  pr: process.env.PR_NUMBER || null,
  specs: specStatus,
});
history.runs = history.runs.slice(-HISTORY_MAX);

// Per-run Lighthouse score capture, if available.
if (fs.existsSync("lh-artifacts")) {
  const lhScores = {};
  for (const f of walk("lh-artifacts")) {
    if (!/lhr-.*\.json$/.test(f)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(f, "utf8"));
      const url = j.finalDisplayedUrl || j.requestedUrl || path.basename(f);
      const cats = j.categories || {};
      lhScores[url] = {
        perf: cats.performance?.score ?? null,
        seo: cats.seo?.score ?? null,
        a11y: cats.accessibility?.score ?? null,
        bp: cats["best-practices"]?.score ?? null,
      };
    } catch {}
  }
  history.runs[history.runs.length - 1].lighthouse = lhScores;
}

fs.writeFileSync(HFILE, JSON.stringify(history, null, 2) + "\n");
console.log(`Recorded run; ${history.runs.length} runs in history; specs=${Object.keys(specStatus).length}`);
