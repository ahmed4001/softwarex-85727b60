import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  scrollToTop?: boolean;
  className?: string;
}

export function PaginationControls({ page, totalPages, onPageChange, scrollToTop = true, className = "" }: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const handlePageChange = (newPage: number) => {
    onPageChange(newPage);
    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="icon"
        className="rounded-xl"
        disabled={page === 0}
        onClick={() => handlePageChange(Math.max(0, page - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {Array.from({ length: totalPages }).map((_, i) => {
        if (totalPages <= 7 || i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) {
          return (
            <Button
              key={i}
              variant={i === page ? "default" : "outline"}
              size="icon"
              className="rounded-xl h-9 w-9 text-sm"
              onClick={() => handlePageChange(i)}
            >
              {i + 1}
            </Button>
          );
        }
        if (i === 1 && page > 3) return <span key={i} className="text-muted-foreground px-1">…</span>;
        if (i === totalPages - 2 && page < totalPages - 4) return <span key={i} className="text-muted-foreground px-1">…</span>;
        return null;
      })}
      <Button
        variant="outline"
        size="icon"
        className="rounded-xl"
        disabled={page >= totalPages - 1}
        onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}