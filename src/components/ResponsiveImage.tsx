/**
 * ResponsiveImage — renders a <picture> with AVIF + WebP sources and a
 * responsive srcset for Supabase Storage URLs (leveraging the on-the-fly
 * image transformer at /storage/v1/render/image/public/...). For non-storage
 * URLs, it renders a plain image element but still enforces width/height +
 * lazy / decoding hints so we don't introduce CLS or block LCP.
 *
 * Width / height are REQUIRED to reserve layout space (CLS defense). If the
 * true intrinsic size is unknown, pass the display aspect ratio (e.g. 16:9 as
 * 1600 × 900) — the browser preserves the ratio, not the absolute pixels.
 *
 * A soft SVG blur placeholder is painted behind the image (seeded off the
 * src) and fades out once the image loads, so tiles feel instant.
 */
import { useState } from "react";
import { buildSrcSet, isSupabaseStorageUrl } from "@/lib/responsive-image";
import { blurPlaceholderDataUri } from "@/lib/blur-placeholder";
import { cn } from "@/lib/utils";

const DEFAULT_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1280px";

export interface ResponsiveImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "srcSet" | "sizes"> {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  /** eager on hero/LCP images, lazy elsewhere (default lazy). */
  loading?: "lazy" | "eager";
  /** high for LCP hero image. */
  fetchPriority?: "high" | "low" | "auto";
  pictureClassName?: string;
  /** Seed override for the blur-up placeholder color (defaults to `src`). */
  placeholderSeed?: string;
  /** Disable the SVG blur placeholder (e.g. transparent logos). */
  disablePlaceholder?: boolean;
}

export function ResponsiveImage({
  src,
  alt,
  width,
  height,
  sizes = DEFAULT_SIZES,
  loading = "lazy",
  fetchPriority,
  className,
  pictureClassName,
  placeholderSeed,
  disablePlaceholder = false,
  onLoad,
  ...rest
}: ResponsiveImageProps) {
  const storage = src && isSupabaseStorageUrl(src);
  const avif = storage ? buildSrcSet(src, "avif") : "";
  const webp = storage ? buildSrcSet(src, "webp") : "";
  const fallback = storage ? buildSrcSet(src) : "";
  const [loaded, setLoaded] = useState(false);

  const placeholderStyle: React.CSSProperties | undefined =
    disablePlaceholder || loaded
      ? undefined
      : {
          backgroundImage: blurPlaceholderDataUri(placeholderSeed || src || alt),
          backgroundSize: "cover",
          backgroundPosition: "center",
        };

  const img = (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      {...(fetchPriority ? { fetchpriority: fetchPriority } as any : {})}
      {...(fallback ? { srcSet: fallback, sizes } : {})}
      className={cn(
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
      style={placeholderStyle}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      {...rest}
    />
  );

  if (!storage) return img;

  return (
    <picture
      className={pictureClassName}
      style={placeholderStyle}
    >
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      {img}
    </picture>
  );
}
