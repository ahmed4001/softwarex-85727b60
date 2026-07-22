import { useState } from "react";
import { cn } from "@/lib/utils";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { isSupabaseStorageUrl } from "@/lib/responsive-image";

interface ProductLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** Set true only on the LCP product logo (hero of ProductDetailPage). */
  priority?: boolean;
}

const sizeMap = {
  xs: { container: "h-7 w-7", px: 56, text: "text-xs", sizes: "28px" },
  sm: { container: "h-9 w-9", px: 72, text: "text-sm", sizes: "36px" },
  md: { container: "h-11 w-11", px: 88, text: "text-base", sizes: "44px" },
  lg: { container: "h-16 w-16", px: 128, text: "text-2xl", sizes: "64px" },
};

function avatarUrl(name: string, size: number) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=${size}&bold=true&format=png`;
}

export function ProductLogo({ name, logoUrl, size = "md", className, priority = false }: ProductLogoProps) {
  const s = sizeMap[size];
  const [failed, setFailed] = useState(false);
  const src = !failed && logoUrl ? logoUrl : avatarUrl(name, s.px);
  const commonProps = {
    alt: `${name} logo`,
    width: s.px,
    height: s.px,
    sizes: s.sizes,
    loading: priority ? ("eager" as const) : ("lazy" as const),
    fetchPriority: priority ? ("high" as const) : ("auto" as const),
    className: "h-full w-full object-cover",
  };

  return (
    <div className={cn("rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0", s.container, className)}>
      {isSupabaseStorageUrl(src) ? (
        <ResponsiveImage src={src} {...commonProps} />
      ) : (
        <img
          src={src}
          {...commonProps}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
