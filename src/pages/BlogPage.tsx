import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Link, useSearchParams } from "react-router-dom";
import { ListFilter, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PaginationControls } from "@/components/PaginationControls";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAbVariant } from "@/hooks/useAbVariant";
import { useDebounce } from "@/hooks/useDebounce";
import { trackEvent } from "@/lib/analytics";

const PAGE_SIZE = 10;
const STALE_5_MIN = 5 * 60 * 1000;

function BlogRowSkeleton() {
  return (
    <div className="flex gap-6 py-8 items-start">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-20 shimmer" />
        <Skeleton className="h-5 w-3/4 shimmer" />
        <Skeleton className="h-4 w-full shimmer" />
        <Skeleton className="h-3 w-32 shimmer" />
      </div>
      <Skeleton className="w-32 h-24 md:w-40 md:h-28 rounded-lg shimmer flex-shrink-0" />
    </div>
  );
}

function BlogHeroSkeleton() {
  return (
    <div className="mb-12">
      <Skeleton className="aspect-[2/1] w-full rounded-xl mb-5 shimmer" />
      <Skeleton className="h-3 w-24 mb-2 shimmer" />
      <Skeleton className="h-8 w-2/3 mb-2 shimmer" />
      <Skeleton className="h-4 w-full max-w-2xl shimmer" />
    </div>
  );
}

export default function BlogPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTag = searchParams.get("tag") || "";
  const urlCategory = searchParams.get("category") || "";
  const isMobile = useIsMobile();

  // Mobile-first filter drawer is the only mobile layout — A/B flag retained
  // for analytics dashboards but always resolves to B on mobile.
  const [filterVariant] = useAbVariant("blog_filter_v1", ["A", "B"]);
  const useNewMobileFilters = isMobile;


  // Local filter state for instant UI feedback; debounce -> URL/derived list
  const [tag, setTag] = useState(urlTag);
  const [category, setCategory] = useState(urlCategory);
  const debouncedTag = useDebounce(tag, 200);
  const debouncedCategory = useDebounce(category, 200);

  // Keep URL in sync with debounced filter values. Push (not replace) so
  // back/forward navigation walks through filter history. The 200ms debounce
  // coalesces rapid taps into a single history entry.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedTag) params.set("tag", debouncedTag); else params.delete("tag");
    if (debouncedCategory) params.set("category", debouncedCategory); else params.delete("category");
    // Only write if the URL would actually change, otherwise we'd push an
    // empty history entry on every mount.
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTag, debouncedCategory]);

  // Sync local state back when the URL changes (browser back/forward).
  useEffect(() => {
    if (urlTag !== tag) setTag(urlTag);
    if (urlCategory !== category) setCategory(urlCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTag, urlCategory]);


  useEffect(() => {
    trackEvent("blog_view", { variant: filterVariant, is_mobile: isMobile });
  }, [filterVariant, isMobile]);

  const { data: posts, isLoading, isFetching } = useQuery({
    queryKey: ["blog-posts"],
    staleTime: STALE_5_MIN,
    placeholderData: (prev) => prev,
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
      tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const allCategories = useMemo(() => {
    if (!posts) return [];
    const catSet = new Set<string>();
    posts.forEach((p) => { if (p.category) catSet.add(p.category); });
    return Array.from(catSet).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (!posts) return posts;
    let result = posts;
    if (debouncedCategory) result = result.filter((p) => p.category === debouncedCategory);
    if (debouncedTag) {
      result = result.filter((p) => {
        const tags = Array.isArray(p.tags) ? (p.tags as string[]) : [];
        return tags.includes(debouncedTag);
      });
    }
    return result;
  }, [posts, debouncedTag, debouncedCategory]);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil((filteredPosts?.length ?? 0) / PAGE_SIZE));
  const paginatedPosts = useMemo(() => {
    if (!filteredPosts) return [];
    return filteredPosts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filteredPosts, page]);

  useEffect(() => { setPage(0); }, [debouncedTag, debouncedCategory]);

  const activeFilterCount = (debouncedTag ? 1 : 0) + (debouncedCategory ? 1 : 0);

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    trackEvent("blog_filter_change", {
      kind: "category", value, variant: filterVariant, is_mobile: isMobile,
    });
  };

  const handleTagChange = (value: string) => {
    setTag(value);
    trackEvent("blog_filter_change", {
      kind: "tag", value, variant: filterVariant, is_mobile: isMobile,
    });
  };

  const clearAll = () => {
    setTag(""); setCategory("");
    trackEvent("blog_filter_change", { kind: "clear", value: "", variant: filterVariant, is_mobile: isMobile });
  };

  const handleFilterDrawerOpen = (kind: "categories" | "tags" | "all") => {
    trackEvent("blog_filter_open", { kind, variant: filterVariant, is_mobile: isMobile });
  };

  const handleCardClick = (post: any, position: number, surface: "hero" | "list") => {
    trackEvent("blog_card_click", {
      slug: post.slug,
      title: post.title,
      surface,
      position,
      variant: filterVariant,
      is_mobile: isMobile,
      category: post.category || "",
    });
  };

  const heroPost = paginatedPosts[0];
  const restPosts = paginatedPosts.slice(1);

  return (
    <>
      <SeoHead
        title={t("blog.title")}
        description={t("blog.subtitle")}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            name: t("blog.title"),
            description: t("blog.subtitle"),
            url: `${typeof window !== "undefined" ? window.location.origin : ""}/blog`,
            blogPost: (posts || []).slice(0, 20).map((p: any) => ({
              "@type": "BlogPosting",
              headline: p.title,
              url: `${typeof window !== "undefined" ? window.location.origin : ""}/blog/${p.slug}`,
              datePublished: p.published_at || p.created_at,
              ...(p.excerpt ? { description: p.excerpt } : {}),
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: t("blog.title"),
            description: t("blog.subtitle"),
            url: `${typeof window !== "undefined" ? window.location.origin : ""}/blog`,
            hasPart: (posts || []).slice(0, 20).map((p: any) => ({
              "@type": "BlogPosting",
              headline: p.title,
              url: `${typeof window !== "undefined" ? window.location.origin : ""}/blog/${p.slug}`,
            })),
          },
        ]}
      />

      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
        {/* Ghost-style header */}
        <header className="text-center mb-8 sm:mb-12">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3"
            style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
          >
            {t("blog.title")}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto">
            {t("blog.subtitle")}
          </p>
        </header>

        {/* Mobile filter bar — Variant B (new drawer UI) */}
        {useNewMobileFilters && (allCategories.length > 0 || allTags.length > 0) && (
          <div
            className="md:hidden sticky top-[56px] z-20 -mx-4 px-4 py-2.5 mb-6 bg-background/85 backdrop-blur-xl border-b border-border"
            data-ab-variant="B"
          >
            <div className="flex items-center gap-2">
              {/* Categories drawer */}
              {allCategories.length > 0 && (
                <Sheet onOpenChange={(o) => o && handleFilterDrawerOpen("categories")}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9 px-3 text-xs font-medium flex-shrink-0">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      {category || "Topics"}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[85%] sm:w-80 p-0">
                    <SheetHeader className="p-4 border-b border-border">
                      <SheetTitle>Topics</SheetTitle>
                    </SheetHeader>
                    <div className="p-3 overflow-y-auto max-h-[calc(100vh-4rem)] space-y-0.5">
                      <button
                        onClick={() => handleCategoryChange("")}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-sm rounded-xl font-medium transition-all",
                          !category ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        )}
                      >
                        All Topics
                      </button>
                      {allCategories.map((c) => (
                        <button
                          key={c}
                          onClick={() => handleCategoryChange(category === c ? "" : c)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 text-sm rounded-xl transition-all",
                            category === c ? "text-primary bg-primary/8 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              )}

              {/* Horizontal tag chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 -mr-4 pr-4">
                <button
                  onClick={() => handleTagChange("")}
                  className={cn(
                    "h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors border",
                    !tag
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  All
                </button>
                {allTags.slice(0, 12).map((tg) => (
                  <button
                    key={tg}
                    onClick={() => handleTagChange(tag === tg ? "" : tg)}
                    className={cn(
                      "h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors border",
                      tag === tg
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {tg}
                  </button>
                ))}
              </div>

              {/* All filters bottom-sheet */}
              <Sheet onOpenChange={(o) => o && handleFilterDrawerOpen("all")}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl h-9 w-9 p-0 flex-shrink-0 relative">
                    <ListFilter className="h-4 w-4" />
                    {activeFilterCount > 0 && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filter posts</SheetTitle>
                  </SheetHeader>
                  <div className="py-4 space-y-5">
                    {allCategories.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topic</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => handleCategoryChange("")}
                            className={cn(
                              "px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                              !category ? "bg-primary/10 text-primary" : "bg-muted/50 text-foreground hover:bg-muted"
                            )}
                          >
                            All
                          </button>
                          {allCategories.map((c) => (
                            <button
                              key={c}
                              onClick={() => handleCategoryChange(category === c ? "" : c)}
                              className={cn(
                                "px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                                category === c ? "bg-primary/10 text-primary" : "bg-muted/50 text-foreground hover:bg-muted"
                              )}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {allTags.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tag</p>
                        <div className="flex flex-wrap gap-1.5">
                          {allTags.map((tg) => (
                            <button
                              key={tg}
                              onClick={() => handleTagChange(tag === tg ? "" : tg)}
                              className={cn(
                                "px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                                tag === tg ? "bg-primary/10 text-primary" : "bg-muted/50 text-foreground hover:bg-muted"
                              )}
                            >
                              {tg}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {activeFilterCount > 0 && (
                      <Button variant="outline" className="w-full rounded-xl" onClick={clearAll}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        )}

        {/* Desktop chip nav (mobile uses the drawer above). */}
        {!isMobile && (allTags.length > 0 || allCategories.length > 0) && (

          <nav
            className="flex items-center justify-center gap-2 flex-wrap mb-10 sm:mb-12 pb-6 sm:pb-8 border-b border-border"
            data-ab-variant={isMobile ? "A" : "desktop"}
          >
            <button
              onClick={clearAll}
              className={cn(
                "px-3 py-1 text-sm rounded-full transition-colors",
                !tag && !category
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => handleCategoryChange(category === c ? "" : c)}
                className={cn(
                  "px-3 py-1 text-sm rounded-full transition-colors",
                  category === c
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
            {allTags.slice(0, 8).map((tg) => (
              <button
                key={tg}
                onClick={() => handleTagChange(tag === tg ? "" : tg)}
                className={cn(
                  "px-3 py-1 text-sm rounded-full transition-colors",
                  tag === tg
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tg}
              </button>
            ))}
          </nav>
        )}

        {/* Skeleton loading state */}
        {isLoading && (
          <div className={cn("transition-opacity", isFetching && "opacity-90")}>
            <BlogHeroSkeleton />
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => <BlogRowSkeleton key={i} />)}
            </div>
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <div className={cn("transition-opacity", isFetching && "opacity-70")}>
            {heroPost && (
              <Link
                to={`/blog/${heroPost.slug}`}
                className="group block mb-10 sm:mb-12"
                onClick={() => handleCardClick(heroPost, 0, "hero")}
              >
                {heroPost.featured_image && (
                  <div className="aspect-[2/1] rounded-xl overflow-hidden mb-5 bg-muted">
                    <img decoding="async"
                      src={heroPost.featured_image}
                      alt={heroPost.title}
                      loading="lazy"
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

            {restPosts.length > 0 && (
              <div className="divide-y divide-border">
                {restPosts.map((post, i) => (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug}`}
                    className="group flex gap-4 sm:gap-6 py-6 sm:py-8 items-start active:scale-[0.995] transition-transform"
                    onClick={() => handleCardClick(post, i + 1, "list")}
                  >
                    <div className="flex-1 min-w-0">
                      {post.category && (
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">{post.category}</span>
                      )}
                      <h3
                        className="text-lg sm:text-xl font-bold text-foreground mt-1 mb-1.5 group-hover:text-primary transition-colors line-clamp-2"
                        style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
                      >
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-2 hidden sm:block">
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
                      <div className="w-24 h-20 sm:w-32 sm:h-24 md:w-40 md:h-28 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        <img decoding="async"
                          src={post.featured_image}
                          alt={post.title}
                          loading="lazy"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}

            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} className="mt-10 sm:mt-12" />

            {(!posts || posts.length === 0) && (
              <div className="text-center py-20 text-muted-foreground">{t("blog.noPosts")}</div>
            )}
            {posts && posts.length > 0 && filteredPosts?.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                No posts found.{" "}
                <button className="text-primary underline" onClick={clearAll}>Show all</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
