import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Square, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Summary = {
  total: number; updated: number; no_match: number; skipped: number; errors: number;
  aborted?: boolean; abort_reason?: string | null;
};

const PROJECT_REF = "ffeimjfunghzxgeqiwma";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg";

export function BackfillRunnerPanel() {
  const qc = useQueryClient();
  const [batchSize, setBatchSize] = useState(15);
  const [multiplier, setMultiplier] = useState(30);
  const [concurrency, setConcurrency] = useState(2);
  const [minConfidence, setMinConfidence] = useState(0.7);
  const [maxMissRate, setMaxMissRate] = useState(0.7);
  const [rateLimitMs, setRateLimitMs] = useState(400);
  const [batches, setBatches] = useState(5);
  const [dryRun, setDryRun] = useState(false);

  const [running, setRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [history, setHistory] = useState<Summary[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function callOnce(): Promise<Summary | null> {
    const res = await fetch(
      `https://${PROJECT_REF}.supabase.co/functions/v1/backfill-product-websites`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          batch_size: batchSize,
          oversample_multiplier: multiplier,
          concurrency,
          min_confidence: minConfidence,
          max_miss_rate: maxMissRate,
          rate_limit_ms: rateLimitMs,
          dry_run: dryRun,
        }),
      },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      toast.error(data?.error || `HTTP ${res.status}`);
      return null;
    }
    return data.summary as Summary;
  }

  async function run() {
    setRunning(true);
    setStopRequested(false);
    setHistory([]);
    setProgress({ done: 0, total: batches });
    try {
      for (let i = 0; i < batches; i++) {
        if (stopRequested) break;
        const summary = await callOnce();
        if (!summary) break;
        setHistory((h) => [...h, summary]);
        setProgress({ done: i + 1, total: batches });
        if (summary.total === 0) {
          toast.info("No more candidates — stopping.");
          break;
        }
        if (summary.aborted) {
          toast.warning(`Batch aborted: ${summary.abort_reason}`);
          break;
        }
      }
      qc.invalidateQueries({ queryKey: ["admin-backfill-log"] });
      toast.success("Backfill run complete");
    } finally {
      setRunning(false);
      setStopRequested(false);
    }
  }

  const totals = history.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      updated: acc.updated + s.updated,
      no_match: acc.no_match + s.no_match,
      skipped: acc.skipped + s.skipped,
      errors: acc.errors + s.errors,
    }),
    { total: 0, updated: 0, no_match: 0, skipped: 0, errors: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" /> Backfill Runner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <Field label="Batch size" hint="rows per call (1–200)">
            <Input type="number" min={1} max={200} value={batchSize}
              onChange={(e) => setBatchSize(+e.target.value)} disabled={running} />
          </Field>
          <Field label="Candidate × multiplier" hint="oversample to dodge tried">
            <Input type="number" min={1} max={100} value={multiplier}
              onChange={(e) => setMultiplier(+e.target.value)} disabled={running} />
          </Field>
          <Field label="Concurrency" hint="parallel Firecrawl calls (1–10)">
            <Input type="number" min={1} max={10} value={concurrency}
              onChange={(e) => setConcurrency(+e.target.value)} disabled={running} />
          </Field>
          <Field label="Min confidence" hint="0–1, reject loose matches">
            <Input type="number" step="0.05" min={0} max={1} value={minConfidence}
              onChange={(e) => setMinConfidence(+e.target.value)} disabled={running} />
          </Field>
          <Field label="Max miss rate" hint="abort batch if exceeded">
            <Input type="number" step="0.05" min={0} max={1} value={maxMissRate}
              onChange={(e) => setMaxMissRate(+e.target.value)} disabled={running} />
          </Field>
          <Field label="Rate limit (ms)" hint="delay between calls per worker">
            <Input type="number" min={0} max={5000} step={50} value={rateLimitMs}
              onChange={(e) => setRateLimitMs(+e.target.value)} disabled={running} />
          </Field>
          <Field label="Batches" hint="how many batch calls to chain">
            <Input type="number" min={1} max={50} value={batches}
              onChange={(e) => setBatches(+e.target.value)} disabled={running} />
          </Field>
          <Field label="Dry run" hint="don't write website_url">
            <div className="flex items-center h-9 px-1">
              <Switch checked={dryRun} onCheckedChange={setDryRun} disabled={running} />
            </div>
          </Field>
        </div>

        <div className="flex items-center gap-3">
          {!running ? (
            <Button onClick={run} className="gap-2">
              <Play className="h-4 w-4" /> Start
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setStopRequested(true)} className="gap-2">
              <Square className="h-4 w-4" /> Stop after current
            </Button>
          )}
          {running && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Batch {progress?.done ?? 0}/{progress?.total ?? 0}
            </span>
          )}
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="default">Updated {totals.updated}</Badge>
              <Badge variant="destructive">No match {totals.no_match}</Badge>
              <Badge variant="secondary">Skipped {totals.skipped}</Badge>
              {totals.errors > 0 && <Badge variant="outline">Errors {totals.errors}</Badge>}
              <Badge variant="outline">Total {totals.total}</Badge>
            </div>
            <div className="text-xs text-muted-foreground font-mono space-y-0.5 max-h-32 overflow-auto">
              {history.map((s, i) => (
                <div key={i}>
                  #{i + 1}: {s.updated}✓ / {s.no_match}✗ / {s.skipped}— / {s.errors}!  ({s.total} attempted)
                  {s.aborted && <span className="text-amber-600"> · aborted: {s.abort_reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
