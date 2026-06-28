import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Clock } from "lucide-react";

interface Props {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  featured_image: string;
  tags: string[];
  slug: string;
  readingTime: number;
}

export function BlogPostPreview({
  title, excerpt, body, category, featured_image, tags, slug, readingTime,
}: Props) {
  const path = `/blog/${slug || "your-slug"}`;

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      {/* Fake browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 text-center text-xs text-muted-foreground font-mono truncate">
          yourdomain.com{path}
        </div>
      </div>

      <div className="max-h-[75vh] overflow-y-auto">
        <div className="max-w-3xl mx-auto py-10 px-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-6">
            <span>Home</span>
            <ChevronRight className="h-3 w-3" />
            <span>Blog</span>
            {category && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>{category}</span>
              </>
            )}
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground truncate max-w-[200px]">{title || "Untitled"}</span>
          </nav>

          <header className="text-center mb-10">
            {category && (
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                {category}
              </span>
            )}
            <h1
              className="text-3xl md:text-[2.5rem] leading-tight font-bold text-foreground mt-3 mb-4"
              style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
            >
              {title || "Your post title appears here"}
            </h1>
            {excerpt && (
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{excerpt}</p>
            )}
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mt-5">
              <time>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>
              {readingTime > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {readingTime} min read
                  </span>
                </>
              )}
            </div>
          </header>

          {featured_image && (
            <figure className="mb-10 rounded-xl overflow-hidden">
              <img decoding="async" loading="lazy" src={featured_image} alt={title} className="w-full h-auto" />
            </figure>
          )}

          {body ? (
            <div
              className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground/85 prose-p:leading-relaxed prose-a:text-primary prose-img:rounded-xl prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground dark:prose-invert"
              style={{ fontFamily: "'Lora', 'EB Garamond', Georgia, serif" }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p className="text-muted-foreground italic text-center py-12">Start writing to see your post preview…</p>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-border">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs rounded-full px-3 py-1">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
