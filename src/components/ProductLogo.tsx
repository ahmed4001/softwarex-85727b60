import { cn } from "@/lib/utils";

interface ProductLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: { container: "h-7 w-7", avatarSize: 56, text: "text-xs" },
  sm: { container: "h-9 w-9", avatarSize: 72, text: "text-sm" },
  md: { container: "h-11 w-11", avatarSize: 88, text: "text-base" },
  lg: { container: "h-16 w-16", avatarSize: 128, text: "text-2xl" },
};

function avatarUrl(name: string, size: number) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=${size}&bold=true&format=png`;
}

export function ProductLogo({ name, logoUrl, size = "md", className }: ProductLogoProps) {
  const s = sizeMap[size];

  return (
    <div className={cn("rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0", s.container, className)}>
      <img
        src={logoUrl || avatarUrl(name, s.avatarSize)}
        alt={`${name} logo`}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.src.includes("ui-avatars.com")) {
            img.src = avatarUrl(name, s.avatarSize);
          }
        }}
      />
    </div>
  );
}
