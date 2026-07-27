import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  category_id: string | null;
  category_name: string | null;
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: number;
  difficulty: number;
  opportunity_score: number;
  status: string;
};

const difficultyTone = (kd: number) =>
  kd < 30 ? "text-emerald-600" : kd < 50 ? "text-amber-600" : "text-destructive";

export default function AdminKeywordOpportunitiesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [importing, setImporting] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["keyword-opportunities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("keyword_opportunities")
        .select("*")
        .order("opportunity_score", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category_name).filter(Boolean))) as string[],
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (category === "all" || r.category_name === category) &&
          r.keyword.toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, category, search],
  );

  const runImport = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("import-category-keywords", {
        body: { category_limit: 10, per_keyword: 30, max_difficulty: 45, min_volume: 100 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data?.imported ?? 0} keywords across ${data?.categories ?? 0} categories`);
      qc.invalidateQueries({ queryKey: ["keyword-opportunities"] });
    },
    onError: (e: any) => toast.error(e.message || "Import failed"),
    onSettled: () => setImporting(false),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("keyword_opportunities")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keyword-opportunities"] }),
  });

  return (
    <>
      <SeoHead title="Keyword Opportunities - Admin" robots="noindex, nofollow" />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Keyword Opportunities</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} low-competition keywords imported from Semrush · sorted by opportunity score
            </p>
          </div>
          <Button
            onClick={() => {
              setImporting(true);
              runImport.mutate();
            }}
            disabled={importing}
            className="gap-1.5"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Import from Semrush
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter keywords…"
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <TrendingUp className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>No keywords yet — run an import to pull ideas for your top categories.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">KD</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">{r.keyword}</TableCell>
                    <TableCell className="text-muted-foreground">{r.category_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.search_volume.toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${difficultyTone(r.difficulty)}`}>
                      {Math.round(r.difficulty)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">${Number(r.cpc).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {r.opportunity_score}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "planned" ? "default" : "outline"}
                        className="cursor-pointer text-[10px]"
                        onClick={() =>
                          updateStatus.mutate({
                            id: r.id,
                            status: r.status === "planned" ? "new" : "planned",
                          })
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
