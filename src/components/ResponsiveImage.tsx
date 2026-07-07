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
 */
import { buildSrcSet, isSupabaseStorageUrl } from "@/lib/responsive-image";
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
  ...rest
}: ResponsiveImageProps) {
  const storage = src && isSupabaseStorageUrl(src);
  const avif = storage ? buildSrcSet(src, "avif") : "";
  const webp = storage ? buildSrcSet(src, "webp") : "";
  const fallback = storage ? buildSrcSet(src) : "";

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
      className={className}
      {...rest}
    />
  );

  if (!storage) return img;

  return (
    <picture className={pictureClassName}>
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      {img}
    </picture>
  );
}
