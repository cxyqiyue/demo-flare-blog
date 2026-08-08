import * as ConfigService from "@/features/config/service/config.service";
import type { SystemConfig } from "@/features/config/config.schema";
import type {
  ArticleImageHostingConfig,
  CommentImageHostingConfig,
  ImageHostingProvider,
  TestImageHostingConnectionInput,
} from "@/features/image-hosting/image-hosting.schema";
import {
  DEFAULT_FFSKY_API_ENDPOINT,
  IMGBB_API_ENDPOINT,
  TEST_IMAGE_BASE64,
} from "@/features/image-hosting/image-hosting.schema";
import {
  uploadToS3,
  type S3UploadConfig,
} from "@/features/image-hosting/s3/s3-upload";
import { parseUploadMediaInput } from "@/features/media/media.schema";
import { getImageDimensions } from "@/features/media/utils/image-dimensions";
import { err, ok, type Result } from "@/lib/errors";
import { m } from "@/paraglide/messages";

const ARTICLE_PROVIDER_ORDER: Array<ImageHostingProvider> = ["imgbb", "ffsky"];

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

interface ProviderRuntimeConfig {
  enabled: boolean;
  apiKey: string;
  apiEndpoint: string;
  fieldName: "image" | "source";
}

interface S3RuntimeConfig {
  enabled: boolean;
  config: S3UploadConfig;
}

function resolveProviderRuntimeConfig(
  config: SystemConfig | undefined,
  provider: ImageHostingProvider,
): ProviderRuntimeConfig {
  if (provider === "imgbb") {
    const providerConfig = config?.imageHosting?.imgbb;
    return {
      enabled: !!providerConfig?.articleEnabled,
      apiKey: providerConfig?.apiKey?.trim() ?? "",
      apiEndpoint: IMGBB_API_ENDPOINT,
      fieldName: "image",
    };
  }

  const providerConfig = config?.imageHosting?.ffsky;
  return {
    enabled: !!providerConfig?.articleEnabled,
    apiKey: providerConfig?.apiKey?.trim() ?? "",
    apiEndpoint:
      providerConfig?.apiEndpoint?.trim() || DEFAULT_FFSKY_API_ENDPOINT,
    fieldName: "source",
  };
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
    enabled:
      pathway === "article" ? !!s3.articleEnabled : !!s3.commentEnabled,
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
  Result<{ url: string }, { reason: "PROVIDER_REQUEST_FAILED"; message: string }>
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
  Result<{ url: string }, { reason: "PROVIDER_REQUEST_FAILED"; message: string }>
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

export type ArticleUploadResult =
  | {
      mode: "image-hosting";
      provider: ImageHostingProvider;
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

  // S3 兼容存储优先（配置了 s3 文章通道则使用，不再尝试第三方图床）
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

  // 第三方图床已启用时，R2 不作为回退目标：逐个尝试已启用且配了 key 的
  // 图床，仅当全部失败才返回错误；只有「未启用或未配置 key」才回退到 R2。
  let lastProviderError: { message: string } | null = null;
  for (const provider of ARTICLE_PROVIDER_ORDER) {
    const runtime = resolveProviderRuntimeConfig(config, provider);
    if (!runtime.enabled || !runtime.apiKey) continue;

    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const result = await uploadToEndpoint(
      runtime.apiEndpoint,
      runtime.apiKey,
      base64,
      runtime.fieldName,
    );

    if (result.error) {
      lastProviderError = result.error;
      continue;
    }

    const dimensions = getImageDimensions(await file.arrayBuffer());
    return ok({
      mode: "image-hosting",
      provider,
      url: result.data.url,
      width: dimensions?.width,
      height: dimensions?.height,
    });
  }

  if (lastProviderError) {
    return err({
      reason: "IMAGE_HOSTING_UPLOAD_FAILED",
      message: lastProviderError.message,
    });
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

  const imgbb = config?.imageHosting?.imgbb;
  if (imgbb?.commentEnabled && imgbb.apiKey?.trim()) {
    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const result = await uploadToEndpoint(
      IMGBB_API_ENDPOINT,
      imgbb.apiKey.trim(),
      base64,
      "image",
    );
    if (result.error) {
      return err({
        reason: "COMMENT_IMAGE_UPLOAD_FAILED",
        message: result.error.message,
      });
    }
    return ok({ url: result.data.url });
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
  if (input.provider === "s3") {
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

  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) {
    return err({
      reason: "IMAGE_HOSTING_TEST_FAILED",
      message: m.settings_image_hosting_test_missing_key(),
    });
  }

  const apiEndpoint =
    input.provider === "imgbb"
      ? IMGBB_API_ENDPOINT
      : input.apiEndpoint?.trim() || DEFAULT_FFSKY_API_ENDPOINT;
  const fieldName = input.provider === "imgbb" ? "image" : "source";

  const result = await uploadToEndpoint(
    apiEndpoint,
    apiKey,
    TEST_IMAGE_BASE64,
    fieldName,
  );
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

  if (config?.imageHosting?.s3?.commentEnabled) {
    return { enabled: true, provider: "s3" };
  }

  if (config?.imageHosting?.imgbb?.commentEnabled) {
    return { enabled: true, provider: "imgbb" };
  }

  return { enabled: false, provider: null };
}

export async function getArticleImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<ArticleImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);

  const enabled =
    !!config?.imageHosting?.imgbb?.articleEnabled ||
    !!config?.imageHosting?.ffsky?.articleEnabled ||
    !!config?.imageHosting?.s3?.articleEnabled;

  return { enabled };
}
