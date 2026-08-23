/**
 * 客户端图片压缩与格式转换（参考 CloudFlare-ImgBed 的上传前处理）。
 *
 * - 仅处理位图图片；GIF（动图会丢帧）与 SVG（矢量）跳过。
 * - 压缩：文件超过 maxBytes 时，先降质量、再缩尺寸，迭代直到满足上限或到达下限。
 * - 转换：convertToFormat 指定目标格式（webp/jpeg）时重编码。
 */

export type ImageConvertFormat = "none" | "webp" | "jpeg";

export interface ImageProcessOptions {
  /** 渠道允许的最大字节数；null = 不因渠道限制触发压缩 */
  maxBytes: number | null;
  /** 是否启用超限压缩 */
  compressEnabled?: boolean;
  /** 目标转换格式 */
  convertToFormat?: ImageConvertFormat;
  /**
   * 编辑器自定义压缩阈值（字节）：文件超过该值即触发压缩（与渠道上限
   * 取更小者），实现「编辑器压缩策略与媒体库原始限制分离」。
   */
  compressThresholdBytes?: number | null;
  /** 压缩目标大小（字节）：迭代向该尺寸收敛（同样不超过渠道上限） */
  compressTargetBytes?: number | null;
}

export interface ImageProcessResult {
  file: File;
  /** 是否发生了压缩或格式转换 */
  processed: boolean;
  converted: boolean;
  compressed: boolean;
  originalSize: number;
}

const FORMAT_MIME: Record<"webp" | "jpeg", string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
};

const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.1;
const SCALE_STEP = 0.8;
const MAX_ITERATIONS = 12;

function isProcessableImage(file: File): boolean {
  if (!file.type.startsWith("image/")) return false;
  if (file.type === "image/gif") return false;
  if (file.type === "image/svg+xml") return false;
  return true;
}

/** 触发压缩的有效阈值：渠道上限与编辑器自定义阈值取更小者 */
function resolveTriggerBytes(options: ImageProcessOptions): number | null {
  const candidates = [options.maxBytes, options.compressThresholdBytes].filter(
    (n): n is number => typeof n === "number" && n > 0,
  );
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

/** 压缩迭代的收敛目标：渠道上限与自定义目标大小取更小者 */
function resolveLoopTargetBytes(options: ImageProcessOptions): number | null {
  const candidates = [
    ...(options.maxBytes !== null ? [options.maxBytes] : []),
    ...(typeof options.compressTargetBytes === "number" &&
    options.compressTargetBytes > 0
      ? [options.compressTargetBytes]
      : []),
  ];
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

export function planImageProcessing(
  file: File,
  options: ImageProcessOptions,
): { action: "skip" | "convert" | "compress"; targetMime: string } {
  if (!isProcessableImage(file)) {
    return { action: "skip", targetMime: file.type };
  }

  const format = options.convertToFormat ?? "none";
  const needsConvert =
    (format === "webp" && file.type !== "image/webp") ||
    (format === "jpeg" && file.type !== "image/jpeg");

  const triggerBytes = resolveTriggerBytes(options);
  const overLimit =
    triggerBytes !== null &&
    file.size > triggerBytes &&
    options.compressEnabled !== false;

  if (overLimit) return { action: "compress", targetMime: FORMAT_MIME[format === "none" ? "webp" : format] };
  if (needsConvert) return { action: "convert", targetMime: FORMAT_MIME[format] };
  return { action: "skip", targetMime: file.type };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file);
}

function drawToCanvas(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas toBlob failed"))),
      mime,
      quality,
    );
  });
}

function renameWithExt(fileName: string, mime: string): string {
  const ext = mime === "image/webp" ? "webp" : mime === "image/jpeg" ? "jpg" : "";
  if (!ext) return fileName;
  const base = fileName.replace(/\.[^.]+$/, "");
  return `${base}.${ext}`;
}

/**
 * 上传前处理图片：按需压缩到渠道上限内，并按设置转换格式。
 * 处理失败或不适用时原样返回，不阻塞上传。
 */
export async function processImageBeforeUpload(
  file: File,
  options: ImageProcessOptions,
): Promise<ImageProcessResult> {
  const plan = planImageProcessing(file, options);
  const base: ImageProcessResult = {
    file,
    processed: false,
    converted: false,
    compressed: false,
    originalSize: file.size,
  };

  if (plan.action === "skip") return base;

  const loopTargetBytes = resolveLoopTargetBytes(options);

  try {
    const bitmap = await loadBitmap(file);
    const targetMime = plan.targetMime;
    const willConvert = targetMime !== file.type;

    let scale = 1;
    let quality = 0.9;
    let bestBlob: Blob | null = null;

    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      const canvas = drawToCanvas(bitmap, bitmap.width * scale, bitmap.height * scale);
      const blob = await canvasToBlob(canvas, targetMime, quality);

      if (
        bestBlob === null ||
        blob.size < bestBlob.size ||
        (loopTargetBytes !== null &&
          blob.size <= loopTargetBytes &&
          bestBlob.size > loopTargetBytes)
      ) {
        bestBlob = blob;
      }

      if (loopTargetBytes === null || blob.size <= loopTargetBytes) break;

      if (quality - QUALITY_STEP >= MIN_QUALITY) {
        quality = Math.round((quality - QUALITY_STEP) * 10) / 10;
      } else {
        quality = 0.9;
        scale *= SCALE_STEP;
      }
    }
    bitmap.close?.();

    if (!bestBlob) return base;

    // 转换无收益且未超限时保留原图
    if (
      !willConvert &&
      bestBlob.size >= file.size &&
      (loopTargetBytes === null || file.size <= loopTargetBytes)
    ) {
      return base;
    }

    const processedFile = new File([bestBlob], renameWithExt(file.name, targetMime), {
      type: targetMime,
    });
    return {
      file: processedFile,
      processed: true,
      converted: willConvert,
      compressed: bestBlob.size < file.size,
      originalSize: file.size,
    };
  } catch {
    return base;
  }
}
