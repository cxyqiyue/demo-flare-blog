import type { SystemConfig } from "@/features/config/config.schema";
import * as ConfigService from "@/features/config/service/config.service";
import type {
  ArticleImageHostingConfig,
  CommentImageHostingConfig,
  ImageHostingProviderLabel,
  TestImageHostingConnectionInput,
} from "@/features/image-hosting/image-hosting.schema";
import {
  DEFAULT_FFSKY_API_ENDPOINT,
  IMGBB_API_ENDPOINT,
  TEST_IMAGE_BASE64,
} from "@/features/image-hosting/image-hosting.schema";
import {
  type S3UploadConfig,
  uploadToS3,
} from "@/features/image-hosting/s3/s3-upload";
import { parseUploadMediaInput } from "@/features/media/media.schema";
import * as MediaStorage from "@/features/media/data/media.storage";
import { getImageDimensions } from "@/features/media/utils/image-dimensions";
import { err, ok, type Result } from "@/lib/errors";
import { m } from "@/paraglide/messages";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

interface S3RuntimeConfig {
  enabled: boolean;
  config: S3UploadConfig;
}

/**
 * 解析 S3 兼容存储运行时配置。未启用或缺少必需字段时返回 null。
 */
function resolveS3RuntimeConfig(
  config: SystemConfig | undefined,
  pathway: "article" | "comment",
): S3RuntimeConfig | null {
  const s3 = config?.imageHosting?.s3;
  if (!s3) return null;

  const endpoint = s3.endpoint?.trim();
  const bucket = s3.bucket?.trim();
  const accessKeyId = s3.accessKeyId?.trim();
  const secretAccessKey = s3.secretAccessKey?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    enabled: pathway === "article" ? !!s3.articleEnabled : !!s3.commentEnabled,
    config: {
      endpoint: endpoint.replace(/\/+$/, ""),
      bucket,
      region: s3.region?.trim() || "",
      accessKeyId,
      secretAccessKey,
      pathPrefix: s3.pathPrefix?.trim() || "",
      publicUrl: s3.publicUrl?.trim() || "",
    },
  };
}

function extensionFromMime(mime: string): string {
  return MIME_EXTENSIONS[mime] ?? "png";
}

function buildObjectKey(pathPrefix: string, ext: string): string {
  let uuid = "";
  try {
    uuid = crypto.randomUUID();
  } catch {
    uuid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }
  const baseName = `${Date.now()}-${uuid}.${ext}`;
  return [pathPrefix.replace(/^\/+|\/+$/g, ""), baseName]
    .filter(Boolean)
    .join("/");
}

async function uploadToS3ForFile(
  config: S3UploadConfig,
  file: File,
): Promise<
  Result<
    { url: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  return await uploadToS3(config, {
    key: buildObjectKey(config.pathPrefix, extensionFromMime(file.type)),
    body: await file.arrayBuffer(),
    contentType: file.type || "application/octet-stream",
  });
}

function extractImageUrlFromResponse(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) return null;

  const body = parsed as Record<string, unknown>;
  const imgbbData = body.data;
  if (imgbbData && typeof imgbbData === "object") {
    const data = imgbbData as Record<string, unknown>;
    if (typeof data.display_url === "string" && data.display_url) {
      return data.display_url;
    }
    if (typeof data.url === "string" && data.url) {
      return data.url;
    }
  }

  const imageData = body.image;
  if (imageData && typeof imageData === "object") {
    const data = imageData as Record<string, unknown>;
    if (typeof data.url === "string" && data.url) {
      return data.url;
    }
    if (typeof data.display_url === "string" && data.display_url) {
      return data.display_url;
    }
  }

  return null;
}

function extractErrorMessage(parsed: unknown, responseText: string): string {
  if (typeof parsed === "object" && parsed !== null) {
    const body = parsed as Record<string, unknown>;
    const error = body.error;
    if (error && typeof error === "object") {
      const errorData = error as Record<string, unknown>;
      const message =
        typeof errorData.message === "string" && errorData.message
          ? errorData.message
          : typeof errorData.code === "string" && errorData.code
            ? errorData.code
            : undefined;
      if (message) return message;
    }
    if (typeof body.status_txt === "string" && body.status_txt) {
      return body.status_txt;
    }
  }
  if (responseText) return responseText.slice(0, 300);
  return "Request failed";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function uploadToEndpoint(
  endpoint: string,
  apiKey: string,
  base64: string,
  fieldName: "image" | "source",
): Promise<
  Result<
    { url: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  try {
    const form = new FormData();
    form.append("key", apiKey);
    form.append(fieldName, base64);

    const response = await fetch(endpoint, { method: "POST", body: form });
    const responseText = await response.text();

    let parsed: unknown = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    const url = extractImageUrlFromResponse(parsed);
    if (url) return ok({ url });

    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: extractErrorMessage(parsed, responseText),
    });
  } catch (error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function getApiKeyProviderFieldInfo(type: string): {
  fieldName: "image" | "source";
  defaultEndpoint: string;
} {
  if (type === "ffsky") {
    return { fieldName: "source", defaultEndpoint: DEFAULT_FFSKY_API_ENDPOINT };
  }
  return { fieldName: "image", defaultEndpoint: IMGBB_API_ENDPOINT };
}

export type ArticleUploadResult =
  | {
      mode: "image-hosting";
      provider: ImageHostingProviderLabel;
      url: string;
      width?: number;
      height?: number;
    }
  | { mode: "none" };

export async function uploadForArticle(
  context: DbContext & { executionCtx: ExecutionContext },
  formData: FormData,
): Promise<
  Result<
    ArticleUploadResult,
    { reason: "IMAGE_HOSTING_UPLOAD_FAILED"; message: string }
  >
> {
  const { file } = parseUploadMediaInput(formData, m);
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;

  // ── 1. S3 兼容存储（第三方优先） ──
  const s3Runtime = resolveS3RuntimeConfig(config, "article");
  if (s3Runtime?.enabled) {
    const result = await uploadToS3ForFile(s3Runtime.config, file);
    if (result.error) {
      return err({
        reason: "IMAGE_HOSTING_UPLOAD_FAILED",
        message: result.error.message,
      });
    }
    const dimensions = getImageDimensions(await file.arrayBuffer());
    return ok({
      mode: "image-hosting",
      provider: "s3",
      url: result.data.url,
      width: dimensions?.width,
      height: dimensions?.height,
    });
  }

  // ── 2. API Key 图床（第三方优先） ──
  const apiProviders = ih?.apiProviders ?? [];
  let lastError: { message: string } | null = null;

  for (const p of apiProviders) {
    if (!p.articleEnabled || !p.apiKey?.trim()) continue;

    const { fieldName, defaultEndpoint } = getApiKeyProviderFieldInfo(p.type);
    const endpoint =
      p.type === "ffsky"
        ? (p.apiEndpoint?.trim() || defaultEndpoint)
        : defaultEndpoint;

    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const result = await uploadToEndpoint(
      endpoint,
      p.apiKey.trim(),
      base64,
      fieldName,
    );

    if (result.error) {
      lastError = result.error;
      continue;
    }

    const dimensions = getImageDimensions(await file.arrayBuffer());
    return ok({
      mode: "image-hosting",
      provider: p.type,
      url: result.data.url,
      width: dimensions?.width,
      height: dimensions?.height,
    });
  }

  if (lastError) {
    return err({
      reason: "IMAGE_HOSTING_UPLOAD_FAILED",
      message: lastError.message,
    });
  }

  // ── 3. R2 原生（兜底） ──
  if (ih?.r2Native?.articleEnabled) {
    const ext = extensionFromMime(file.type);
    const key = buildObjectKey("articles", ext);
    try {
      await MediaStorage.putToR2(context.env, file, key);
      const dimensions = getImageDimensions(await file.arrayBuffer());
      const url = `/images/${key}`;
      return ok({
        mode: "image-hosting",
        provider: "r2-native",
        url,
        width: dimensions?.width,
        height: dimensions?.height,
      });
    } catch (error) {
      return err({
        reason: "IMAGE_HOSTING_UPLOAD_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return ok({ mode: "none" });
}

export async function uploadCommentImage(
  context: DbContext & { executionCtx: ExecutionContext },
  formData: FormData,
): Promise<
  Result<
    { url: string },
    { reason: "COMMENT_IMAGE_UPLOAD_FAILED"; message: string }
  >
> {
  const { file } = parseUploadMediaInput(formData, m);
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;

  // ── 1. S3 兼容存储（第三方优先） ──
  const s3Runtime = resolveS3RuntimeConfig(config, "comment");
  if (s3Runtime?.enabled) {
    const result = await uploadToS3ForFile(s3Runtime.config, file);
    if (result.error) {
      return err({
        reason: "COMMENT_IMAGE_UPLOAD_FAILED",
        message: result.error.message,
      });
    }
    return ok({ url: result.data.url });
  }

  // ── 2. API Key 图床（第三方优先，仅支持 commentEnabled 的） ──
  const apiProviders = ih?.apiProviders ?? [];
  for (const p of apiProviders) {
    if (!p.commentEnabled || !p.apiKey?.trim()) continue;

    const { fieldName, defaultEndpoint } = getApiKeyProviderFieldInfo(p.type);
    const endpoint =
      p.type === "ffsky"
        ? (p.apiEndpoint?.trim() || defaultEndpoint)
        : defaultEndpoint;

    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const result = await uploadToEndpoint(
      endpoint,
      p.apiKey.trim(),
      base64,
      fieldName,
    );

    if (result.error) {
      return err({
        reason: "COMMENT_IMAGE_UPLOAD_FAILED",
        message: result.error.message,
      });
    }
    return ok({ url: result.data.url });
  }

  // ── 3. R2 原生（兜底） ──
  if (ih?.r2Native?.commentEnabled) {
    const ext = extensionFromMime(file.type);
    const key = buildObjectKey("comments", ext);
    try {
      await MediaStorage.putToR2(context.env, file, key);
      return ok({ url: `/images/${key}` });
    } catch (error) {
      return err({
        reason: "COMMENT_IMAGE_UPLOAD_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return err({
    reason: "COMMENT_IMAGE_UPLOAD_FAILED",
    message: m.settings_image_hosting_comment_not_configured(),
  });
}

export async function testConnection(
  input: TestImageHostingConnectionInput,
): Promise<
  Result<
    { success: true; url: string },
    { reason: "IMAGE_HOSTING_TEST_FAILED"; message: string }
  >
> {
  if (input.category === "s3") {
    const s3 = input.s3;
    if (!s3) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: m.settings_image_hosting_test_missing_s3_config(),
      });
    }

    const accessKeyId = s3.accessKeyId?.trim() ?? "";
    const secretAccessKey = s3.secretAccessKey?.trim() ?? "";
    const bucket = s3.bucket?.trim() ?? "";
    const endpoint = s3.endpoint?.trim() ?? "";

    if (!accessKeyId || !secretAccessKey) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: m.settings_image_hosting_test_missing_key(),
      });
    }
    if (!endpoint || !bucket) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: m.settings_image_hosting_test_missing_s3_config(),
      });
    }

    const result = await uploadToS3(
      {
        endpoint: endpoint.replace(/\/+$/, ""),
        bucket,
        region: s3.region?.trim() || "",
        accessKeyId,
        secretAccessKey,
        pathPrefix: s3.pathPrefix?.trim() || "",
        publicUrl: s3.publicUrl?.trim() || "",
      },
      {
        key: `test-${Date.now()}.png`,
        body: base64ToArrayBuffer(TEST_IMAGE_BASE64),
        contentType: "image/png",
      },
    );

    if (result.error) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: result.error.message,
      });
    }

    return ok({ success: true, url: result.data.url });
  }

  // API Key 图床
  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) {
    return err({
      reason: "IMAGE_HOSTING_TEST_FAILED",
      message: m.settings_image_hosting_test_missing_key(),
    });
  }

  const providerType = input.apiKeyProviderType ?? "imgbb";
  const { fieldName, defaultEndpoint } = getApiKeyProviderFieldInfo(providerType);
  const apiEndpoint =
    providerType === "imgbb"
      ? defaultEndpoint
      : input.apiEndpoint?.trim() || defaultEndpoint;

  const result = await uploadToEndpoint(apiEndpoint, apiKey, TEST_IMAGE_BASE64, fieldName);
  if (result.error) {
    return err({
      reason: "IMAGE_HOSTING_TEST_FAILED",
      message: result.error.message,
    });
  }

  return ok({ success: true, url: result.data.url });
}

export async function getCommentImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<CommentImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;

  if (ih?.r2Native?.commentEnabled) {
    return { enabled: true, providerCategory: "r2-native" };
  }

  if (ih?.s3?.commentEnabled) {
    return { enabled: true, providerCategory: "s3" };
  }

  const activeApiProvider = ih?.apiProviders?.find((p) => p.commentEnabled);
  if (activeApiProvider) {
    return {
      enabled: true,
      providerCategory: "api-key",
      providerType: activeApiProvider.type,
    };
  }

  return { enabled: false, providerCategory: null };
}

export async function getArticleImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<ArticleImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;

  // 仅当外部图床（非 R2 原生）启用时返回 enabled=true
  // R2 原生不视为"外部图床"，不禁用媒体库上传
  const s3Enabled = !!ih?.s3?.articleEnabled;
  const apiKeyEnabled = !!ih?.apiProviders?.some((p) => p.articleEnabled);

  return { enabled: s3Enabled || apiKeyEnabled };
}
