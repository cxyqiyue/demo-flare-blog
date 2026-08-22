import { toast } from "sonner";
import {
  getArticleImageHostingConfigFn,
  uploadToImageHostingFn,
} from "@/features/image-hosting/api/image-hosting.api";
import type { ArticleImageHostingConfig } from "@/features/image-hosting/image-hosting.schema";
import { uploadImageFn } from "@/features/media/api/media.api";
import {
  processImageBeforeUpload,
  type ImageConvertFormat,
} from "@/lib/image-processing";
import { m } from "@/paraglide/messages";

export interface EditorImageUploadResult {
  url: string;
  width?: number;
  height?: number;
}

interface ArticleUploadPolicy {
  maxImageBytes: number | null;
  compressEnabled: boolean;
  convertToFormat: ImageConvertFormat;
}

const POLICY_CACHE_TTL_MS = 60_000;
let policyCache: { value: ArticleUploadPolicy; fetchedAt: number } | null = null;

function defaultPolicy(): ArticleUploadPolicy {
  return {
    maxImageBytes: 10 * 1024 * 1024,
    compressEnabled: true,
    convertToFormat: "none",
  };
}

/**
 * 获取文章/动态/关于页上传策略（渠道大小上限 + 压缩/转换设置），带 60s 缓存。
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
 * 2. 上传到图床；未启用图床时回退到媒体库 R2。
 * 失败时抛出异常，由调用方展示错误提示。
 */
export async function uploadEditorImage(
  rawFile: File,
): Promise<EditorImageUploadResult> {
  const policy = await fetchArticleUploadPolicy();
  const { file } = await processImageBeforeUpload(rawFile, {
    maxBytes: policy.maxImageBytes,
    compressEnabled: policy.compressEnabled,
    convertToFormat: policy.convertToFormat,
  });

  const formData = new FormData();
  formData.append("image", file);

  const hosted = await uploadToImageHostingFn({ data: formData });
  if (hosted.error) {
    throw new Error(m.image_hosting_upload_failed());
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
    const result = await uploadImageFn({ data: formData });
    if (result.error) {
      throw new Error(m.media_upload_error_db());
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
