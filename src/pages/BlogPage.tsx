import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Eye, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export default function BlogPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get("tag") || "";
  const activeCategory = searchParams.get("category") || "";

  const { data: posts, isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      return data || [];
    },
  });

  const allTags = useMemo(() => {
    if (!posts) return [];
    const tagSet = new Set<string>();
    posts.forEach((p) => {
      const tags = Array.isArray(p.tags) ? (p.tags as string[]) : [];
      tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const allCategories = useMemo(() => {
    if (!posts) return [];
    const catSet = new Set<string>();
    posts.forEach((p) => {
      if (p.category) catSet.add(p.category);
    });
    return Array.from(catSet).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const recentPosts = useMemo(() => {
    return (posts || []).slice(0, 5);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (!posts) return posts;
    let result = posts;
    if (activeCategory) {
      result = result.filter((p) => p.category === activeCategory);
    }
    if (activeTag) {
      result = result.filter((p) => {
        const tags = Array.isArray(p.tags) ? (p.tags as string[]) : [];
        return tags.includes(activeTag);
      });
    }
    return result;
  }, [posts, activeTag, activeCategory]);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil((filteredPosts?.length ?? 0) / PAGE_SIZE));
  const paginatedPosts = useMemo(() => {
    if (!filteredPosts) return [];
    return filteredPosts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filteredPosts, page]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [activeTag, activeCategory]);

  const setFilter = (key: "tag" | "category", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  return (
    <>
      <SeoHead title={t("blog.title")} description={t("blog.subtitle")} />
      <div className="container py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">{t("blog.title")}</h1>
        <p className="text-muted-foreground mb-4">{t("blog.subtitle")}</p>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto pb-2">
            <Badge
              variant={activeTag === "" ? "default" : "outline"}
              className="cursor-pointer shrink-0"
              onClick={() => setFilter("tag", "")}
            >
              All
            </Badge>
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={activeTag === tag ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() => setFilter("tag", tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="grid md:grid-cols-2 gap-6">
              {paginatedPosts.map((post) => {
                const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];
                return (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="product-card group block">
                    {post.featured_image && (
                      <div className="aspect-video rounded-lg bg-muted mb-4 overflow-hidden">
                        <img src={post.featured_image} alt={post.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}
                    {post.category && <span className="text-xs font-semibold text-primary uppercase">{post.category}</span>}
                    <h2 className="text-lg font-semibold text-foreground mt-1 mb-2 group-hover:text-primary transition-colors">{post.title}</h2>
                    {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.excerpt}</p>}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                        {tags.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{tags.length - 3}</Badge>}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{post.published_at ? new Date(post.published_at).toLocaleDateString() : t("blog.draft")}</span>
                      {post.reading_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.reading_time} min</span>}
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.view_count}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button variant="outline" size="icon" className="rounded-xl" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  if (totalPages <= 7 || i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) {
                    return (
                      <Button key={i} variant={i === page ? "default" : "outline"} size="icon" className="rounded-xl h-9 w-9 text-sm" onClick={() => setPage(i)}>
                        {i + 1}
                      </Button>
                    );
                  }
                  if (i === 1 && page > 3) return <span key={i} className="text-muted-foreground px-1">…</span>;
                  if (i === totalPages - 2 && page < totalPages - 4) return <span key={i} className="text-muted-foreground px-1">…</span>;
                  return null;
                })}
                <Button variant="outline" size="icon" className="rounded-xl" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!isLoading && (!posts || posts.length === 0) && (
              <div className="text-center py-16 text-muted-foreground">{t("blog.noPosts")}</div>
            )}
            {!isLoading && posts && posts.length > 0 && filteredPosts?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                No posts found for this filter.{" "}
                <button className="text-primary underline" onClick={() => setSearchParams({})}>Show all</button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
            {/* Categories */}
            {allCategories.length > 0 && (
              <div className="glass-card p-5 lg:sticky lg:top-24">
                <h3 className="font-display font-bold text-foreground mb-4 text-sm uppercase tracking-wider">Categories</h3>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setFilter("category", "")}
                    className={cn(
                      "block w-full text-left px-3 py-2.5 text-sm rounded-xl transition-all duration-200 font-medium",
                      !activeCategory ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    All Categories
                  </button>
                  {allCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilter("category", cat)}
                      className={cn(
                        "block w-full text-left px-3 py-2.5 text-sm rounded-xl transition-all duration-200",
                        activeCategory === cat ? "text-primary bg-primary/8 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Posts */}
            {recentPosts.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="font-display font-bold text-foreground mb-4 text-sm uppercase tracking-wider">Recent Posts</h3>
                <div className="space-y-3">
                  {recentPosts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.slug}`}
                      className="group flex gap-3 items-start"
                    >
                      {post.featured_image && (
                        <img
                          src={post.featured_image}
                          alt={post.title}
                          className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {post.title}
                        </p>
                        {post.published_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(post.published_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
