import { useFAQ } from "@/hooks/useFAQ";
import { FAQSection } from "@/components/seo/FAQSection";
import { Skeleton } from "@/components/ui/skeleton";

interface AIFaqBlockProps {
  entityType: "product" | "comparison" | "category" | "guide" | "glossary" | "blog";
  entitySlug: string | undefined;
  context: {
    name: string;
    description?: string;
    category?: string;
    extra?: Record<string, unknown>;
  };
  title?: string;
  className?: string;
  /** Canonical page URL — used to anchor-cite individual Q's in JSON-LD. */
  pageUrl?: string;
}

/**
 * Drop-in: AI-generated, cached, editable FAQs for any page.
 * Renders nothing on error so it never breaks pages.
 */
export function AIFaqBlock({ entityType, entitySlug, context, title, className, pageUrl }: AIFaqBlockProps) {
  const { items, loading, error, isEdited, editedByName } = useFAQ({ entityType, entitySlug, context });

  if (loading) {
    return (
      <section className={className ?? "mt-12"}>
        <Skeleton className="h-7 w-64 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (error || items.length === 0) return null;

  return (
    <FAQSection
      items={items}
      title={title}
      className={className}
      isEdited={isEdited}
      editedByName={editedByName ?? undefined}
      pageUrl={pageUrl}
    />
  );
}
