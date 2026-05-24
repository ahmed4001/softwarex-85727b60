// Client-side image optimizer: resize + compress + convert to WebP via canvas.
// Zero dependencies. Falls back to original file on failure or for non-raster types.

export interface OptimizeOptions {
  maxWidth?: number;       // default 1600
  maxHeight?: number;      // default 1600
  quality?: number;        // 0..1, default 0.82
  mimeType?: "image/webp" | "image/jpeg"; // default webp
  /** If output ends up larger than original, keep the original */
  preferSmaller?: boolean; // default true
}

export interface OptimizeResult {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
  savedPct: number;
  format: string;
  skipped: boolean;
}

const RASTER = /^image\/(jpeg|png|webp|bmp|tiff)$/i;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function optimizeImage(file: File, opts: OptimizeOptions = {}): Promise<OptimizeResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    mimeType = "image/webp",
    preferSmaller = true,
  } = opts;

  const original = {
    file,
    width: 0,
    height: 0,
    originalBytes: file.size,
    optimizedBytes: file.size,
    savedPct: 0,
    format: file.type,
    skipped: true,
  };

  // Skip SVG, GIF, AVIF (animations/vectors), or non-raster types
  if (!RASTER.test(file.type)) return original;

  try {
    const img = await loadImage(file);
    const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const targetW = Math.round(img.width * ratio);
    const targetH = Math.round(img.height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await canvasToBlob(canvas, mimeType, quality);
    if (!blob) return original;

    if (preferSmaller && blob.size >= file.size && ratio === 1) {
      return { ...original, width: img.width, height: img.height };
    }

    const ext = mimeType === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const optimizedFile = new File([blob], `${baseName}.${ext}`, { type: mimeType });

    return {
      file: optimizedFile,
      width: targetW,
      height: targetH,
      originalBytes: file.size,
      optimizedBytes: blob.size,
      savedPct: Math.max(0, Math.round((1 - blob.size / file.size) * 100)),
      format: mimeType,
      skipped: false,
    };
  } catch {
    return original;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
