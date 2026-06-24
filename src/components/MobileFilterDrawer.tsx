import { ReactNode, useState } from "react";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListFilter, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile-first filter + sort drawer.
 *
 * Renders a sticky "Filter & Sort" trigger button (mobile-only) that opens
 * a bottom sheet containing one or more sections (sort, category, tier,
 * toggles, etc). Each section is rendered as children, so each listing
 * page keeps full control over its own filter state — this component just
 * provides the consistent chrome (trigger, sheet, footer with Clear/Apply,
 * active-count badge).
 *
 * Design choices:
 * - Bottom sheet (not popover/select) because thumb-reach on mobile is at
 *   the bottom of the viewport.
 * - Sticky trigger so users can re-open the drawer without scrolling back
 *   to the top of a long list.
 * - Footer with Clear + Apply: Apply just closes; Clear is a passthrough
 *   to the parent so the parent can reset its own state.
 * - md:hidden so this component is a strict no-op on desktop — desktop
 *   keeps the full inline filter row.
 */
export interface MobileFilterDrawerProps {
  /** Number of active filters/non-default sort — drives the badge on the trigger. */
  activeCount?: number;
  /** Drawer body — typically <FilterSection>...</FilterSection> blocks. */
  children: ReactNode;
  /** Optional result count rendered next to the trigger ("123 results"). */
  resultCount?: number;
  resultLabel?: string;
  /** Called when the user taps Clear in the footer. */
  onClear?: () => void;
  /** Optional analytics hook fired when the drawer opens. */
  onOpen?: () => void;
  /** Override the trigger label. Defaults to "Filter & Sort". */
  triggerLabel?: string;
  className?: string;
}

export function MobileFilterDrawer({
  activeCount = 0,
  children,
  resultCount,
  resultLabel = "results",
  onClear,
  onOpen,
  triggerLabel = "Filter & Sort",
  className,
}: MobileFilterDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "md:hidden sticky top-[56px] z-20 -mx-4 px-4 py-2.5 bg-background/85 backdrop-blur-xl border-b border-border flex items-center gap-2",
        className,
      )}
    >
      {resultCount !== undefined && (
        <div className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
          <span className="font-semibold text-foreground">{resultCount}</span> {resultLabel}
        </div>
      )}

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) onOpen?.();
        }}
      >
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 h-9 px-3 text-xs font-medium flex-shrink-0 relative"
            aria-label={triggerLabel}
          >
            <ListFilter className="h-3.5 w-3.5" />
            {triggerLabel}
            {activeCount > 0 && (
              <Badge className="ml-1 h-5 min-w-5 px-1.5 rounded-full text-[10px] tabular-nums">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85vh] flex flex-col p-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 flex-shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ListFilter className="h-4 w-4 text-primary" />
              {triggerLabel}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">{children}</div>
          <SheetFooter className="px-5 py-3 border-t border-border/60 flex-row gap-2 flex-shrink-0 bg-background">
            {onClear && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => {
                  onClear();
                }}
                disabled={activeCount === 0}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
            <Button size="sm" className="flex-1" onClick={() => setOpen(false)}>
              Show {resultCount !== undefined ? `${resultCount} ${resultLabel}` : "results"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Labelled section inside the drawer body. */
export function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

/**
 * Single-select chip group rendered as full-width pill buttons inside a
 * drawer section. Each row is min 44px tall to satisfy WCAG tap target.
 */
export function FilterOptionList<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between min-h-11",
              active
                ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                : "bg-muted/50 text-foreground hover:bg-muted",
            )}
          >
            <span>{opt.label}</span>
            {opt.hint && (
              <span className="text-xs text-muted-foreground tabular-nums">{opt.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
