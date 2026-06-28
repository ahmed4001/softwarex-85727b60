import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { Twitter, Linkedin, Globe } from "lucide-react";
import { isUuid } from "@/lib/identifier";

export default function AuthorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["author-profile", id],
    queryFn: async () => {
      // Slug-first lookup, UUID fallback for legacy links.
      const column = isUuid(id) ? "user_id" : "username";
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, username, name, avatar_url, bio, job_title, company, industry, is_verified_reviewer, review_count, helpful_votes_received, created_at, total_points, display_title, verification_type, verified_domain, verified_at, linkedin_verified")
        .eq(column, id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Redirect UUID URL to canonical /author/{username} for SEO.
  useEffect(() => {
    if (profile && isUuid(id) && (profile as any).username) {
      navigate(`/author/${(profile as any).username}`, { replace: true });
    }
  }, [profile, id, navigate]);

  const resolvedUserId = (profile as any)?.user_id as string | undefined;

  const { data: posts = [] } = useQuery({
    queryKey: ["author-posts", resolvedUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, featured_image, published_at, reading_time, category")
        .eq("author_id", resolvedUserId!)
        .eq("status", "published")
        .order("published_at", { ascending: false });
      return data || [];
    },
    enabled: !!resolvedUserId,
  });


  if (isLoading) return <div className="max-w-4xl mx-auto py-32 text-center text-muted-foreground">Loading…</div>;
  if (!profile) return <div className="max-w-4xl mx-auto py-32 text-center text-muted-foreground">Author not found.</div>;

  const name = (profile as any).name || "Author";
  const bio = (profile as any).bio || "";
  const avatar = (profile as any).avatar_url;
  const twitter = (profile as any).twitter_url || (profile as any).twitter_handle;
  const linkedin = (profile as any).linkedin_url;
  const website = (profile as any).website_url || (profile as any).website;

  return (
    <>
      <SeoHead
        title={`${name} — Author`}
        description={bio || `Articles by ${name}`}
        type="profile"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Person",
          name,
          ...(bio && { description: bio }),
          ...(avatar && { image: avatar }),
        }}
      />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <Breadcrumbs items={[{ label: "Blog", to: "/blog" }, { label: name }]} />

        <header className="text-center mt-10 mb-14">
          {avatar ? (
            <img decoding="async" loading="lazy" src={avatar} alt={name} className="h-24 w-24 rounded-full object-cover mx-auto mb-5" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/10 text-primary text-3xl font-semibold flex items-center justify-center mx-auto mb-5">
              {name[0]?.toUpperCase()}
            </div>
          )}
          <h1
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
          >
            {name}
          </h1>
          {bio && <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">{bio}</p>}

          {(twitter || linkedin || website) && (
            <div className="flex items-center justify-center gap-3 mt-5 text-muted-foreground">
              {twitter && (
                <a href={twitter.startsWith("http") ? twitter : `https://twitter.com/${twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {linkedin && (
                <a href={linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  <Globe className="h-4 w-4" />
                </a>
              )}
            </div>
          )}

          <div className="mt-6 text-sm text-muted-foreground">
            {posts.length} {posts.length === 1 ? "article" : "articles"}
          </div>
        </header>

        {posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No published articles yet.</div>
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
