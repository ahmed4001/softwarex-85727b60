import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Props {
  currentId: string;
  category?: string | null;
  tags?: string[];
}

export function RelatedPosts({ currentId, category, tags }: Props) {
  const { data } = useQuery({
    queryKey: ["related-posts", currentId, category, tags],
    queryFn: async () => {
      let query = supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, featured_image, published_at, reading_time, category")
        .eq("status", "published")
        .neq("id", currentId)
        .limit(3);
      if (category) query = query.eq("category", category);
      const { data } = await query.order("view_count", { ascending: false });
      if (data && data.length >= 3) return data;
      // Fallback: latest
      const { data: latest } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, featured_image, published_at, reading_time, category")
        .eq("status", "published")
        .neq("id", currentId)
        .order("published_at", { ascending: false })
        .limit(3);
      return latest || [];
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-16 pt-12 border-t border-border">
      <h2
        className="text-2xl font-bold mb-8"
        style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
      >
        Keep reading
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {data.map((p) => (
          <Link key={p.id} to={`/blog/${p.slug}`} className="group block">
            {p.featured_image && (
              <div className="aspect-[16/10] rounded-lg overflow-hidden mb-3 bg-muted">
                <img decoding="async" loading="lazy" src={p.featured_image} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
            )}
            {p.category && (
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">{p.category}</span>
            )}
            <h3
              className="text-lg font-bold mt-1 mb-1.5 group-hover:text-primary transition-colors line-clamp-2"
              style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
            >
              {p.title}
            </h3>
            {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}
