import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/SearchBar";
import { Home, Compass, BookOpen, LayoutGrid, ArrowRight } from "lucide-react";

const POPULAR = [
  { to: "/categories", icon: LayoutGrid, label: "Browse categories", desc: "100+ software categories" },
  { to: "/compare", icon: ArrowRight, label: "Compare software", desc: "Side-by-side comparisons" },
  { to: "/guides", icon: Compass, label: "Buyer guides", desc: "How to choose the right tool" },
  { to: "/blog", icon: BookOpen, label: "Latest articles", desc: "SaaS trends & reviews" },
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <SeoHead
        title="Page not found (404)"
        description="The page you're looking for doesn't exist or has moved. Search ReviewHunts or explore popular categories, comparisons, and buyer guides."
        robots="noindex, follow"
      />
      <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center">
          <p className="text-sm font-semibold text-primary tracking-widest uppercase mb-3">Error 404</p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            We couldn't find that page
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
            The link may be broken or the page may have moved. Try searching, or jump to one of our most-visited sections below.
          </p>

          <div className="max-w-md mx-auto mb-10">
            <SearchBar variant="hero" className="w-full" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-left mb-8">
            {POPULAR.map(({ to, icon: Icon, label, desc }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all"
              >
                <span className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-foreground group-hover:text-primary transition-colors">{label}</span>
                  <span className="block text-xs text-muted-foreground truncate">{desc}</span>
                </span>
              </Link>
            ))}
          </div>

          <Button asChild size="lg">
            <Link to="/"><Home className="h-4 w-4 mr-2" /> Back to homepage</Link>
          </Button>
        </div>
      </main>
    </>
  );
};

export default NotFound;
