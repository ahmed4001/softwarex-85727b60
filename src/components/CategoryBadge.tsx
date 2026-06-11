import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  name: string;
  slug?: string;
  className?: string;
}

export function CategoryBadge({ name, slug, className }: CategoryBadgeProps) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full",
        "bg-primary/5 border border-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wider",
        "transition-all duration-300",
        "hover:bg-primary/10 hover:border-primary/20 hover:shadow-[0_2px_10px_-3px_hsl(var(--primary)/0.15)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer",
        className
      )}
    >
      <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
      {name}
    </span>
  );

  if (slug) {
    return (
      <Link to={`/category/${slug}`} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
