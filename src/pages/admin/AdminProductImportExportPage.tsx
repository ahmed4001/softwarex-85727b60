import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const CSV_HEADERS = ["name", "slug", "tagline", "description", "website_url", "pricing_model", "starting_price", "category_id", "is_active", "is_featured"];

function escapeCsv(val: any): string {
  if (val == null) return "";
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else current += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { result.push(current.trim()); current = ""; }
      else current += c;
    }
  }
  result.push(current.trim());
  return result;
}

export default function AdminProductImportExportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["all-products-export"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("name, slug, tagline, description, website_url, pricing_model, starting_price, category_id, is_active, is_featured").order("name");
      return data || [];
    },
  });

  const handleExport = () => {
    const rows = [CSV_HEADERS.join(",")];
    products.forEach((p: any) => {
      rows.push(CSV_HEADERS.map((h) => escapeCsv(p[h])).join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${products.length} products`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
      const nameIdx = headers.indexOf("name");
      const slugIdx = headers.indexOf("slug");
      if (nameIdx === -1 || slugIdx === -1) throw new Error("CSV must include 'name' and 'slug' columns");

      let success = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const vals = parseCsvLine(lines[i]);
        const row: any = {};
        headers.forEach((h, idx) => {
          if (CSV_HEADERS.includes(h) && vals[idx]) {
            let val: any = vals[idx];
            if (h === "starting_price") val = parseFloat(val) || null;
            if (h === "is_active" || h === "is_featured") val = val === "true" || val === "1";
            row[h] = val;
          }
        });

        if (!row.name || !row.slug) {
          errors.push(`Row ${i + 1}: Missing name or slug`);
          continue;
        }

        const { error } = await supabase.from("products").upsert(row, { onConflict: "slug" });
        if (error) {
          errors.push(`Row ${i + 1} (${row.name}): ${error.message}`);
        } else {
          success++;
        }
      }

      setImportResult({ success, errors });
      if (success > 0) toast.success(`Imported ${success} products`);
      if (errors.length > 0) toast.error(`${errors.length} rows had errors`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <SeoHead title="Import/Export - Admin" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" /> Product Import & Export
          </h1>
          <p className="text-muted-foreground">Bulk manage products via CSV files</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Export Products</CardTitle>
              <CardDescription>Download all products as a CSV file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Loading..." : `${products.length} products available for export`}
              </p>
              <p className="text-xs text-muted-foreground">
                Columns: {CSV_HEADERS.join(", ")}
              </p>
              <Button onClick={handleExport} disabled={isLoading || products.length === 0} className="gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </CardContent>
          </Card>

          {/* Import */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import Products</CardTitle>
              <CardDescription>Upload a CSV file to create or update products</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                CSV must include <strong>name</strong> and <strong>slug</strong> columns. Existing products with matching slugs will be updated.
              </p>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={importing} variant="outline" className="gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? "Importing..." : "Choose CSV File"}
              </Button>

              {importResult && (
                <div className="space-y-2 p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{importResult.success} products imported successfully</span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>{importResult.errors.length} errors</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                        {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
