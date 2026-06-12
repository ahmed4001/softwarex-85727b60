import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  GitCompare,
  LayoutGrid,
  Package,
  Newspaper,
  Sparkles,
} from "lucide-react";

/**
 * Universal cross-content internal-link block.
 *
 * Eliminates orphan pages and tightens crawl paths by linking every
 * product / category / guide / blog page to the other content types
 * that share its category context. Each cluster renders only when it
 * has results, so the block stays compact on sparse categories.
 *
 * Props are intentionally loose — pass whatever context the host page
 * already knows (categoryId, categorySlug, excludeProductId, etc.).
 */
interface RelatedInternalLinksProps {
  categoryId?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  excludeProductId?: string | null;
  excludeGuideSlug?: string | null;
  excludeBlogId?: string | null;
  excludeComparisonSlug?: string | null;
  /** Heading text override. */
  title?: string;
  className?: string;
}

const CARD =
  "group flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm text-foreground hover:border-primary/40 hover:bg-card transition-colors";

export function RelatedInternalLinks({
  categoryId,
  categorySlug,
  categoryName,
  excludeProductId,
  excludeGuideSlug,
  excludeBlogId,
  excludeComparisonSlug,
  title = "Continue exploring",
  className = "",
}: RelatedInternalLinksProps) {
  const { data } = useQuery({
    queryKey: [
      "internal-links",
      categoryId,
      categorySlug,
      excludeProductId,
      excludeGuideSlug,
      excludeBlogId,
      excludeComparisonSlug,
    ],
    queryFn: async () => {
      // Run every lookup in parallel; each independently guards against missing
      // context so we never block on absent category data.
      const [products, guides, comparisons, posts, siblings, glossary] =
        await Promise.all([
          categoryId
            ? supabase
                .from("products")
                .select("name,slug")
                .eq("is_active", true)
                .eq("category_id", categoryId)
                .neq("id", excludeProductId ?? "00000000-0000-0000-0000-000000000000")
                .order("info_score", { ascending: false })
                .order("avg_rating", { ascending: false })
                .limit(6)
            : Promise.resolve({ data: [] as any[] }),
          categoryId
            ? (supabase as any)
                .from("buyer_guides")
                .select("title,slug")
                .eq("is_published", true)
                .eq("category_id", categoryId)
                .neq("slug", excludeGuideSlug ?? "__none__")
                .limit(4)
            : Promise.resolve({ data: [] as any[] }),
          categoryId
            ? (supabase as any)
                .from("comparisons")
                .select("title,slug")
                .eq("is_published", true)
                .eq("category_id", categoryId)
                .neq("slug", excludeComparisonSlug ?? "__none__")
                .order("view_count", { ascending: false })
                .limit(4)
            : Promise.resolve({ data: [] as any[] }),
          categoryName
            ? (supabase as any)
                .from("blog_posts")
                .select("title,slug,id")
                .eq("status", "published")
                .ilike("category", categoryName)
                .neq("id", excludeBlogId ?? "00000000-0000-0000-0000-000000000000")
                .order("published_at", { ascending: false })
                .limit(4)
            : Promise.resolve({ data: [] as any[] }),
          (supabase as any)
            .from("categories")
            .select("name,slug")
            .eq("is_active", true)
            .neq("slug", categorySlug ?? "__none__")
            .order("product_count", { ascending: false })
            .limit(6),
          categoryName
            ? (supabase as any)
                .from("glossary_terms")
                .select("term,slug")
                .ilike("term", `%${categoryName.split(" ")[0]}%`)
                .limit(4)
            : Promise.resolve({ data: [] as any[] }),
        ]);
      return {
        products: products.data ?? [],
        guides: guides.data ?? [],
        comparisons: comparisons.data ?? [],
        posts: posts.data ?? [],
        siblings: siblings.data ?? [],
        glossary: glossary.data ?? [],
      };
    },
  });

  if (!data) return null;
  const total =
    data.products.length +
    data.guides.length +
    data.comparisons.length +
    data.posts.length +
    data.siblings.length +
    data.glossary.length;
  if (total === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`mt-12 rounded-2xl border border-border/60 bg-muted/20 p-5 sm:p-7 ${className}`}
      aria-label="Related internal links"
    >
      <header className="mb-5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <LinkCluster
          icon={<Package className="h-3.5 w-3.5" />}
          label="Top products"
          items={data.products.map((p: any) => ({ to: `/product/${p.slug}`, label: p.name }))}
          seeAll={categorySlug ? { to: `/category/${categorySlug}`, label: "All in category" } : undefined}
        />
        <LinkCluster
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Buyer guides"
          items={data.guides.map((g: any) => ({ to: `/guides/${g.slug}`, label: g.title }))}
          seeAll={{ to: "/guides", label: "All guides" }}
        />
        <LinkCluster
          icon={<GitCompare className="h-3.5 w-3.5" />}
          label="Comparisons"
          items={data.comparisons.map((c: any) => ({ to: `/compare/${c.slug}`, label: c.title }))}
          seeAll={{ to: "/compare", label: "Compare tools" }}
        />
        <LinkCluster
          icon={<Newspaper className="h-3.5 w-3.5" />}
          label="From the blog"
          items={data.posts.map((p: any) => ({ to: `/blog/${p.slug}`, label: p.title }))}
          seeAll={{ to: "/blog", label: "All articles" }}
        />
        <LinkCluster
          icon={<LayoutGrid className="h-3.5 w-3.5" />}
          label="Related categories"
          items={data.siblings.map((c: any) => ({ to: `/category/${c.slug}`, label: c.name }))}
          seeAll={{ to: "/categories", label: "Browse categories" }}
        />
        <LinkCluster
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Glossary"
          items={data.glossary.map((g: any) => ({ to: `/glossary/${g.slug}`, label: g.term }))}
          seeAll={{ to: "/glossary", label: "Open glossary" }}
        />
      </div>
    </motion.section>
  );
}

function LinkCluster({
  icon,
  label,
  items,
  seeAll,
}: {
  icon: React.ReactNode;
  label: string;
  items: { to: string; label: string }[];
  seeAll?: { to: string; label: string };
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <ul className="grid gap-1.5">
        {items.map((it) => (
          <li key={it.to}>
            <Link to={it.to} className={CARD}>
              <span className="truncate flex-1">{it.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </Link>
          </li>
        ))}
      </ul>
      {seeAll && (
        <Link
          to={seeAll.to}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {seeAll.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
