#!/usr/bin/env node
// Flaky-test quarantine maintenance.
//
// Reads:
//   - tests/e2e/quarantine.json     — current quarantine list + thresholds
//   - .ci-history/spec-history.json — last N run results per spec
//     (downloaded from the previous workflow run's history artifact)
//
// Writes:
//   - tests/e2e/quarantine.json (in-place, only if changes)
//   - quarantine-changes.md (markdown summary for PR comment / dashboard)
//
// Rules:
//   - Quarantine a spec if its recent failure rate > flakeFailThreshold
//     within the last windowSize runs AND it is not 100% failing
//     (a 100%-failing spec is broken, not flaky, and should stay blocking).
//   - Promote a quarantined spec back to blocking after passThreshold
//     consecutive passes.

import fs from "node:fs";
import path from "node:path";

const QFILE = "tests/e2e/quarantine.json";
const HFILE = ".ci-history/spec-history.json";
const OUT = "quarantine-changes.md";

const q = JSON.parse(fs.readFileSync(QFILE, "utf8"));
const history = fs.existsSync(HFILE)
  ? JSON.parse(fs.readFileSync(HFILE, "utf8"))
  : { runs: [] };

const passThreshold = q.passThreshold ?? 5;
const failThreshold = q.flakeFailThreshold ?? 0.2;
const windowSize = q.windowSize ?? 20;

// Build per-spec recent result arrays (newest first).
const recent = history.runs.slice(-windowSize);
const perSpec = new Map(); // spec -> ["pass"|"fail", ...]
for (const run of recent) {
  for (const [spec, status] of Object.entries(run.specs || {})) {
    if (!perSpec.has(spec)) perSpec.set(spec, []);
    perSpec.get(spec).push(status);
  }
}

const current = new Set(q.quarantined || []);
const added = [];
const removed = [];

for (const [spec, results] of perSpec.entries()) {
  const fails = results.filter((r) => r === "fail").length;
  const rate = fails / results.length;
  const allFail = fails === results.length && results.length >= 3;
  const consecutivePasses = (() => {
    let n = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i] === "pass") n++;
      else break;
    }
    return n;
  })();

  if (current.has(spec)) {
    if (consecutivePasses >= passThreshold) {
      current.delete(spec);
      removed.push({ spec, consecutivePasses });
    }
  } else {
    if (!allFail && rate > failThreshold && results.length >= 5) {
      current.add(spec);
      added.push({ spec, rate: Number((rate * 100).toFixed(1)), fails, total: results.length });
    }
  }
}

q.quarantined = [...current].sort();
fs.writeFileSync(QFILE, JSON.stringify(q, null, 2) + "\n");

const lines = ["## Quarantine changes", ""];
if (!added.length && !removed.length) {
  lines.push("_No changes — quarantine list stable._");
} else {
  if (added.length) {
    lines.push("### Quarantined (now non-blocking)");
    for (const a of added) lines.push(`- \`${a.spec}\` — failed ${a.fails}/${a.total} (${a.rate}%)`);
    lines.push("");
  }
  if (removed.length) {
    lines.push("### Promoted back to blocking");
    for (const r of removed) lines.push(`- \`${r.spec}\` — ${r.consecutivePasses} consecutive passes`);
    lines.push("");
  }
}
fs.writeFileSync(OUT, lines.join("\n"));
console.log(lines.join("\n"));
