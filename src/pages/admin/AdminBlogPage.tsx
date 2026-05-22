import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import {
  Plus, Pencil, Trash2, Eye, FileText, Globe, PenLine, Search,
  ExternalLink, Copy, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computeSeoScore } from "@/lib/blog-seo-score";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StatusFilter = "all" | "published" | "draft" | "scheduled" | "archived";

export default function AdminBlogPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin-blog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.slug.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [posts, statusFilter, search]);

  const stats = useMemo(() => {
    if (!posts) return { total: 0, published: 0, drafts: 0, scheduled: 0 };
    return {
      total: posts.length,
      published: posts.filter((p) => p.status === "published").length,
      drafts: posts.filter((p) => p.status === "draft").length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
    };
  }, [posts]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleCopySlug = (slug: string) => {
    navigator.clipboard.writeText(`/blog/${slug}`);
    toast({ title: "Slug copied" });
  };

  const bulkStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const ids = Array.from(selected);
      const payload: any = { status: newStatus };
      if (newStatus === "published") payload.published_at = new Date().toISOString();
      const { error } = await supabase.from("blog_posts").update(payload).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      toast({ title: `${selected.size} post(s) updated` });
      setSelected(new Set());
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("blog_posts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      toast({ title: `${selected.size} post(s) deleted` });
      setSelected(new Set());
      setDeleteDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setDeleteDialogOpen(false);
    },
  });

  const isBulkLoading = bulkStatusMutation.isPending || bulkDeleteMutation.isPending;

  const statusTabs: { label: string; value: StatusFilter; count: number }[] = [
    { label: "All", value: "all", count: stats.total },
    { label: "Published", value: "published", count: stats.published },
    { label: "Drafts", value: "draft", count: stats.drafts },
    { label: "Scheduled", value: "scheduled", count: stats.scheduled },
  ];

  return (
    <>
      <SeoHead title="Posts - Admin" />
      <div className="space-y-6">
        {/* Ghost-style clean header */}
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
          >
            Posts
          </h1>
          <Link to="/admin/blog/new">
            <Button size="sm" className="gap-1.5 h-8 text-xs">
              <Plus className="h-3.5 w-3.5" /> New post
            </Button>
          </Link>
        </div>

        {/* Filters — Ghost-style minimal tabs + search */}
        <div className="flex items-center gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors rounded-md",
                  statusFilter === tab.value
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span className="ml-1 text-xs text-muted-foreground">{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto relative max-w-[220px] w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search posts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2.5 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <div className="h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" disabled={isBulkLoading} onClick={() => bulkStatusMutation.mutate("published")}>
              <Globe className="h-3 w-3" /> Publish
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" disabled={isBulkLoading} onClick={() => bulkStatusMutation.mutate("draft")}>
              <PenLine className="h-3 w-3" /> Unpublish
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive" disabled={isBulkLoading} onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
            <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {/* Post list — Ghost-style clean rows */}
        <div className="divide-y divide-border">
          {/* Header row */}
          <div className="flex items-center gap-4 py-2 text-xs font-medium text-muted-foreground">
            <div className="w-8 flex items-center justify-center">
              <Checkbox
                checked={filtered.length > 0 && selected.size === filtered.length}
                onCheckedChange={toggleAll}
              />
            </div>
            <div className="flex-1">Title</div>
            <div className="w-24 text-center hidden md:block">Status</div>
            <div className="w-32 hidden lg:block">Updated</div>
            <div className="w-24 text-right">Actions</div>
          </div>

          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-4 py-3 group hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
              <div className="w-8 flex items-center justify-center">
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
              </div>

              <div className="flex-1 min-w-0">
                <Link to={`/admin/blog/${p.id}/edit`} className="block">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {p.title}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">/{p.slug}</p>
                </Link>
              </div>

              <div className="w-24 text-center hidden md:flex items-center justify-center">
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium",
                  p.status === "published" ? "text-emerald-600" : p.status === "scheduled" ? "text-amber-600" : "text-muted-foreground"
                )}>
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    p.status === "published" ? "bg-emerald-500" : p.status === "scheduled" ? "bg-amber-500" : "bg-muted-foreground/40"
                  )} />
                  {p.status === "published" ? "Published" : p.status === "scheduled" ? "Scheduled" : "Draft"}
                </span>
              </div>

              <div className="w-32 text-xs text-muted-foreground hidden lg:block">
                {p.updated_at ? new Date(p.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
              </div>

              <div className="w-24 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link to={`/blog/${p.slug}`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="View">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
                <Link to={`/admin/blog/${p.id}/edit`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit">
                    <Pencil className="h-3 w-3" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy slug" onClick={() => handleCopySlug(p.slug)}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setSingleDeleteId(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              {search ? "No posts match your search." : "No posts yet. Create your first post."}
            </div>
          )}
        </div>
      </div>

      {/* Bulk delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} post(s)?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => bulkDeleteMutation.mutate()}>
              {bulkDeleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single delete dialog */}
      <AlertDialog open={!!singleDeleteId} onOpenChange={(open) => { if (!open) setSingleDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!singleDeleteId) return;
                const { error } = await supabase.from("blog_posts").delete().eq("id", singleDeleteId);
                if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
                else { queryClient.invalidateQueries({ queryKey: ["admin-blog"] }); toast({ title: "Post deleted" }); }
                setSingleDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
