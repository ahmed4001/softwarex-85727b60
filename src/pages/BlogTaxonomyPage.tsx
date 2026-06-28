import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";

interface Props {
  mode: "tag" | "category";
}

export default function BlogTaxonomyPage({ mode }: Props) {
  const params = useParams();
  const value = decodeURIComponent(params.tag || params.category || "");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-taxonomy", mode, value],
    queryFn: async () => {
      let q = supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, featured_image, published_at, reading_time, category, tags")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (mode === "category") q = q.eq("category", value);
      else q = q.contains("tags", JSON.stringify([value]) as any);
      const { data } = await q;
      return data || [];
    },
  });

  const heading = mode === "category" ? `Category: ${value}` : `#${value}`;
  const description = `Articles ${mode === "category" ? "in the " + value + " category" : "tagged with " + value}.`;

  return (
    <>
      <SeoHead title={heading} description={description} />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <Breadcrumbs items={[{ label: "Blog", to: "/blog" }, { label: heading }]} />

        <header className="text-center mt-10 mb-12">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">{mode}</p>
          <h1
            className="text-4xl md:text-5xl font-bold text-foreground mb-3"
            style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
          >
            {value}
          </h1>
          <p className="text-muted-foreground">{posts.length} {posts.length === 1 ? "article" : "articles"}</p>
        </header>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No articles yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="group flex gap-6 py-8 items-start">
                <div className="flex-1 min-w-0">
                  {post.category && (
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">{post.category}</span>
                  )}
                  <h3
                    className="text-xl font-bold mt-1 mb-1.5 group-hover:text-primary transition-colors"
                    style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
                  >
                    {post.title}
                  </h3>
                  {post.excerpt && <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-2">{post.excerpt}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {post.published_at && <time>{new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>}
                    {post.reading_time ? (<><span className="text-border">·</span><span>{post.reading_time} min read</span></>) : null}
                  </div>
                </div>
                {post.featured_image && (
                  <div className="w-32 h-24 md:w-40 md:h-28 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    <img decoding="async" loading="lazy" src={post.featured_image} alt={post.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
