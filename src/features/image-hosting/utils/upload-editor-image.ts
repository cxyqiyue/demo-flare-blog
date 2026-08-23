import { toast } from "sonner";
import {
  getArticleImageHostingConfigFn,
} from "@/features/image-hosting/api/image-hosting.api";
import type { ArticleImageHostingConfig } from "@/features/image-hosting/image-hosting.schema";
import {
  processImageBeforeUpload,
  type ImageConvertFormat,
} from "@/lib/image-processing";
import { xhrUpload } from "@/lib/xhr-upload";
import { m } from "@/paraglide/messages";

export interface EditorImageUploadResult {
  url: string;
  width?: number;
  height?: number;
}

export interface EditorImageUploadOptions {
  /**
   * 真实上传进度回调（fraction ∈ [0,1]）。
   * 文章编辑器弹窗传入后展示内嵌进度条；其余场景可传给进度 toast。
   */
  onProgress?: (fraction: number) => void;
}

interface ArticleUploadPolicy {
  maxImageBytes: number | null;
  compressEnabled: boolean;
  convertToFormat: ImageConvertFormat;
  /** 编辑器自定义压缩阈值（字节） */
  compressThresholdBytes: number | null;
  /** 压缩目标大小（字节） */
  compressTargetBytes: number | null;
}

const POLICY_CACHE_TTL_MS = 60_000;
let policyCache: { value: ArticleUploadPolicy; fetchedAt: number } | null = null;

function defaultPolicy(): ArticleUploadPolicy {
  return {
    maxImageBytes: 10 * 1024 * 1024,
    compressEnabled: true,
    convertToFormat: "none",
    compressThresholdBytes: null,
    compressTargetBytes: null,
  };
}

/**
 * 获取文章/动态/关于页上传策略（渠道大小上限 + 压缩/转换设置 + 自定义
 * 压缩阈值/目标），带 60s 缓存。
 */
export async function fetchArticleUploadPolicy(): Promise<ArticleUploadPolicy> {
  if (policyCache && Date.now() - policyCache.fetchedAt < POLICY_CACHE_TTL_MS) {
    return policyCache.value;
  }
  try {
    const config = (await getArticleImageHostingConfigFn()) as ArticleImageHostingConfig;
    const value: ArticleUploadPolicy = {
      maxImageBytes: config.maxImageBytes ?? null,
      compressEnabled: config.compressEnabled ?? true,
      convertToFormat: config.convertToFormat ?? "none",
      compressThresholdBytes: config.compressThresholdBytes ?? null,
      compressTargetBytes: config.compressTargetBytes ?? null,
    };
    policyCache = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return defaultPolicy();
  }
}

export function clearArticleUploadPolicyCache(): void {
  policyCache = null;
}

/**
 * 所有 markdown 编辑器共用的图片上传入口：
 * 1. 按图床渠道设置判断是否需要压缩 / 格式转换（客户端 Canvas 处理）；
 * 2. 经 XHR 端点上传到图床（支持真实进度）；未启用图床时回退到媒体库 R2。
 * 失败时抛出异常，由调用方展示错误提示。
 */
export async function uploadEditorImage(
  rawFile: File,
  options?: EditorImageUploadOptions,
): Promise<EditorImageUploadResult> {
  const policy = await fetchArticleUploadPolicy();
  const { file } = await processImageBeforeUpload(rawFile, {
    maxBytes: policy.maxImageBytes,
    compressEnabled: policy.compressEnabled,
    convertToFormat: policy.convertToFormat,
    compressThresholdBytes: policy.compressThresholdBytes,
    compressTargetBytes: policy.compressTargetBytes,
  });

  const formData = new FormData();
  formData.append("image", file);

  const hosted = await xhrUpload<ArticleUploadEndpointResult>({
    url: "/api/image-hosting/upload",
    formData,
    onProgress: options?.onProgress,
  });
  if (!hosted.ok) {
    throw new Error(hosted.message || m.image_hosting_upload_failed());
  }

  if (hosted.data.mode === "image-hosting") {
    toastSuccess(file.name, true);
    return {
      url: hosted.data.url,
      width: hosted.data.width || undefined,
      height: hosted.data.height || undefined,
    };
  }

  if (hosted.data.mode === "none") {
    const result = await xhrUpload<{ url: string; width?: number | null; height?: number | null }>({
      url: "/api/media/upload",
      formData,
      onProgress: options?.onProgress,
    });
    if (!result.ok) {
      throw new Error(result.message || m.media_upload_error_db());
    }
    toastSuccess(file.name, false);
    return {
      url: result.data.url,
      width: result.data.width || undefined,
      height: result.data.height || undefined,
    };
  }

  throw new Error(m.image_hosting_upload_failed());
}

/** POST /api/image-hosting/upload 的响应 data 形状 */
type ArticleUploadEndpointResult =
  | {
      mode: "image-hosting";
      url: string;
      width?: number | null;
      height?: number | null;
    }
  | { mode: "none" };

function toastSuccess(name: string, hosted: boolean): void {
  if (hosted) {
    toast.success(m.image_hosting_upload_success({ name }), {
      description: m.image_hosting_upload_success_desc({ name }),
    });
    return;
  }
  toast.success(m.media_upload_success({ name }), {
    description: m.editor_image_upload_success_desc({ name }),
  });
}
