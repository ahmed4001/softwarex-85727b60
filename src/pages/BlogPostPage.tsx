import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ArrowLeft, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";

export default function BlogPostPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const viewCounted = useRef(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data } = await supabase.from("blog_posts").select("*").eq("slug", slug!).eq("status", "published").single();
      return data;
    },
    enabled: !!slug,
  });

  // Increment view count once per page load
  useEffect(() => {
    if (slug && post && !viewCounted.current) {
      viewCounted.current = true;
      supabase.rpc("increment_blog_view", { post_slug: slug } as never).then(() => {});
    }
  }, [slug, post]);

  if (isLoading) return <div className="container py-16 text-center text-muted-foreground">{t("common.loading")}</div>;
  if (!post) return <div className="container py-16 text-center text-muted-foreground">{t("blog.postNotFound")}</div>;

  const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];

  return (
    <>
      <SeoHead title={post.seo_title || post.title} description={post.seo_description || post.excerpt || ""} />
      <article className="container py-12 max-w-3xl">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> {t("blog.backToBlog")}
        </Link>

        {post.category && <span className="text-xs font-semibold text-primary uppercase">{post.category}</span>}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-2 mb-4">{post.title}</h1>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}</span>
          {post.reading_time && (
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{t("blog.minRead", { count: post.reading_time })}</span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8 pb-8 border-b border-border">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {!tags.length && <div className="mb-8 pb-8 border-b border-border" />}

        {post.featured_image && (
          <img src={post.featured_image} alt={post.title} className="w-full rounded-xl mb-8" />
        )}

        <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: post.body || "" }} />
      </article>
    </>
  );
}
