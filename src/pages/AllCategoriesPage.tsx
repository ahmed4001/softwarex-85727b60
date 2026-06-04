import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { CategoryCard } from "@/components/CategoryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

const SITE_URL = "https://reviewhunts.com";

const categoriesJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "All Software Categories – ReviewHunts",
  description:
    "Browse 50+ software categories including CRM, project management, marketing automation, HR, analytics, cybersecurity, and more. Find the best tools for every business need.",
  url: `${SITE_URL}/categories`,
  isPartOf: { "@type": "WebSite", name: "ReviewHunts", url: SITE_URL },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Categories", item: `${SITE_URL}/categories` },
  ],
};

export default function AllCategoriesPage() {
  const [search, setSearch] = useState("");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["all-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!categories) return [];
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, search]);

  // Group categories alphabetically
  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach((c) => {
      const letter = c.name[0].toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <>
      <SeoHead
        title="All Software Categories – Browse 50+ Business Tool Types"
        description="Explore 50+ software categories on ReviewHunts. Find and compare CRM, project management, marketing automation, HR software, analytics, cybersecurity, AI tools, and more."
        keywords="software categories, SaaS categories, business software types, CRM software, project management tools, marketing automation, HR software, analytics tools, cybersecurity software, AI tools, ERP software, help desk software, e-commerce platforms, collaboration tools, accounting software"
        canonicalUrl={`${SITE_URL}/categories`}
        jsonLd={[categoriesJsonLd, breadcrumbJsonLd]}
      />

      <main className="container py-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <span className="opacity-30">/</span>
          <span className="text-foreground font-medium">All Categories</span>
        </nav>

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">
            Browse All Software Categories
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Discover the right business software across {categories?.length || "50+"}
            &nbsp;categories. Each category features verified user reviews, expert ratings, and
            side-by-side comparisons to help you make the best choice.
          </p>
        </motion.header>

        {/* Search */}
        <div className="relative max-w-md mb-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search software categories"
          />
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground mb-8">
          <span><strong className="text-foreground">{filtered.length}</strong> categories</span>
        </div>

        {/* Grouped listing */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            No categories match "<strong>{search}</strong>"
          </p>
        ) : (
          <div className="space-y-12">
            {grouped.map(([letter, cats]) => (
              <section key={letter} aria-label={`Categories starting with ${letter}`}>
                <h2 className="text-lg font-bold text-primary mb-4 border-b border-border pb-2">
                  {letter}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {cats.map((cat, i) => (
                    <CategoryCard
                      key={cat.id}
                      slug={cat.slug}
                      name={cat.name}
                      icon={cat.icon || ""}
                      product_count={cat.product_count || 0}
                      color={cat.color || "#3b82f6"}
                      index={i}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* SEO content block */}
        <section className="mt-20 max-w-3xl" aria-labelledby="seo-about">
          <h2 id="seo-about" className="text-2xl font-bold text-foreground mb-4">
            How to Choose the Right Software Category
          </h2>
          <div className="prose prose-sm text-muted-foreground space-y-3">
            <p>
              With thousands of SaaS tools available, narrowing down the right category is the
              first step. Whether you need a <strong>CRM</strong> to manage customer relationships,
              a <strong>project management</strong> tool to coordinate teams, or an{" "}
              <strong>AI writing assistant</strong> to scale content production, ReviewHunts
              organises every option into clear, searchable categories.
            </p>
            <p>
              Each category page includes verified user reviews, feature breakdowns, pricing
              comparisons, and expert recommendations — giving you everything you need to make a
              confident buying decision. Use the search above to jump straight to a category, or
              browse alphabetically.
            </p>
            <p>
              Popular categories include <Link to="/category/crm" className="text-primary hover:underline">CRM Software</Link>,{" "}
              <Link to="/category/project-management" className="text-primary hover:underline">Project Management</Link>,{" "}
              <Link to="/category/email-marketing" className="text-primary hover:underline">Email Marketing</Link>,{" "}
              <Link to="/category/hr" className="text-primary hover:underline">HR Software</Link>,{" "}
              <Link to="/category/analytics" className="text-primary hover:underline">Analytics & BI</Link>, and{" "}
              <Link to="/category/no-code" className="text-primary hover:underline">No-Code Platforms</Link>.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
