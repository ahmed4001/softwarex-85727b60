import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";
import { UUID_RE } from "@/lib/identifier";

// Tables that produce public URLs from a slug-like column. Update this list
// whenever a new routable resource gets a slug column.
const TARGETS: Array<{
  table: string;
  col: "slug" | "username";
  route: (v: string) => string;
  label: string;
}> = [
  { table: "products", col: "slug", route: (s) => `/product/${s}`, label: "Products" },
  { table: "categories", col: "slug", route: (s) => `/categories/${s}`, label: "Categories" },
  { table: "blog_posts", col: "slug", route: (s) => `/blog/${s}`, label: "Blog Posts" },
  { table: "deals", col: "slug", route: (s) => `/deals/${s}`, label: "Deals" },
  { table: "discussions", col: "slug", route: (s) => `/discussions/${s}`, label: "Discussions" },
  { table: "lists", col: "slug", route: (s) => `/lists/${s}`, label: "Lists" },
  { table: "tech_stacks", col: "slug", route: (s) => `/tech-stacks/${s}`, label: "Tech Stacks" },
  { table: "comparisons", col: "slug", route: (s) => `/compare/${s}`, label: "Comparisons" },
  { table: "buyer_guides", col: "slug", route: (s) => `/buyer-guides/${s}`, label: "Buyer Guides" },
  { table: "glossary_terms", col: "slug", route: (s) => `/glossary/${s}`, label: "Glossary" },
  { table: "alternative_pages", col: "slug", route: (s) => `/alternatives/${s}`, label: "Alternatives" },
  { table: "keyword_landing_pages", col: "slug", route: (s) => `/${s}`, label: "Keyword Landing" },
  { table: "seo_landing_pages", col: "slug", route: (s) => `/${s}`, label: "SEO Landing" },
  { table: "pages", col: "slug", route: (s) => `/${s}`, label: "CMS Pages" },
  { table: "profiles", col: "username", route: (s) => `/u/${s}`, label: "User Profiles" },
];

interface Issue {
  value: string;
  reason: "uuid" | "missing" | "non_seo";
}

interface Report {
  table: string;
  label: string;
  col: string;
  route: (v: string) => string;
  total: number;
  missing: Issue[];
  uuidLike: Issue[];
  nonSeo: Issue[]; // contains underscores, spaces, uppercase, or "/"
}

// A slug is "non-SEO" if it contains characters that produce ugly URLs.
const NON_SEO_RE = /[^a-z0-9-]/;

export default function AdminSeoRouteAuditPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<Report[]>({
    queryKey: ["seo-route-audit"],
    queryFn: async () => {
      const reports: Report[] = [];
      for (const t of TARGETS) {
        const { data: rows, count } = await (supabase as any)
          .from(t.table)
          .select(`${t.col}`, { count: "exact" })
          .limit(20000);

        const missing: Issue[] = [];
        const uuidLike: Issue[] = [];
        const nonSeo: Issue[] = [];
        for (const r of rows ?? []) {
          const v = (r as any)[t.col] as string | null;
          if (!v || v.trim() === "") {
            missing.push({ value: "(empty)", reason: "missing" });
          } else if (UUID_RE.test(v)) {
            uuidLike.push({ value: v, reason: "uuid" });
          } else if (NON_SEO_RE.test(v)) {
            nonSeo.push({ value: v, reason: "non_seo" });
          }
        }
        reports.push({
          table: t.table,
          label: t.label,
          col: t.col,
          route: t.route,
          total: count ?? rows?.length ?? 0,
          missing,
          uuidLike,
          nonSeo,
        });
      }
      return reports;
    },
  });

  const totalIssues = (data ?? []).reduce(
    (n, r) => n + r.missing.length + r.uuidLike.length + r.nonSeo.length,
    0,
  );

  return (
    <div className="space-y-6">
      <SeoHead title="SEO Route Audit | Admin" robots="noindex" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            SEO Route Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scans every routable table for UUID-style slugs, missing slugs, and non-SEO characters.
            Re-run after imports or schema changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={totalIssues === 0 ? "default" : "destructive"}>
            {totalIssues === 0 ? "All clean" : `${totalIssues} issues`}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Re-scan
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-12">Scanning routes…</div>
      )}

      <div className="grid gap-4">
        {(data ?? []).map((r) => {
          const issueCount = r.missing.length + r.uuidLike.length + r.nonSeo.length;
          return (
            <Card key={r.table} className={issueCount > 0 ? "border-amber-500/40" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {issueCount === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    {r.label}
                    <span className="text-xs font-mono text-muted-foreground">
                      {r.table}.{r.col}
                    </span>
                  </span>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{r.total} rows</Badge>
                    {r.uuidLike.length > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {r.uuidLike.length} UUID
                      </Badge>
                    )}
                    {r.missing.length > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {r.missing.length} missing
                      </Badge>
                    )}
                    {r.nonSeo.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {r.nonSeo.length} non-SEO
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              {issueCount > 0 && (
                <CardContent className="space-y-3">
                  {r.uuidLike.length > 0 && (
                    <IssueGroup
                      title="UUID-style slugs — redirect to canonical slug"
                      items={r.uuidLike.slice(0, 10)}
                      route={r.route}
                      tone="destructive"
                    />
                  )}
                  {r.missing.length > 0 && (
                    <IssueGroup
                      title="Missing slugs — backfill required"
                      items={r.missing.slice(0, 10)}
                      route={r.route}
                      tone="destructive"
                    />
                  )}
                  {r.nonSeo.length > 0 && (
                    <IssueGroup
                      title="Non-SEO characters (uppercase, _, spaces, /)"
                      items={r.nonSeo.slice(0, 10)}
                      route={r.route}
                      tone="secondary"
                    />
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function IssueGroup({
  title,
  items,
  route,
  tone,
}: {
  title: string;
  items: Issue[];
  route: (v: string) => string;
  tone: "destructive" | "secondary";
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <a
            key={`${it.value}-${i}`}
            href={route(it.value)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded border bg-muted/40 hover:bg-muted transition-colors"
          >
            <Badge variant={tone} className="text-[9px] py-0 px-1">{it.reason}</Badge>
            {it.value}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        ))}
      </div>
    </div>
  );
}
