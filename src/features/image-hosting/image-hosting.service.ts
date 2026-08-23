import type { SystemConfig } from "@/features/config/config.schema";
import * as ConfigService from "@/features/config/service/config.service";
import type {
  ActiveImageHostingProvider,
  ApiKeyProviderType,
  ArticleImageHostingConfig,
  CommentImageHostingConfig,
  DiscordChannel,
  HuggingFaceChannel,
  ImageHostingProviderLabel,
  TelegramChannel,
  TestImageHostingConnectionInput,
  WebDAVChannel,
} from "@/features/image-hosting/image-hosting.schema";
import {
  DEFAULT_FFSKY_API_ENDPOINT,
  IMGBB_API_ENDPOINT,
  TEST_IMAGE_BASE64,
} from "@/features/image-hosting/image-hosting.schema";
import {
  type S3UploadConfig,
  resolveValidatedS3Config,
  uploadToS3,
} from "@/features/image-hosting/s3/s3-upload";
import {
  resolveDiscordMaxBytes,
  resolveFfskyMaxBytes,
  resolveHuggingFaceMaxBytes,
  resolveImgbbMaxBytes,
  resolveR2NativeMaxBytes,
  resolveS3MaxBytes,
  resolveTelegramMaxBytes,
  resolveWebDavMaxBytes,
  R2_NATIVE_MAX_MB,
} from "@/features/image-hosting/size-limits";
import * as TelegramChannelApi from "@/features/image-hosting/channels/telegram";
import * as DiscordChannelApi from "@/features/image-hosting/channels/discord";
import * as HuggingFaceChannelApi from "@/features/image-hosting/channels/huggingface";
import * as WebDavChannelApi from "@/features/image-hosting/channels/webdav";
import {
  MAX_FILE_SIZE,
  parseUploadMediaInput,
} from "@/features/media/media.schema";
import * as MediaRepo from "@/features/media/data/media.data";
import * as MediaStorage from "@/features/media/data/media.storage";
import { getImageDimensions } from "@/features/media/utils/image-dimensions";
import {
  buildMediaAccessUrl,
  getLinkAccessSettings,
} from "@/features/media/service/link-access.service";
import { enforceImageModeration } from "@/features/image-hosting/moderation/moderation.service";
import { err, ok, type Result } from "@/lib/errors";
import { getDb } from "@/lib/db";
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
  const resolved = resolveValidatedS3Config(config?.imageHosting?.s3);
  if (!resolved) return null;

  const s3 = config?.imageHosting?.s3;
  const hasEnabledFlag =
    pathway === "article" ? !!s3?.articleEnabled : !!s3?.commentEnabled;

  return {
    enabled: hasEnabledFlag,
    config: resolved,
  };
}

function resolveS3Config(
  config: SystemConfig | undefined,
): S3RuntimeConfig | null {
  const resolved = resolveValidatedS3Config(config?.imageHosting?.s3);
  if (!resolved) return null;
  return { enabled: true, config: resolved };
}

function extensionFromMime(mime: string): string {
  return MIME_EXTENSIONS[mime] ?? "png";
}

function resolveR2PathPrefix(
  config: SystemConfig | undefined,
  pathway: "article" | "comment",
): string {
  const base = config?.imageHosting?.r2Native?.pathPrefix?.trim() || "images/blog";
  return pathway === "article" ? `${base}/articles` : `${base}/comments`;
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
    { url: string; key: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const key = buildObjectKey(config.pathPrefix, extensionFromMime(file.type));
  const result = await uploadToS3(config, {
    key,
    body: await file.arrayBuffer(),
    contentType: file.type || "application/octet-stream",
  });
  if (result.error) return result;
  return ok({ url: result.data.url, key });
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

/**
 * API-Key 图床（imgbb/ffsky）没有可管理的远端对象，仅生成一个稳定的
 * 索引键用于 D1 媒体库展示。
 */
function buildApiKeyTrackingKey(
  providerType: string,
  ext: string,
): string {
  const ts = Date.now();
  let uuid = "";
  try {
    uuid = crypto.randomUUID();
  } catch {
    uuid = `${ts.toString(36)}_${Math.random().toString(36).slice(2)}`;
  }
  return `api-key/${providerType}/${ts}-${uuid}.${ext}`;
}

// ── Telegram 上传 ──────────────────────────────────────────────

/**
 * Upload via the shared Telegram channel client. The returned key
 * `telegram/{messageId}:{fileId}` carries both durable handles — the
 * message id is used for remote deletion, the file id for proxy serving.
 */
async function uploadToTelegram(
  config: TelegramChannel,
  file: File,
): Promise<
  Result<
    { url: string; key: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const result = await TelegramChannelApi.uploadToTelegramChannel(config, file);
  if (result.error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: result.error.message,
    });
  }
  return ok({
    url: result.data.url,
    key: `telegram/${result.data.messageId}:${result.data.fileId}`,
  });
}

// ── Discord 上传 ───────────────────────────────────────────────

/**
 * Upload via the shared Discord channel client. The bare messageId is the
 * key — attachment URLs rotate (~24h signed URLs), message ids do not.
 */
async function uploadToDiscord(
  config: DiscordChannel,
  file: File,
): Promise<
  Result<
    { url: string; key: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const result = await DiscordChannelApi.uploadToDiscordChannel(config, file);
  if (result.error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: result.error.message,
    });
  }
  return ok({ url: result.data.url, key: result.data.messageId });
}

// ── HuggingFace 上传 ───────────────────────────────────────────

/**
 * Upload via the shared HuggingFace datasets client into the
 * `image-hosting/` folder. The real repo path is the key.
 */
async function uploadToHuggingFace(
  config: HuggingFaceChannel,
  file: File,
): Promise<
  Result<
    { url: string; key: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const result = await HuggingFaceChannelApi.uploadToHuggingFaceChannel(
    config,
    file,
    "image-hosting",
  );
  if (result.error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: result.error.message,
    });
  }
  return ok({ url: result.data.url, key: result.data.key });
}

// ── WebDAV 上传 ────────────────────────────────────────────────

/**
 * Upload via the shared WebDAV client into the `image-hosting/` folder.
 * The real server path is the key.
 */
async function uploadToWebDAV(
  config: WebDAVChannel,
  file: File,
): Promise<
  Result<
    { url: string; key: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const result = await WebDavChannelApi.uploadToWebDavChannel(
    config,
    file,
    "image-hosting",
  );
  if (result.error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: result.error.message,
    });
  }
  return ok({ url: result.data.url, key: result.data.key });
}

// ── 通用上传路由 ───────────────────────────────────────────────

type ProviderUploadResult = Result<
  { url: string; key: string },
  | { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  | { reason: "FILE_TOO_LARGE"; message: string }
>;

function fileSizeTooLargeError(limitBytes: number): {
  reason: "FILE_TOO_LARGE";
  message: string;
} {
  const limitMb = limitBytes / (1024 * 1024);
  const limitText = Number.isInteger(limitMb) ? String(limitMb) : limitMb.toFixed(1);
  return {
    reason: "FILE_TOO_LARGE",
    message: m.image_hosting_file_too_large({ limit: limitText }),
  };
}

async function uploadToActiveProvider(
  provider: ActiveImageHostingProvider,
  config: SystemConfig | undefined,
  file: File,
  context: DbContext & { executionCtx: ExecutionContext },
  pathway: "article" | "comment",
): Promise<ProviderUploadResult | null> {
  const ih = config?.imageHosting;

  switch (provider) {
    case "s3": {
      const s3Config = resolveS3Config(config);
      if (s3Config) {
        const limit = resolveS3MaxBytes(ih?.s3);
        if (limit !== null && file.size > limit) {
          return err(fileSizeTooLargeError(limit));
        }
        return uploadToS3ForFile(s3Config.config, file);
      }
      return null;
    }

    case "api-key": {
      const apiProviders = ih?.apiProviders ?? [];
      let sizeRejected = false;
      for (const p of apiProviders) {
        if (!p.apiKey?.trim()) continue;

        const apiKeyLimit =
          p.type === "imgbb"
            ? resolveImgbbMaxBytes()
            : resolveFfskyMaxBytes();
        if (apiKeyLimit !== null && file.size > apiKeyLimit) {
          sizeRejected = true;
          continue;
        }

        const { fieldName, defaultEndpoint } = getApiKeyProviderFieldInfo(p.type);
        const endpoint =
          p.type === "ffsky"
            ? (p.apiEndpoint?.trim() || defaultEndpoint)
            : defaultEndpoint;

        const base64 = arrayBufferToBase64(await file.arrayBuffer());
        const result = await uploadToEndpoint(endpoint, p.apiKey.trim(), base64, fieldName);
        if (result.error) continue;
        return ok({
          url: result.data.url,
          key: buildApiKeyTrackingKey(p.type, extensionFromMime(file.type)),
        });
      }
      if (sizeRejected) {
        const limit = resolveImgbbMaxBytes();
        if (limit !== null) {
          return err(fileSizeTooLargeError(limit));
        }
      }
      return null;
    }

    case "r2-native": {
      const r2Enabled =
        pathway === "article"
          ? ih?.r2Native?.articleEnabled
          : ih?.r2Native?.commentEnabled;
      if (r2Enabled) {
        const r2Limit = resolveR2NativeMaxBytes();
        if (r2Limit !== null && file.size > r2Limit) {
          return err(fileSizeTooLargeError(r2Limit));
        }
        const ext = extensionFromMime(file.type);
        const folder = resolveR2PathPrefix(config, pathway);
        const key = buildObjectKey(folder, ext);
        try {
          await MediaStorage.putToR2(context.env, file, key);
          return ok({ url: `/images/${key}`, key });
        } catch (error) {
          return err({
            reason: "PROVIDER_REQUEST_FAILED",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return null;
    }

    case "telegram": {
      if (ih?.telegram?.botToken && ih?.telegram?.chatId) {
        const limit = resolveTelegramMaxBytes(ih.telegram);
        if (limit !== null && file.size > limit) {
          return err(fileSizeTooLargeError(limit));
        }
        return uploadToTelegram(ih.telegram, file);
      }
      return null;
    }

    case "discord": {
      if (ih?.discord?.botToken && ih?.discord?.channelId) {
        const limit = resolveDiscordMaxBytes(ih.discord);
        if (limit !== null && file.size > limit) {
          return err(fileSizeTooLargeError(limit));
        }
        return uploadToDiscord(ih.discord, file);
      }
      return null;
    }

    case "huggingface": {
      if (ih?.huggingface?.token && ih?.huggingface?.repo) {
        const limit = resolveHuggingFaceMaxBytes(ih.huggingface);
        if (limit !== null && file.size > limit) {
          return err(fileSizeTooLargeError(limit));
        }
        return uploadToHuggingFace(ih.huggingface, file);
      }
      return null;
    }

    case "webdav": {
      if (ih?.webdav?.baseUrl) {
        const limit = resolveWebDavMaxBytes(ih.webdav);
        if (limit !== null && file.size > limit) {
          return err(fileSizeTooLargeError(limit));
        }
        return uploadToWebDAV(ih.webdav, file);
      }
      return null;
    }

    default:
      return null;
  }
}

function getProviderLabel(
  provider: ActiveImageHostingProvider,
  apiProviderType?: string,
): ImageHostingProviderLabel {
  if (provider === "api-key" && apiProviderType) {
    return apiProviderType as ImageHostingProviderLabel;
  }
  return provider as ImageHostingProviderLabel;
}

async function trackMediaUpload(
  db: DB,
  data: {
    provider: string;
    key: string;
    url: string;
    fileName: string;
    mimeType: string;
    sizeInBytes: number;
    width?: number | null;
    height?: number | null;
  },
) {
  try {
    await MediaRepo.insertMedia(db, {
      provider: data.provider,
      key: data.key,
      url: data.url,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeInBytes: data.sizeInBytes,
      width: data.width ?? null,
      height: data.height ?? null,
    });
  } catch {
    // D1 insert failure should not block the upload result
  }
}

// ── 文章上传 ───────────────────────────────────────────────────

/**
 * 将 Hono 上下文适配为服务层依赖（db + env + executionCtx），
 * 供 /api/image-hosting/upload 等直接挂载的 Hono 路由复用服务层函数。
 */
export function resolveImageHostingRequestContext(
  c: { env: Env; executionCtx: ExecutionContext },
): DbContext & { executionCtx: ExecutionContext } {
  return {
    db: getDb(c.env),
    env: c.env,
    executionCtx: c.executionCtx,
  };
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

export interface UploadPathwayOptions {
  /** 站点来源（Hono 路由传入），用于审查服务访问相对路径图片 */
  origin?: string;
}

export async function uploadForArticle(
  context: DbContext & { executionCtx: ExecutionContext },
  formData: FormData,
  options?: UploadPathwayOptions,
): Promise<
  Result<
    ArticleUploadResult,
    { reason: "IMAGE_HOSTING_UPLOAD_FAILED"; message: string }
  >
> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;
  const activeProvider = ih?.activeProvider ?? null;
  // 服务端大小校验与渠道上限对齐（客户端压缩策略同样按渠道上限判断）
  const policy = await getArticleImageHostingConfig(context);
  const articleLimitBytes = policy.maxImageBytes ?? R2_NATIVE_MAX_MB * 1024 * 1024;
  const { file } = parseUploadMediaInput(formData, m, {
    maxSizeBytes: articleLimitBytes,
  });

  const getImageDimensionsResult = async () => {
    const buf = await file.arrayBuffer();
    return getImageDimensions(buf);
  };

  // 统一完成路径：审查 → 远端记录 → 计算对外图链（防盗链模式）
  const finish = async (
    providerLabel: ImageHostingProviderLabel,
    uploaded: { url: string; key: string },
  ): Promise<Result<ArticleUploadResult, { reason: "IMAGE_HOSTING_UPLOAD_FAILED"; message: string }>> => {
    const moderation = await enforceImageModeration(context, {
      url: uploaded.url,
      file,
      origin: options?.origin,
      providerLabel,
      key: uploaded.key,
    });
    if (moderation.error) {
      return err({
        reason: "IMAGE_HOSTING_UPLOAD_FAILED",
        message: moderation.error.message,
      });
    }

    const dimensions = await getImageDimensionsResult();

    await trackMediaUpload(context.db, {
      provider: providerLabel,
      key: uploaded.key,
      url: uploaded.url,
      fileName: file.name,
      mimeType: file.type,
      sizeInBytes: file.size,
      width: dimensions?.width,
      height: dimensions?.height,
    });

    const accessUrl = buildMediaAccessUrl(
      getLinkAccessSettings(config),
      providerLabel,
      uploaded.key,
      uploaded.url,
    );

    return ok({
      mode: "image-hosting",
      provider: providerLabel,
      url: accessUrl,
      width: dimensions?.width,
      height: dimensions?.height,
    });
  };

  if (activeProvider !== null) {
    const result = await uploadToActiveProvider(
      activeProvider,
      config,
      file,
      context,
      "article",
    );
    if (result === null) {
      return ok({ mode: "none" });
    }
    if (result.error) {
      return err({
        reason: "IMAGE_HOSTING_UPLOAD_FAILED",
        message: result.error.message,
      });
    }
    return finish(getProviderLabel(activeProvider), result.data);
  }

  // ── 旧版兼容：按优先级链 ──

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
    return finish("s3", result.data);
  }

  // ── 2. API Key 图床（第三方优先） ──
  const apiProviders = ih?.apiProviders ?? [];
  let lastError: { message: string } | null = null;

  for (const p of apiProviders) {
    if (!p.apiKey?.trim()) continue;

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

    return finish(p.type, {
      url: result.data.url,
      key: buildApiKeyTrackingKey(p.type, extensionFromMime(file.type)),
    });
  }

  if (lastError) {
    return err({
      reason: "IMAGE_HOSTING_UPLOAD_FAILED",
      message: lastError.message,
    });
  }

  // ── 3. Telegram ──
  if (ih?.telegram?.botToken && ih?.telegram?.chatId) {
    const result = await uploadToTelegram(ih.telegram, file);
    if (!result.error) {
      return finish("telegram", result.data);
    }
  }

  // ── 4. Discord ──
  if (ih?.discord?.botToken && ih?.discord?.channelId) {
    const result = await uploadToDiscord(ih.discord, file);
    if (!result.error) {
      return finish("discord", result.data);
    }
  }

  // ── 5. HuggingFace ──
  if (ih?.huggingface?.token && ih?.huggingface?.repo) {
    const result = await uploadToHuggingFace(ih.huggingface, file);
    if (!result.error) {
      return finish("huggingface", result.data);
    }
  }

  // ── 6. WebDAV ──
  if (ih?.webdav?.baseUrl) {
    const result = await uploadToWebDAV(ih.webdav, file);
    if (!result.error) {
      return finish("webdav", result.data);
    }
  }

  // ── 7. R2 原生（兜底） ──
  if (ih?.r2Native?.articleEnabled) {
    const ext = extensionFromMime(file.type);
    const folder = resolveR2PathPrefix(config, "article");
    const key = buildObjectKey(folder, ext);
    try {
      await MediaStorage.putToR2(context.env, file, key);
      return await finish("r2-native", { url: `/images/${key}`, key });
    } catch (error) {
      return err({
        reason: "IMAGE_HOSTING_UPLOAD_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return ok({ mode: "none" });
}

// ── 评论上传 ───────────────────────────────────────────────────

export async function uploadCommentImage(
  context: DbContext & { executionCtx: ExecutionContext },
  formData: FormData,
  options?: UploadPathwayOptions,
): Promise<
  Result<
    { url: string },
    { reason: "COMMENT_IMAGE_UPLOAD_FAILED"; message: string }
  >
> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;
  const activeProvider = ih?.activeProvider ?? null;
  // 服务端大小校验与渠道上限对齐
  const commentPolicy = await getCommentImageHostingConfig(context);
  const commentLimitBytes = commentPolicy.maxImageBytes ?? R2_NATIVE_MAX_MB * 1024 * 1024;
  const { file } = parseUploadMediaInput(formData, m, {
    maxSizeBytes: commentLimitBytes,
  });

  // 统一完成路径：审查 → 远端记录 → 计算对外图链（防盗链模式）
  const finish = async (
    providerLabel: ImageHostingProviderLabel,
    uploaded: { url: string; key: string },
  ): Promise<Result<{ url: string }, { reason: "COMMENT_IMAGE_UPLOAD_FAILED"; message: string }>> => {
    const moderation = await enforceImageModeration(context, {
      url: uploaded.url,
      file,
      origin: options?.origin,
      providerLabel,
      key: uploaded.key,
    });
    if (moderation.error) {
      return err({
        reason: "COMMENT_IMAGE_UPLOAD_FAILED",
        message: moderation.error.message,
      });
    }

    await trackMediaUpload(context.db, {
      provider: providerLabel,
      key: uploaded.key,
      url: uploaded.url,
      fileName: file.name,
      mimeType: file.type,
      sizeInBytes: file.size,
    });

    return ok({
      url: buildMediaAccessUrl(
        getLinkAccessSettings(config),
        providerLabel,
        uploaded.key,
        uploaded.url,
      ),
    });
  };

  if (activeProvider !== null) {
    const result = await uploadToActiveProvider(
      activeProvider,
      config,
      file,
      context,
      "comment",
    );
    if (result === null) {
      return err({
        reason: "COMMENT_IMAGE_UPLOAD_FAILED",
        message: m.settings_image_hosting_comment_not_configured(),
      });
    }
    if (result.error) {
      return err({
        reason: "COMMENT_IMAGE_UPLOAD_FAILED",
        message: result.error.message,
      });
    }

    return finish(getProviderLabel(activeProvider), result.data);
  }

  // ── 旧版兼容：按优先级链 ──

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
    return finish("s3", result.data);
  }

  // ── 2. API Key 图床（第三方优先） ──
  const apiProviders = ih?.apiProviders ?? [];
  for (const p of apiProviders) {
    if (!p.apiKey?.trim()) continue;

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

    return finish(p.type, {
      url: result.data.url,
      key: buildApiKeyTrackingKey(p.type, extensionFromMime(file.type)),
    });
  }

  // ── 3. Telegram ──
  if (ih?.telegram?.botToken && ih?.telegram?.chatId) {
    const result = await uploadToTelegram(ih.telegram, file);
    if (!result.error) {
      return finish("telegram", result.data);
    }
  }

  // ── 4. Discord ──
  if (ih?.discord?.botToken && ih?.discord?.channelId) {
    const result = await uploadToDiscord(ih.discord, file);
    if (!result.error) {
      return finish("discord", result.data);
    }
  }

  // ── 5. HuggingFace ──
  if (ih?.huggingface?.token && ih?.huggingface?.repo) {
    const result = await uploadToHuggingFace(ih.huggingface, file);
    if (!result.error) {
      return finish("huggingface", result.data);
    }
  }

  // ── 6. WebDAV ──
  if (ih?.webdav?.baseUrl) {
    const result = await uploadToWebDAV(ih.webdav, file);
    if (!result.error) {
      return finish("webdav", result.data);
    }
  }

  // ── 7. R2 原生（兜底） ──
  if (ih?.r2Native?.commentEnabled) {
    const ext = extensionFromMime(file.type);
    const folder = resolveR2PathPrefix(config, "comment");
    const key = buildObjectKey(folder, ext);
    try {
      await MediaStorage.putToR2(context.env, file, key);
      return await finish("r2-native", { url: `/images/${key}`, key });
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

// ── 测试连接 ───────────────────────────────────────────────────

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
        pathStyle: s3.pathStyle ?? false,
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

  if (input.category === "api-key") {
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

  if (input.category === "telegram") {
    const telegram = input.telegram;
    if (!telegram) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: "Telegram configuration is required",
      });
    }

    const botToken = telegram.botToken?.trim() ?? "";
    const chatId = telegram.chatId?.trim() ?? "";
    if (!botToken || !chatId) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: "Telegram bot token and chat ID are required",
      });
    }

    const testFile = base64ToFile(TEST_IMAGE_BASE64, "test.png", "image/png");
    const result = await uploadToTelegram(telegram, testFile);
    if (result.error) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: result.error.message,
      });
    }

    return ok({ success: true, url: result.data.url });
  }

  if (input.category === "discord") {
    const discord = input.discord;
    if (!discord) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: "Discord configuration is required",
      });
    }

    const botToken = discord.botToken?.trim() ?? "";
    const channelId = discord.channelId?.trim() ?? "";
    if (!botToken || !channelId) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: "Discord bot token and channel ID are required",
      });
    }

    const testFile = base64ToFile(TEST_IMAGE_BASE64, "test.png", "image/png");
    const result = await uploadToDiscord(discord, testFile);
    if (result.error) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: result.error.message,
      });
    }

    return ok({ success: true, url: result.data.url });
  }

  if (input.category === "huggingface") {
    const hf = input.huggingface;
    if (!hf) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: "HuggingFace configuration is required",
      });
    }

    const token = hf.token?.trim() ?? "";
    const repo = hf.repo?.trim() ?? "";
    if (!token || !repo) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: "HuggingFace token and repo are required",
      });
    }

    const testFile = base64ToFile(TEST_IMAGE_BASE64, "test.png", "image/png");
    const result = await uploadToHuggingFace(hf, testFile);
    if (result.error) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: result.error.message,
      });
    }

    return ok({ success: true, url: result.data.url });
  }

  if (input.category === "webdav") {
    const webdav = input.webdav;
    if (!webdav) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: "WebDAV configuration is required",
      });
    }

    const baseUrl = webdav.baseUrl?.trim() ?? "";
    if (!baseUrl) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: "WebDAV base URL is required",
      });
    }

    const testFile = base64ToFile(TEST_IMAGE_BASE64, "test.png", "image/png");
    const result = await uploadToWebDAV(webdav, testFile);
    if (result.error) {
      return err({
        reason: "IMAGE_HOSTING_TEST_FAILED",
        message: result.error.message,
      });
    }

    return ok({ success: true, url: result.data.url });
  }

  return err({
    reason: "IMAGE_HOSTING_TEST_FAILED",
    message: `Unknown category: ${input.category}`,
  });
}

function base64ToFile(base64: string, fileName: string, mimeType: string): File {
  const buffer = base64ToArrayBuffer(base64);
  return new File([buffer], fileName, { type: mimeType });
}

// ── 配置查询 ───────────────────────────────────────────────────

function isChannelConfigured(channel: Record<string, unknown>): boolean {
  return Object.values(channel).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function resolveImageProcessingSettings(ih: SystemConfig["imageHosting"]) {
  // 编辑器自定义压缩：阈值（超过才压缩）与目标大小，单位 MB → 字节
  const thresholdMb = ih?.imageProcessing?.compressThresholdMb;
  const targetMb = ih?.imageProcessing?.compressTargetMb;
  return {
    compressEnabled: ih?.imageProcessing?.compressEnabled ?? true,
    convertToFormat: ih?.imageProcessing?.convertToFormat ?? ("none" as const),
    compressThresholdBytes:
      typeof thresholdMb === "number"
        ? Math.round(thresholdMb * 1024 * 1024)
        : null,
    compressTargetBytes:
      typeof targetMb === "number" ? Math.round(targetMb * 1024 * 1024) : null,
  };
}

function resolveApiKeyProviderLimitBytes(
  type: ApiKeyProviderType,
): number | null {
  return type === "imgbb" ? resolveImgbbMaxBytes() : resolveFfskyMaxBytes();
}

export async function getCommentImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<CommentImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;
  const processing = resolveImageProcessingSettings(ih);

  if (ih?.activeProvider !== null && ih?.activeProvider !== undefined) {
    const provider = ih.activeProvider;
    if (provider === "r2-native" && ih.r2Native?.commentEnabled) {
      return {
        enabled: true,
        providerCategory: "r2-native",
        maxImageBytes: resolveR2NativeMaxBytes(),
        ...processing,
      };
    }
    if (provider === "s3" && ih.s3?.commentEnabled) {
      return {
        enabled: true,
        providerCategory: "s3",
        maxImageBytes: resolveS3MaxBytes(ih.s3),
        ...processing,
      };
    }
    if (provider === "api-key") {
      const activeApiProvider = ih.apiProviders?.find((p) => p.commentEnabled);
      if (activeApiProvider) {
        return {
          enabled: true,
          providerCategory: "api-key",
          providerType: activeApiProvider.type,
          maxImageBytes: resolveApiKeyProviderLimitBytes(activeApiProvider.type),
          ...processing,
        };
      }
    }
    if (provider === "telegram" && isChannelConfigured(ih.telegram ?? {})) {
      return {
        enabled: true,
        providerCategory: "telegram",
        maxImageBytes: resolveTelegramMaxBytes(ih.telegram),
        ...processing,
      };
    }
    if (provider === "discord" && isChannelConfigured(ih.discord ?? {})) {
      return {
        enabled: true,
        providerCategory: "discord",
        maxImageBytes: resolveDiscordMaxBytes(ih.discord),
        ...processing,
      };
    }
    if (provider === "huggingface" && isChannelConfigured(ih.huggingface ?? {})) {
      return {
        enabled: true,
        providerCategory: "huggingface",
        maxImageBytes: resolveHuggingFaceMaxBytes(ih.huggingface),
        ...processing,
      };
    }
    if (provider === "webdav" && isChannelConfigured(ih.webdav ?? {})) {
      return {
        enabled: true,
        providerCategory: "webdav",
        maxImageBytes: resolveWebDavMaxBytes(ih.webdav),
        ...processing,
      };
    }
    return {
      enabled: false,
      providerCategory: null,
      maxImageBytes: null,
      ...processing,
    };
  }

  // ── 旧版兼容：按优先级链检查 ──
  // 镜像 uploadCommentImage 的真实回退顺序：S3 → API-Key → Telegram →
  // Discord → HuggingFace → WebDAV → R2 原生（兜底）。
  if (ih?.s3?.commentEnabled) {
    return {
      enabled: true,
      providerCategory: "s3",
      maxImageBytes: resolveS3MaxBytes(ih.s3),
      ...processing,
    };
  }

  const activeApiProvider = ih?.apiProviders?.find((p) => p.commentEnabled);
  if (activeApiProvider) {
    return {
      enabled: true,
      providerCategory: "api-key",
      providerType: activeApiProvider.type,
      maxImageBytes: resolveApiKeyProviderLimitBytes(activeApiProvider.type),
      ...processing,
    };
  }

  if (ih?.telegram && isChannelConfigured(ih.telegram)) {
    return {
      enabled: true,
      providerCategory: "telegram",
      maxImageBytes: resolveTelegramMaxBytes(ih.telegram),
      ...processing,
    };
  }

  if (ih?.discord && isChannelConfigured(ih.discord)) {
    return {
      enabled: true,
      providerCategory: "discord",
      maxImageBytes: resolveDiscordMaxBytes(ih.discord),
      ...processing,
    };
  }

  if (ih?.huggingface && isChannelConfigured(ih.huggingface)) {
    return {
      enabled: true,
      providerCategory: "huggingface",
      maxImageBytes: resolveHuggingFaceMaxBytes(ih.huggingface),
      ...processing,
    };
  }

  if (ih?.webdav && isChannelConfigured(ih.webdav)) {
    return {
      enabled: true,
      providerCategory: "webdav",
      maxImageBytes: resolveWebDavMaxBytes(ih.webdav),
      ...processing,
    };
  }

  if (ih?.r2Native?.commentEnabled) {
    return {
      enabled: true,
      providerCategory: "r2-native",
      maxImageBytes: resolveR2NativeMaxBytes(),
      ...processing,
    };
  }

  return {
    enabled: false,
    providerCategory: null,
    maxImageBytes: null,
    ...processing,
  };
}

export async function getArticleImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<ArticleImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;
  const processing = resolveImageProcessingSettings(ih);

  // 图床未启用时，编辑器回退到媒体库 R2 路径（10MB / 仅图片）。
  const disabledResult: ArticleImageHostingConfig = {
    enabled: false,
    maxImageBytes: MAX_FILE_SIZE,
    ...processing,
  };

  const activeProvider = ih?.activeProvider ?? null;

  if (activeProvider !== null) {
    switch (activeProvider) {
      case "s3":
        return {
          enabled: !!ih?.s3?.articleEnabled,
          maxImageBytes: ih?.s3?.articleEnabled
            ? resolveS3MaxBytes(ih.s3)
            : MAX_FILE_SIZE,
          ...processing,
        };
      case "api-key": {
        const articleApiProvider = ih?.apiProviders?.find(
          (p) => p.articleEnabled,
        );
        return {
          enabled: !!articleApiProvider,
          maxImageBytes: articleApiProvider
            ? resolveApiKeyProviderLimitBytes(articleApiProvider.type)
            : MAX_FILE_SIZE,
          ...processing,
        };
      }
      case "r2-native":
        return {
          enabled: !!ih?.r2Native?.articleEnabled,
          maxImageBytes: ih?.r2Native?.articleEnabled
            ? resolveR2NativeMaxBytes()
            : MAX_FILE_SIZE,
          ...processing,
        };
      case "telegram":
        return {
          enabled: isChannelConfigured(ih?.telegram ?? {}),
          maxImageBytes: isChannelConfigured(ih?.telegram ?? {})
            ? resolveTelegramMaxBytes(ih?.telegram)
            : MAX_FILE_SIZE,
          ...processing,
        };
      case "discord":
        return {
          enabled: isChannelConfigured(ih?.discord ?? {}),
          maxImageBytes: isChannelConfigured(ih?.discord ?? {})
            ? resolveDiscordMaxBytes(ih?.discord)
            : MAX_FILE_SIZE,
          ...processing,
        };
      case "huggingface":
        return {
          enabled: isChannelConfigured(ih?.huggingface ?? {}),
          maxImageBytes: isChannelConfigured(ih?.huggingface ?? {})
            ? resolveHuggingFaceMaxBytes(ih?.huggingface)
            : MAX_FILE_SIZE,
          ...processing,
        };
      case "webdav":
        return {
          enabled: isChannelConfigured(ih?.webdav ?? {}),
          maxImageBytes: isChannelConfigured(ih?.webdav ?? {})
            ? resolveWebDavMaxBytes(ih?.webdav)
            : MAX_FILE_SIZE,
          ...processing,
        };
    }
  }

  // ── 旧版兼容 ──
  // 镜像 uploadForArticle 的真实回退顺序：S3 → API-Key → Telegram →
  // Discord → HuggingFace → WebDAV → R2 原生（兜底）。
  if (ih?.s3?.articleEnabled) {
    return {
      enabled: true,
      maxImageBytes: resolveS3MaxBytes(ih.s3),
      ...processing,
    };
  }

  const articleApiProvider = ih?.apiProviders?.find((p) => p.articleEnabled);
  if (articleApiProvider) {
    return {
      enabled: true,
      maxImageBytes: resolveApiKeyProviderLimitBytes(articleApiProvider.type),
      ...processing,
    };
  }

  if (isChannelConfigured(ih?.telegram ?? {})) {
    return {
      enabled: true,
      maxImageBytes: resolveTelegramMaxBytes(ih?.telegram),
      ...processing,
    };
  }

  if (isChannelConfigured(ih?.discord ?? {})) {
    return {
      enabled: true,
      maxImageBytes: resolveDiscordMaxBytes(ih?.discord),
      ...processing,
    };
  }

  if (isChannelConfigured(ih?.huggingface ?? {})) {
    return {
      enabled: true,
      maxImageBytes: resolveHuggingFaceMaxBytes(ih?.huggingface),
      ...processing,
    };
  }

  if (isChannelConfigured(ih?.webdav ?? {})) {
    return {
      enabled: true,
      maxImageBytes: resolveWebDavMaxBytes(ih?.webdav),
      ...processing,
    };
  }

  if (ih?.r2Native?.articleEnabled) {
    return {
      enabled: true,
      maxImageBytes: resolveR2NativeMaxBytes(),
      ...processing,
    };
  }

  return disabledResult;
}
