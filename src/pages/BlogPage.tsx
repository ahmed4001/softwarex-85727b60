import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Eye, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function BlogPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get("tag") || "";

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

  const filteredPosts = useMemo(() => {
    if (!posts || !activeTag) return posts;
    return posts.filter((p) => {
      const tags = Array.isArray(p.tags) ? (p.tags as string[]) : [];
      return tags.includes(activeTag);
    });
  }, [posts, activeTag]);

  const setTag = (tag: string) => {
    if (tag) {
      setSearchParams({ tag });
    } else {
      setSearchParams({});
    }
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
              onClick={() => setTag("")}
            >
              All
            </Badge>
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={activeTag === tag ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() => setTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts?.map((post) => {
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

        {!isLoading && (!posts || posts.length === 0) && (
          <div className="text-center py-16 text-muted-foreground">{t("blog.noPosts")}</div>
        )}
        {!isLoading && posts && posts.length > 0 && filteredPosts?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            No posts found for tag "{activeTag}".{" "}
            <button className="text-primary underline" onClick={() => setTag("")}>Show all</button>
          </div>
        )}
      </div>
    </>
  );
}
