import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock } from "lucide-react";
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

  useEffect(() => {
    if (slug && post && !viewCounted.current) {
      viewCounted.current = true;
      supabase.rpc("increment_blog_view", { post_slug: slug } as never).then(() => {});
    }
  }, [slug, post]);

  if (isLoading) return <div className="max-w-3xl mx-auto py-32 text-center text-muted-foreground">{t("common.loading")}</div>;
  if (!post) return <div className="max-w-3xl mx-auto py-32 text-center text-muted-foreground">{t("blog.postNotFound")}</div>;

  const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];

  return (
    <>
      <SeoHead title={post.seo_title || post.title} description={post.seo_description || post.excerpt || ""} />

      <article className="max-w-3xl mx-auto px-4 py-16">
        {/* Back link */}
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-10 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("blog.backToBlog")}
        </Link>

        {/* Ghost-style header — centered, serif */}
        <header className="text-center mb-10">
          {post.category && (
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">{post.category}</span>
          )}
          <h1
            className="text-3xl md:text-[2.75rem] leading-tight font-bold text-foreground mt-3 mb-5"
            style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
          >
            {post.title}
          </h1>

          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            {post.published_at && (
              <time>{new Date(post.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>
            )}
            {post.reading_time && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t("blog.minRead", { count: post.reading_time })}</span>
              </>
            )}
          </div>
        </header>

        {/* Featured image — Ghost-style full-width */}
        {post.featured_image && (
          <figure className="mb-10 -mx-4 md:mx-0">
            <img
              src={post.featured_image}
              alt={post.title}
              className="w-full rounded-xl"
            />
          </figure>
        )}

        {/* Post body — clean, readable typography */}
        <div
          className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground/85 prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground"
          style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
          dangerouslySetInnerHTML={{ __html: post.body || "" }}
        />

        {/* Tags — bottom */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-border">
            {tags.map((tag) => (
              <Link key={tag} to={`/blog?tag=${tag}`}>
                <Badge variant="secondary" className="text-xs rounded-full px-3 py-1 hover:bg-primary/10 transition-colors">
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
