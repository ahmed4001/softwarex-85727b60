import { enhanceHtmlImages } from "@/lib/html-enhance";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { PostComments } from "@/components/blog/PostComments";
import { RelatedInternalLinks } from "@/components/RelatedInternalLinks";
import { FreshnessBadge } from "@/components/seo/FreshnessBadge";
import { HelpfulVote } from "@/components/seo/HelpfulVote";
import { AIFaqBlock } from "@/components/seo/AIFaqBlock";
import { ResponsiveImage } from "@/components/ResponsiveImage";


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

  const { data: author } = useQuery({
    queryKey: ["blog-post-author", post?.author_id],
    enabled: !!post?.author_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, name, avatar_url, bio")
        .eq("user_id", post!.author_id!)

        .maybeSingle();
      return data;
    },
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
  const url = `https://reviewhunts.com/blog/${slug}`;
  const plainText = String((post as any).content || post.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plainText ? plainText.split(" ").filter(Boolean).length : undefined;
  const aboutEntities = [
    ...(post.category ? [{ "@type": "Thing", name: post.category }] : []),
    ...tags.map((t) => ({ "@type": "Thing", name: t })),
  ];

  return (
    <>
      <ReadingProgress />
      <SeoHead
        title={post.seo_title || post.title}
        description={post.seo_description || post.excerpt || ""}
        keywords={post.seo_keywords || tags.join(", ") || undefined}
        canonicalUrl={post.canonical_url || url}
        ogImage={post.og_image || post.featured_image || undefined}
        type="article"
        markdownUrl={`/blog/${slug}.md`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.seo_description || post.excerpt,
            image: post.featured_image || "https://reviewhunts.com/og-image.png",
            url,
            datePublished: post.published_at,
            dateModified: post.updated_at || post.published_at,
            ...(post.reading_time && { timeRequired: `PT${post.reading_time}M` }),
            ...(wordCount && { wordCount }),
            ...(tags.length > 0 && { keywords: tags }),
            articleSection: post.category || undefined,
            inLanguage: "en",
            ...(aboutEntities.length > 0 && { about: aboutEntities }),
            speakable: {
              "@type": "SpeakableSpecification",
              cssSelector: ["#article-headline", "#article-excerpt", "article p:first-of-type"],
              xpath: ["/html/head/title", "/html/head/meta[@name='description']/@content"],
            },
            ...(author && {
              author: { "@type": "Person", name: (author as any).name || "Author" },
            }),
            publisher: { "@type": "Organization", name: "ReviewHunts", url: "https://reviewhunts.com", logo: { "@type": "ImageObject", url: "https://reviewhunts.com/reviewhunts-logo.png" } },
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://reviewhunts.com" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://reviewhunts.com/blog" },
              { "@type": "ListItem", position: 3, name: post.title, item: url },
            ],
          },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 py-10">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("blog.backToBlog")}
        </Link>

        <Breadcrumbs
          items={[
            { label: "Blog", to: "/blog" },
            ...(post.category ? [{ label: post.category, to: `/blog/category/${encodeURIComponent(post.category)}` }] : []),
            { label: post.title },
          ]}
        />

        <div className="grid lg:grid-cols-[1fr_minmax(0,720px)_240px] gap-10 mt-8">
          {/* Left gutter (spacer on desktop) */}
          <aside className="hidden lg:block" />

          {/* Main article */}
          <article className="min-w-0">
            <header className="text-center mb-10">
              {post.category && (
                <Link
                  to={`/blog/category/${encodeURIComponent(post.category)}`}
                  className="text-xs font-semibold text-primary uppercase tracking-wider hover:underline"
                >
                  {post.category}
                </Link>
              )}
              <h1
                id="article-headline"
                className="text-3xl md:text-[2.75rem] leading-tight font-bold text-foreground mt-3 mb-6"
                style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
              >
                {post.title}
              </h1>
              {post.excerpt && (
                <p id="article-excerpt" className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
                  {post.excerpt}
                </p>
              )}

              {/* Author + meta */}
              <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                {author && (
                  <Link to={`/author/${(author as any).username || (author as any).user_id}`} className="flex items-center gap-2 hover:text-foreground">
                    {(author as any).avatar_url ? (
                      <img decoding="async" loading="lazy" src={(author as any).avatar_url} alt={(author as any).name || ""} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                        {((author as any).name || "A")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-foreground">{(author as any).name || "Author"}</span>
                  </Link>
                )}
                {author && <span className="text-border">·</span>}
                {post.published_at && (
                  <time>{new Date(post.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>
                )}
                {post.reading_time ? (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {t("blog.minRead", { count: post.reading_time })}
                    </span>
                  </>
                ) : null}
              </div>
            </header>

            {post.featured_image && (
              <figure className="mb-10 -mx-4 md:mx-0">
                <ResponsiveImage src={post.featured_image} alt={post.title} width={1600} height={900} sizes="(max-width: 1024px) 100vw, 800px" loading="eager" fetchPriority="high" className="w-full rounded-xl h-auto" />
              </figure>
            )}

            <div
              data-post-body
              className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-foreground prose-headings:scroll-mt-24 prose-p:text-foreground/85 prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground"
              style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
              dangerouslySetInnerHTML={{ __html: enhanceHtmlImages(post.body || "", post.title) }}
            />

            {/* Share */}
            <div className="flex items-center justify-between flex-wrap gap-4 mt-12 pt-8 border-t border-border">
              <ShareButtons url={url} title={post.title} />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-end">
                  {tags.map((tag) => (
                    <Link key={tag} to={`/blog/tag/${encodeURIComponent(tag)}`}>
                      <Badge variant="secondary" className="text-xs rounded-full px-3 py-1 hover:bg-primary/10 transition-colors">
                        {tag}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Author bio card */}
            {author && (author as any).bio && (
              <div className="mt-10 p-6 rounded-xl border border-border bg-muted/30 flex gap-4 items-start">
                {(author as any).avatar_url ? (
                  <img decoding="async" loading="lazy" src={(author as any).avatar_url} alt={(author as any).name || ""} className="h-14 w-14 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-primary/10 text-primary text-lg font-semibold flex items-center justify-center flex-shrink-0">
                    {((author as any).name || "A")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Written by</p>
                  <Link to={`/author/${(author as any).username || (author as any).user_id}`} className="text-lg font-bold text-foreground hover:text-primary">
                    {(author as any).name || "Author"}
                  </Link>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{(author as any).bio}</p>
                </div>
              </div>
            )}

            <RelatedPosts currentId={post.id} category={post.category} tags={tags} />
            <RelatedInternalLinks
              categoryName={post.category}
              excludeBlogId={post.id}
              title="Related products & resources"
            />

            <AIFaqBlock
              entityType="blog"
              entitySlug={slug}
              context={{
                name: post.title,
                description: post.excerpt || post.seo_description || undefined,
                category: post.category || undefined,
              }}
              title="Frequently asked questions"
              pageUrl={`https://reviewhunts.com/blog/${slug}`}
            />
            <HelpfulVote pagePath={`/blog/${slug}`} />
            <PostComments postId={post.id} />



          </article>

          {/* Sticky TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TableOfContents html={post.body || ""} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
