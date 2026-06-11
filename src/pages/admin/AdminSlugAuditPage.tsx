import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Search, FileText, Globe, Layout, AlertTriangle, ExternalLink, Copy, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface SlugRow {
  source: "pages" | "keyword_landing_pages" | "seo_landing_pages";
  slug: string;
  title: string;
  status?: string;
  is_active?: boolean;
  is_published?: boolean;
  show_in_nav?: boolean;
  show_in_footer?: boolean;
  created_at: string;
  updated_at: string;
}

const ABOUT_PATTERNS = [
  "about",
  "careers",
  "trust",
  "safety",
  "compliance",
  "privacy",
  "terms",
  "press",
  "contact",
  "support",
  "help",
  "faq",
  "team",
  "company",
  "mission",
  "values",
  "legal",
  "security",
  "gdpr",
  "cookie",
];

function isAboutRelated(slug: string, title: string): boolean {
  const combined = `${slug} ${title}`.toLowerCase();
  return ABOUT_PATTERNS.some((p) => combined.includes(p));
}

function StatusBadge({ row }: { row: SlugRow }) {
  if (row.source === "pages") {
    return (
      <div className="flex gap-1 flex-wrap">
        {row.is_active ? (
          <Badge variant="default" className="text-[10px]">Active</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
        )}
        {row.show_in_nav && <Badge variant="outline" className="text-[10px]">Nav</Badge>}
        {row.show_in_footer && <Badge variant="outline" className="text-[10px]">Footer</Badge>}
      </div>
    );
  }
  if (row.source === "keyword_landing_pages") {
    return (
      <div className="flex gap-1 flex-wrap">
        {row.is_published ? (
          <Badge variant="default" className="text-[10px]">Published</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">Draft</Badge>
        )}
        <Badge variant="outline" className="text-[10px]">{row.status || "—"}</Badge>
      </div>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      {row.is_published ? "Published" : "Draft"}
    </Badge>
  );
}

function SourceIcon({ source }: { source: SlugRow["source"] }) {
  if (source === "pages") return <FileText className="w-4 h-4 text-muted-foreground" />;
  if (source === "keyword_landing_pages") return <Globe className="w-4 h-4 text-muted-foreground" />;
  return <Layout className="w-4 h-4 text-muted-foreground" />;
}

function SourceLabel({ source }: { source: SlugRow["source"] }) {
  if (source === "pages") return "CMS Pages";
  if (source === "keyword_landing_pages") return "Keyword Landing Pages";
  return "SEO Landing Pages";
}

export default function AdminSlugAuditPage() {
  const [search, setSearch] = useState("");
  const [aboutOnly, setAboutOnly] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery<SlugRow[]>({
    queryKey: ["admin-slug-audit"],
    queryFn: async () => {
      const [pages, klp, slp] = await Promise.all([
        supabase
          .from("pages")
          .select("slug,title,is_active,show_in_nav,show_in_footer,created_at,updated_at")
          .order("slug", { ascending: true }),
        supabase
          .from("keyword_landing_pages")
          .select("slug,focus_keyword,status,is_published,created_at,updated_at")
          .order("slug", { ascending: true }),
        supabase
          .from("seo_landing_pages")
          .select("slug,title,is_published,created_at,updated_at")
          .order("slug", { ascending: true }),
      ]);

      const out: SlugRow[] = [];
      for (const r of pages.data ?? []) {
        out.push({
          source: "pages",
          slug: r.slug,
          title: r.title,
          is_active: r.is_active,
          show_in_nav: r.show_in_nav,
          show_in_footer: r.show_in_footer,
          created_at: r.created_at,
          updated_at: r.updated_at,
        });
      }
      for (const r of klp.data ?? []) {
        out.push({
          source: "keyword_landing_pages",
          slug: r.slug,
          title: r.focus_keyword || r.slug,
          status: r.status,
          is_published: r.is_published,
          created_at: r.created_at,
          updated_at: r.updated_at,
        });
      }
      for (const r of slp.data ?? []) {
        out.push({
          source: "seo_landing_pages",
          slug: r.slug,
          title: r.title || r.slug,
          is_published: r.is_published,
          created_at: r.created_at,
          updated_at: r.updated_at,
        });
      }
      return out;
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    let list = rows;
    if (aboutOnly) {
      list = list.filter((r) => isAboutRelated(r.slug, r.title));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.slug.toLowerCase().includes(q) || r.title.toLowerCase().includes(q));
    }
    return list;
  }, [rows, aboutOnly, search]);

  const grouped = useMemo(() => {
    const map = new Map<SlugRow["source"], SlugRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.source) ?? [];
      arr.push(r);
      map.set(r.source, arr);
    }
    return map;
  }, [filtered]);

  const aboutCount = useMemo(() => {
    if (!rows) return 0;
    return rows.filter((r) => isAboutRelated(r.slug, r.title)).length;
  }, [rows]);

  const handleCopy = (slug: string) => {
    navigator.clipboard.writeText(slug);
    setCopiedSlug(slug);
    toast.success("Copied slug to clipboard");
    setTimeout(() => setCopiedSlug(null), 1500);
  };

  return (
    <div className="space-y-6">
      <SeoHead title="Slug Audit | Admin" robots="noindex" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Slug Audit
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Inspect every About-related slug across CMS Pages, Keyword Landing Pages, and SEO Landing Pages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {aboutCount} About-related
          </Badge>
          <Badge variant="outline" className="text-xs">
            {rows?.length ?? 0} total slugs
          </Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search slugs or titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={aboutOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setAboutOnly((v) => !v)}
        >
          {aboutOnly ? "Showing About-related only" : "Showing all slugs"}
        </Button>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-12">Loading slug data…</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No slugs match your filters.
        </div>
      )}

      {Array.from(grouped.entries()).map(([source, items]) => (
        <Card key={source}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <SourceIcon source={source} />
              {SourceLabel(source)}
              <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Slug</th>
                    <th className="text-left py-2 pr-4 font-medium">Title / Keyword</th>
                    <th className="text-left py-2 pr-4 font-medium">Status</th>
                    <th className="text-left py-2 pr-4 font-medium">Created</th>
                    <th className="text-left py-2 pr-4 font-medium">Updated</th>
                    <th className="text-right py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={`${source}-${row.slug}`} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-4 font-mono text-xs flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(row.slug)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy slug"
                        >
                          {copiedSlug === row.slug ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className={isAboutRelated(row.slug, row.title) ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                          /{row.slug}
                        </span>
                      </td>
                      <td className="py-2 pr-4 max-w-[240px] truncate">{row.title}</td>
                      <td className="py-2 pr-4"><StatusBadge row={row} /></td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">
                        {new Date(row.updated_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-right">
                        <a
                          href={`https://id-preview--8f8ab8bf-14f5-4085-9849-266b90f727c8.lovable.app/${row.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <h4 className="text-sm font-semibold mb-2">Why so many About pages?</h4>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>CMS <strong>Pages</strong> table holds static pages like <code>/about</code>, <code>/careers</code>, <code>/trust</code>.</li>
            <li>Keyword Landing Pages may auto-generate <code>/about-*</code> URLs if focus keywords include "about".</li>
            <li>SEO Landing Pages may also create topic-based <code>/about-*</code> slugs.</li>
            <li>Check the <strong>PublicLayout</strong> footer links — each footer link creates a user-visible URL demand.</li>
            <li>Routes in <code>App.tsx</code> may have a catch-all or dynamic segment that renders content for any slug.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
