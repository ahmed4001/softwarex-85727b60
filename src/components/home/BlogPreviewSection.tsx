import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ResponsiveImage } from "@/components/ResponsiveImage";

export function BlogPreviewSection() {
  const { data: posts } = useQuery({
    queryKey: ["blog-preview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, featured_image, published_at, reading_time, category")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3);
      return data || [];
    },
  });

  if (!posts || posts.length === 0) return null;

  return (
    <section className="py-16 md:py-20">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-3"
        >
          <div>
            <p className="t-eyebrow mb-1">From the blog</p>
            <h2 className="t-h2">Latest articles</h2>
            <p className="text-muted-foreground mt-1">Guides, comparisons, and industry insights</p>
          </div>
          <Link to="/blog">
            <Button variant="ghost" className="gap-1.5 font-semibold group text-sm">
              Read Blog <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {posts.map((post: any, i: number) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link to={`/blog/${post.slug}`} className="glass-card group block overflow-hidden">
                {post.featured_image && (
                  <div className="aspect-[16/9] overflow-hidden">
                    <ResponsiveImage
                      src={post.featured_image}
                      alt={post.title}
                      width={800}
                      height={450}
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  {post.category && (
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                      {post.category}
                    </span>
                  )}
                  <h3 className="font-bold text-foreground mt-1 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.excerpt}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {post.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(post.published_at), "MMM d, yyyy")}
                      </span>
                    )}
                    {post.reading_time && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {post.reading_time} min read
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
