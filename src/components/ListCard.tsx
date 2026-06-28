import { Link } from "react-router-dom";
import { ListVoteButton } from "./ListVoteButton";
import { Package, User } from "lucide-react";

interface ListCardProps {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  upvoteCount: number;
  productCount: number;
  creatorName?: string | null;
  productLogos?: string[];
}

export function ListCard({
  id, slug, title, description, upvoteCount, productCount, creatorName, productLogos = [],
}: ListCardProps) {
  return (
    <Link to={`/lists/${slug}`} className="group">
      <div className="glass-card p-5 h-full flex gap-4 hover:shadow-lg transition-shadow">
        <div className="flex-shrink-0 pt-1">
          <ListVoteButton listId={id} upvoteCount={upvoteCount} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            {productLogos.length > 0 && (
              <div className="flex -space-x-2">
                {productLogos.slice(0, 4).map((logo, i) => (
                  <img decoding="async" loading="lazy" key={i} src={logo} alt="" className="h-6 w-6 rounded-md border border-border bg-card object-cover" />
                ))}
              </div>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" /> {productCount} products
            </span>
            {creatorName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> {creatorName}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
