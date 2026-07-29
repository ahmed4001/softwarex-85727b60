import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BookOpen,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  LayoutDashboard,
  Package,
  Search,
  Star,
  Tag,
  TrendingUp,
} from "lucide-react";

type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  avg_rating: number | null;
  total_reviews: number | null;
  view_count: number | null;
};

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  product_count: number | null;
};

type PublicPost = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  published_at: string | null;
};

type PublicDeal = {
  id: string;
  product_name: string;
  slug: string;
  discount_amount: string | null;
  discount_type: string | null;
  is_featured: boolean | null;
  end_date: string | null;
};

const countFrom = async (table: string, filters?: (query: any) => any) => {
  let query = (supabase as any).from(table).select("id", { count: "exact", head: true });
  if (filters) query = filters(query);
  const { count } = await query;
  return count ?? 0;
};

const formatNumber = (value: number | null | undefined) => (value ?? 0).toLocaleString();

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
};

const dealLabel = (deal: PublicDeal) => {
  if (!deal.discount_amount) return deal.is_featured ? "Featured" : "Active";
  const prefix = deal.discount_type === "amount" ? "$" : "";
  const suffix = deal.discount_type === "percent" ? "% off" : deal.discount_type === "amount" ? " off" : "";
  return `${prefix}${deal.discount_amount}${suffix}`;
};

export default function PublicAdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-admin-dashboard"],
    queryFn: async () => {
      const [
        products,
        reviews,
        categories,
        comparisons,
        blogPosts,
        guides,
        glossary,
        deals,
        topProductsRes,
        categoriesRes,
        postsRes,
        dealsRes,
      ] = await Promise.all([
        countFrom("products", (q) => q.eq("is_active", true)),
        countFrom("reviews", (q) => q.eq("status", "approved")),
        countFrom("categories", (q) => q.eq("is_active", true)),
        countFrom("comparisons", (q) => q.eq("is_published", true)),
        countFrom("blog_posts", (q) => q.eq("status", "published")),
        countFrom("buyer_guides", (q) => q.eq("is_published", true)),
        countFrom("glossary_terms", (q) => q.eq("is_published", true)),
        countFrom("deals", (q) => q.eq("is_active", true)),
        (supabase as any)
          .from("products")
          .select("id, name, slug, avg_rating, total_reviews, view_count")
          .eq("is_active", true)
          .order("view_count", { ascending: false })
          .limit(6),
        (supabase as any)
          .from("categories")
          .select("id, name, slug, product_count")
          .eq("is_active", true)
          .order("product_count", { ascending: false })
          .limit(8),
        (supabase as any)
          .from("blog_posts")
          .select("id, title, slug, category, published_at")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(5),
        (supabase as any)
          .from("deals")
          .select("id, product_name, slug, discount_amount, discount_type, is_featured, end_date")
          .eq("is_active", true)
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      return {
        stats: { products, reviews, categories, comparisons, blogPosts, guides, glossary, deals },
        topProducts: (topProductsRes.data ?? []) as PublicProduct[],
        categories: (categoriesRes.data ?? []) as PublicCategory[],
        posts: (postsRes.data ?? []) as PublicPost[],
        deals: (dealsRes.data ?? []) as PublicDeal[],
      };
    },
  });

  const categoryTotal = useMemo(
    () => (data?.categories ?? []).reduce((sum, category) => sum + (category.product_count ?? 0), 0),
    [data?.categories],
  );

  return (
    <>
      <SeoHead title="ReviewHunts Public Dashboard" robots="noindex, nofollow" />
      <main className="min-h-screen bg-background">
        <header className="border-b border-border/60 bg-card/80 backdrop-blur-xl">
          <div className="container flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">ReviewHunts</p>
                <h1 className="text-xl font-display font-bold text-foreground">Public Dashboard</h1>
              </div>
            </Link>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/categories"><Search className="mr-2 h-4 w-4" /> Browse categories</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/login">Admin sign in</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="container space-y-8 py-8">
          <section className="space-y-2">
            <Badge variant="outline">Read-only</Badge>
            <p className="max-w-3xl text-muted-foreground">
              Public platform overview with crawl-safe content metrics. Editing tools, user data, imports, billing,
              email systems, and moderation remain protected behind admin sign-in.
            </p>
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
            <StatCard title="Products" value={isLoading ? "…" : formatNumber(data?.stats.products)} icon={Package} color="primary" />
            <StatCard title="Reviews" value={isLoading ? "…" : formatNumber(data?.stats.reviews)} icon={Star} color="secondary" />
            <StatCard title="Categories" value={isLoading ? "…" : formatNumber(data?.stats.categories)} icon={FolderOpen} color="success" />
            <StatCard title="Comparisons" value={isLoading ? "…" : formatNumber(data?.stats.comparisons)} icon={TrendingUp} color="warning" />
            <StatCard title="Blog" value={isLoading ? "…" : formatNumber(data?.stats.blogPosts)} icon={FileText} color="primary" />
            <StatCard title="Guides" value={isLoading ? "…" : formatNumber(data?.stats.guides)} icon={BookOpen} color="secondary" />
            <StatCard title="Glossary" value={isLoading ? "…" : formatNumber(data?.stats.glossary)} icon={Globe} color="success" />
            <StatCard title="Deals" value={isLoading ? "…" : formatNumber(data?.stats.deals)} icon={Tag} color="warning" />
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Top public products</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/categories">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                      <TableHead className="text-right">Reviews</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topProducts ?? []).map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          <Link to={`/product/${product.slug}`} className="hover:text-primary">
                            {product.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{Number(product.avg_rating ?? 0).toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(product.total_reviews)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(product.view_count)}</TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && (data?.topProducts ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No public products yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Category coverage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.categories ?? []).map((category) => {
                  const percent = categoryTotal > 0 ? Math.round(((category.product_count ?? 0) / categoryTotal) * 100) : 0;
                  return (
                    <Link key={category.id} to={`/category/${category.slug}`} className="block rounded-lg p-2 hover:bg-muted/50">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">{category.name}</span>
                        <span className="text-muted-foreground tabular-nums">{formatNumber(category.product_count)}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(percent, 4)}%` }} />
                      </div>
                    </Link>
                  );
                })}
                {!isLoading && (data?.categories ?? []).length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No category data available.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Latest articles</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/blog">Blog <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.posts ?? []).map((post) => (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{post.title}</p>
                      <p className="text-xs text-muted-foreground">{post.category || "Editorial"}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(post.published_at)}</span>
                  </Link>
                ))}
                {!isLoading && (data?.posts ?? []).length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No published articles yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Featured deals</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/deals">Deals <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.deals ?? []).map((deal) => (
                  <Link key={deal.id} to={`/deals/${deal.slug}`} className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{deal.product_name}</p>
                      <p className="text-xs text-muted-foreground">Ends {formatDate(deal.end_date)}</p>
                    </div>
                    <Badge variant={deal.is_featured ? "default" : "outline"}>{dealLabel(deal)}</Badge>
                  </Link>
                ))}
                {!isLoading && (data?.deals ?? []).length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No active deals yet.</p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </>
  );
}