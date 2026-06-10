#!/usr/bin/env node
// Renders a markdown "CI run history" block from .ci-history/spec-history.json:
//   - Lighthouse score trend per URL (last N runs, sparkline)
//   - Playwright failure frequency per spec (last N runs)
// Writes to history-block.md. Concatenated into the sticky PR dashboard.

import fs from "node:fs";

const HFILE = ".ci-history/spec-history.json";
const OUT = "history-block.md";
const N = Number(process.env.HISTORY_VIEW_N || 10);

if (!fs.existsSync(HFILE)) {
  fs.writeFileSync(OUT, "## CI run history\n\n_No history yet — first run._\n");
  process.exit(0);
}

const h = JSON.parse(fs.readFileSync(HFILE, "utf8"));
const runs = h.runs.slice(-N);

// ---- Lighthouse trend (per URL, per category) ----
const lhUrls = new Set();
for (const r of runs) for (const u of Object.keys(r.lighthouse || {})) lhUrls.add(u);

// Unicode sparkline blocks for score values [0..1].
const BLOCKS = "▁▂▃▄▅▆▇█";
function spark(values) {
  return values
    .map((v) => (v == null ? "·" : BLOCKS[Math.min(7, Math.max(0, Math.round(v * 7)))]))
    .join("");
}
function lastScore(values) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return Math.round(values[i] * 100);
  return "—";
}

// ---- Spec failure frequency ----
const specCounts = new Map(); // spec -> {fail, total}
for (const r of runs) {
  for (const [s, st] of Object.entries(r.specs || {})) {
    if (!specCounts.has(s)) specCounts.set(s, { fail: 0, total: 0 });
    const c = specCounts.get(s);
    c.total++;
    if (st === "fail") c.fail++;
  }
}
const flaky = [...specCounts.entries()]
  .map(([s, c]) => ({ s, ...c, rate: c.fail / c.total }))
  .filter((r) => r.fail > 0)
  .sort((a, b) => b.rate - a.rate || b.fail - a.fail);

const lines = [];
lines.push(`## CI run history (last ${runs.length})`);
lines.push("");

lines.push("### Lighthouse score trend");
if (!lhUrls.size) {
  lines.push("_No Lighthouse data captured in window._");
} else {
  lines.push("| URL | Perf | SEO | A11y | Best Practices |");
  lines.push("|---|---|---|---|---|");
  for (const url of lhUrls) {
    const series = (k) => runs.map((r) => r.lighthouse?.[url]?.[k] ?? null);
    const p = series("perf"), s = series("seo"), a = series("a11y"), b = series("bp");
    lines.push(
      `| \`${url}\` | \`${spark(p)}\` ${lastScore(p)} | \`${spark(s)}\` ${lastScore(s)} | \`${spark(a)}\` ${lastScore(a)} | \`${spark(b)}\` ${lastScore(b)} |`,
    );
  }
}
lines.push("");

lines.push("### Playwright failure frequency per spec");
if (!flaky.length) {
  lines.push("_All specs passed in every recorded run — nice._");
} else {
  lines.push("| Spec | Failures | Rate |");
  lines.push("|---|---:|---:|");
  for (const f of flaky.slice(0, 20)) {
    lines.push(`| \`${f.s}\` | ${f.fail} / ${f.total} | ${(f.rate * 100).toFixed(1)}% |`);
  }
}
lines.push("");

fs.writeFileSync(OUT, lines.join("\n"));
console.log(lines.join("\n"));
