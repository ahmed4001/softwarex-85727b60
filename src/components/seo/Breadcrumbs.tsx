import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Base URL used in JSON-LD. Defaults to current origin at runtime. */
  baseUrl?: string;
  className?: string;
}

/**
 * Visible breadcrumb trail + BreadcrumbList JSON-LD.
 * Combined AIO (machine-readable nav graph) + SXO (orientation, lower bounce).
 */
export function Breadcrumbs({ items, baseUrl, className }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  const origin =
    baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "https://reviewhunts.com");

  const full: BreadcrumbItem[] = [{ label: "Home", href: "/" }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: full.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.label,
      item: it.href ? `${origin}${it.href}` : undefined,
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={className ?? "text-sm text-muted-foreground mb-4"}>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <ol className="flex flex-wrap items-center gap-1.5">
        {full.map((it, idx) => {
          const isLast = idx === full.length - 1;
          return (
            <li key={`${it.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
              {isLast || !it.href ? (
                <span
                  className={isLast ? "text-foreground font-medium" : ""}
                  aria-current={isLast ? "page" : undefined}
                >
                  {idx === 0 ? <Home className="h-3.5 w-3.5 inline" aria-label="Home" /> : it.label}
                </span>
              ) : (
                <Link to={it.href} className="hover:text-foreground transition-colors">
                  {idx === 0 ? <Home className="h-3.5 w-3.5 inline" aria-label="Home" /> : it.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
