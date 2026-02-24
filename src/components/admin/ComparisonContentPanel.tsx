import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Square, CheckCircle2, AlertCircle, Zap, BarChart3 } from "lucide-react";

type Stats = { enriched: number; total: number };
type LogEntry = { time: string; message: string; type: "success" | "error" | "info" };

export default function ComparisonContentPanel() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ enriched: 0, total: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [batchesProcessed, setBatchesProcessed] = useState(0);
  const stopRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchStats = useCallback(async () => {
    const { data } = await supabase
      .from("comparisons")
      .select("id, summary", { count: "exact", head: false });
    if (data) {
      const enriched = data.filter((c: any) => c.summary).length;
      setStats({ enriched, total: data.length });
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  const runBatch = async (): Promise<number> => {
    const { data, error } = await supabase.functions.invoke("generate-comparison-content", {
      body: { batch_size: 5 },
    });
    if (error) throw error;
    return data?.processed || 0;
  };

  const startGeneration = async () => {
    setIsRunning(true);
    stopRef.current = false;
    setLogs([]);
    setBatchesProcessed(0);
    addLog("Starting bulk comparison content generation...", "info");

    let totalProcessed = 0;
    let consecutiveEmpty = 0;

    while (!stopRef.current) {
      try {
        const processed = await runBatch();
        totalProcessed += processed;
        setBatchesProcessed((p) => p + 1);

        if (processed > 0) {
          consecutiveEmpty = 0;
          addLog(`Batch complete: ${processed} comparisons enriched (${totalProcessed} total)`, "success");
        } else {
          consecutiveEmpty++;
          addLog("No comparisons to process in this batch", "info");
        }

        await fetchStats();

        if (consecutiveEmpty >= 3) {
          addLog("All comparisons have been enriched! 🎉", "success");
          break;
        }

        // Small delay between batches
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        addLog(`Error: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (stopRef.current) {
      addLog("Generation stopped by user", "info");
    }

    setIsRunning(false);
    toast({ title: "Generation complete", description: `${totalProcessed} comparisons enriched.` });
  };

  const stopGeneration = () => {
    stopRef.current = true;
    addLog("Stopping after current batch...", "info");
  };

  const remaining = stats.total - stats.enriched;
  const progressPct = stats.total > 0 ? (stats.enriched / stats.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Comparisons</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.enriched}</div>
            <div className="text-sm text-muted-foreground">Enriched</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{remaining}</div>
            <div className="text-sm text-muted-foreground">Remaining</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{batchesProcessed}</div>
            <div className="text-sm text-muted-foreground">Batches Run</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <p className="text-xs text-muted-foreground">
            {stats.enriched} of {stats.total} comparisons have AI-generated content
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {!isRunning ? (
          <Button onClick={startGeneration} size="lg" disabled={remaining === 0}>
            <Play className="mr-2 h-4 w-4" />
            Generate Content ({remaining} remaining)
          </Button>
        ) : (
          <Button onClick={stopGeneration} size="lg" variant="destructive">
            <Square className="mr-2 h-4 w-4" />
            Stop Generation
          </Button>
        )}
        <Button onClick={fetchStats} variant="outline" size="lg" disabled={isRunning}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Refresh Stats
        </Button>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Generation Log
            </CardTitle>
            <CardDescription>{logs.length} entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto space-y-1 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/50">
                  {log.type === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />}
                  {log.type === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />}
                  {log.type === "info" && <Loader2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />}
                  <span className="text-muted-foreground">[{log.time}]</span>
                  <span className={log.type === "error" ? "text-destructive" : "text-foreground"}>{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
