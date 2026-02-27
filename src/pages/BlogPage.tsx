import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PaginationControls } from "@/components/PaginationControls";
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

  useEffect(() => { setPage(0); }, [activeTag, activeCategory]);

  const setFilter = (key: "tag" | "category", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value); else params.delete(key);
    setSearchParams(params);
  };

  // Featured / hero post (first one)
  const heroPost = paginatedPosts[0];
  const restPosts = paginatedPosts.slice(1);

  return (
    <>
      <SeoHead title={t("blog.title")} description={t("blog.subtitle")} />

      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Ghost-style header — centered, serif */}
        <header className="text-center mb-12">
          <h1
            className="text-4xl md:text-5xl font-bold text-foreground mb-3"
            style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
          >
            {t("blog.title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            {t("blog.subtitle")}
          </p>
        </header>

        {/* Tag/category filter — Ghost-style minimal pills */}
        {(allTags.length > 0 || allCategories.length > 0) && (
          <nav className="flex items-center justify-center gap-2 flex-wrap mb-12 pb-8 border-b border-border">
            <button
              onClick={() => { setFilter("tag", ""); setFilter("category", ""); }}
              className={cn(
                "px-3 py-1 text-sm rounded-full transition-colors",
                !activeTag && !activeCategory
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter("category", activeCategory === cat ? "" : cat)}
                className={cn(
                  "px-3 py-1 text-sm rounded-full transition-colors",
                  activeCategory === cat
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
            {allTags.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => setFilter("tag", activeTag === tag ? "" : tag)}
                className={cn(
                  "px-3 py-1 text-sm rounded-full transition-colors",
                  activeTag === tag
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tag}
              </button>
            ))}
          </nav>
        )}

        {/* Hero post — Ghost-style large feature */}
        {heroPost && (
          <Link to={`/blog/${heroPost.slug}`} className="group block mb-12">
            {heroPost.featured_image && (
              <div className="aspect-[2/1] rounded-xl overflow-hidden mb-5 bg-muted">
                <img
                  src={heroPost.featured_image}
                  alt={heroPost.title}
                  className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
              </div>
            )}
            {heroPost.category && (
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">{heroPost.category}</span>
            )}
            <h2
              className="text-2xl md:text-3xl font-bold text-foreground mt-2 mb-2 group-hover:text-primary transition-colors"
              style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
            >
              {heroPost.title}
            </h2>
            {heroPost.excerpt && (
              <p className="text-muted-foreground text-base leading-relaxed line-clamp-2 mb-3 max-w-2xl">
                {heroPost.excerpt}
              </p>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {heroPost.published_at && (
                <time>{new Date(heroPost.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>
              )}
              {heroPost.reading_time && (
                <>
                  <span className="text-border">·</span>
                  <span>{heroPost.reading_time} min read</span>
                </>
              )}
            </div>
          </Link>
        )}

        {/* Rest of posts — Ghost-style clean list */}
        {restPosts.length > 0 && (
          <div className="divide-y divide-border">
            {restPosts.map((post) => {
              const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];
              return (
                <Link key={post.id} to={`/blog/${post.slug}`} className="group flex gap-6 py-8 items-start">
                  <div className="flex-1 min-w-0">
                    {post.category && (
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">{post.category}</span>
                    )}
                    <h3
                      className="text-xl font-bold text-foreground mt-1 mb-1.5 group-hover:text-primary transition-colors"
                      style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
                    >
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-2">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {post.published_at && (
                        <time>{new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time>
                      )}
                      {post.reading_time && (
                        <>
                          <span className="text-border">·</span>
                          <span>{post.reading_time} min read</span>
                        </>
                      )}
                    </div>
                  </div>
                  {post.featured_image && (
                    <div className="w-32 h-24 md:w-40 md:h-28 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                      <img
                        src={post.featured_image}
                        alt={post.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} className="mt-12" />

        {!isLoading && (!posts || posts.length === 0) && (
          <div className="text-center py-20 text-muted-foreground">{t("blog.noPosts")}</div>
        )}
        {!isLoading && posts && posts.length > 0 && filteredPosts?.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            No posts found.{" "}
            <button className="text-primary underline" onClick={() => setSearchParams({})}>Show all</button>
          </div>
        )}
      </div>
    </>
  );
}
