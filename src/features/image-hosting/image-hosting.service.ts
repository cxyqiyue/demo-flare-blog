import type { SystemConfig } from "@/features/config/config.schema";
import * as ConfigService from "@/features/config/service/config.service";
import type {
  ActiveImageHostingProvider,
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
      pathStyle: s3.pathStyle ?? false,
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

// ── Telegram 上传 ──────────────────────────────────────────────

async function uploadToTelegram(
  config: TelegramChannel,
  file: File,
): Promise<
  Result<
    { url: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const botToken = config.botToken?.trim();
  const chatId = config.chatId?.trim();
  if (!botToken || !chatId) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: "Telegram bot token and chat ID are required",
    });
  }

  try {
    const baseUrl = "https://api.telegram.org";
    const apiUrl = `${baseUrl}/bot${botToken}/sendPhoto`;

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("photo", file);

    const fetchOptions: RequestInit = { method: "POST", body: form };

    const response = await fetch(apiUrl, fetchOptions);
    const responseText = await response.text();

    let parsed: unknown = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    if (typeof parsed !== "object" || parsed === null || !(parsed as Record<string, unknown>).ok) {
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message: extractErrorMessage(parsed, responseText),
      });
    }

    const result = parsed as Record<string, unknown>;
    const msg = result.result as Record<string, unknown> | undefined;
    const photo = msg?.photo as Array<Record<string, unknown>> | undefined;
    const fileId =
      photo && photo.length > 0
        ? (photo[photo.length - 1].file_id as string)
        : undefined;

    if (!fileId) {
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message: "No file_id returned from Telegram",
      });
    }

    const getFileUrl = `${baseUrl}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
    const fileResp = await fetch(getFileUrl);
    const fileText = await fileResp.text();
    let fileParsed: unknown = null;
    try {
      fileParsed = fileText ? JSON.parse(fileText) : null;
    } catch {
      fileParsed = null;
    }

    if (typeof fileParsed !== "object" || fileParsed === null) {
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message: "Failed to get file info from Telegram",
      });
    }

    const fileResult = fileParsed as Record<string, unknown>;
    const fileInfo = fileResult.result as Record<string, unknown> | undefined;
    const filePath = fileInfo?.file_path as string | undefined;
    if (!filePath) {
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message: "No file_path returned from Telegram getFile",
      });
    }

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    return ok({ url: fileUrl });
  } catch (error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Discord 上传 ───────────────────────────────────────────────

async function uploadToDiscord(
  config: DiscordChannel,
  file: File,
): Promise<
  Result<
    { url: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const botToken = config.botToken?.trim();
  const channelId = config.channelId?.trim();
  if (!botToken || !channelId) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: "Discord bot token and channel ID are required",
    });
  }

  const MAX_SIZE = config.isNitro ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: `File exceeds Discord limit of ${config.isNitro ? "25" : "10"}MB`,
    });
  }

  try {
    const apiUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;

    const form = new FormData();
    form.append("files[0]", file, file.name || "image.png");

    const headers: Record<string, string> = {
      Authorization: `Bot ${botToken}`,
    };

    const fetchOptions: RequestInit = {
      method: "POST",
      headers,
      body: form,
    };

    const response = await fetch(apiUrl, fetchOptions);
    const responseText = await response.text();

    let parsed: unknown = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message: extractErrorMessage(parsed, responseText),
      });
    }

    const msg = parsed as Record<string, unknown>;
    const attachments = msg.attachments as
      | Array<Record<string, unknown>>
      | undefined;
    if (!attachments || attachments.length === 0) {
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message: "No attachments returned from Discord",
      });
    }

    const url = attachments[0].url as string;
    return ok({ url });
  } catch (error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── HuggingFace 上传 ───────────────────────────────────────────

async function uploadToHuggingFace(
  config: HuggingFaceChannel,
  file: File,
): Promise<
  Result<
    { url: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const token = config.token?.trim();
  const repo = config.repo?.trim();
  if (!token || !repo) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: "HuggingFace token and repo are required",
    });
  }

  try {
    const ext = extensionFromMime(file.type);
    const fileName = `image-hosting/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const apiUrl = `https://huggingface.co/api/repos/${config.isPrivate ? "private" : "model"}/${repo}/upload/main`;

    const body = await file.arrayBuffer();
    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body,
    });

    const responseText = await response.text();

    if (!response.ok) {
      let parsed: unknown = null;
      try {
        parsed = responseText ? JSON.parse(responseText) : null;
      } catch {
        parsed = null;
      }
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message: extractErrorMessage(parsed, responseText),
      });
    }

    const cdnUrl = `https://huggingface.co/${repo}/resolve/main/${fileName}`;
    return ok({ url: cdnUrl });
  } catch (error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── WebDAV 上传 ────────────────────────────────────────────────

async function uploadToWebDAV(
  config: WebDAVChannel,
  file: File,
): Promise<
  Result<
    { url: string },
    { reason: "PROVIDER_REQUEST_FAILED"; message: string }
  >
> {
  const baseUrl = config.baseUrl?.trim();
  if (!baseUrl) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: "WebDAV base URL is required",
    });
  }

  try {
    const ext = extensionFromMime(file.type);
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const base = baseUrl.replace(/\/+$/, "");
    const uploadDir = `${base}/image-hosting`;
    const uploadUrl = `${uploadDir}/${fileName}`;

    const headers: Record<string, string> = {};
    if (config.username) {
      const credentials = btoa(
        `${config.username}:${config.password || ""}`,
      );
      headers.Authorization = `Basic ${credentials}`;
    }

    if (config.createDirectory) {
      await fetch(uploadDir, {
        method: "MKCOL",
        headers,
      }).catch(() => {
        // Ignore errors if directory already exists
      });
    }

    const body = await file.arrayBuffer();
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": file.type || "application/octet-stream",
      },
      body,
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      const responseText = await response.text();
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message: `WebDAV upload failed with status ${response.status}: ${responseText.slice(0, 300)}`,
      });
    }

    const publicBase = config.publicUrl?.trim() || base;
    const publicUrl = `${publicBase.replace(/\/+$/, "")}/image-hosting/${fileName}`;
    return ok({ url: publicUrl });
  } catch (error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── 通用上传路由 ───────────────────────────────────────────────

type ProviderUploadResult = Result<
  { url: string },
  { reason: "PROVIDER_REQUEST_FAILED"; message: string }
>;

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
      const s3Runtime = resolveS3RuntimeConfig(config, pathway);
      if (s3Runtime?.enabled) {
        return uploadToS3ForFile(s3Runtime.config, file);
      }
      return null;
    }

    case "api-key": {
      const apiProviders = ih?.apiProviders ?? [];
      for (const p of apiProviders) {
        const enabled =
          pathway === "article" ? p.articleEnabled : p.commentEnabled;
        if (!enabled || !p.apiKey?.trim()) continue;

        const { fieldName, defaultEndpoint } = getApiKeyProviderFieldInfo(p.type);
        const endpoint =
          p.type === "ffsky"
            ? (p.apiEndpoint?.trim() || defaultEndpoint)
            : defaultEndpoint;

        const base64 = arrayBufferToBase64(await file.arrayBuffer());
        const result = await uploadToEndpoint(endpoint, p.apiKey.trim(), base64, fieldName);
        if (result.error) continue;
        return result;
      }
      return null;
    }

    case "r2-native": {
      const r2Enabled =
        pathway === "article"
          ? ih?.r2Native?.articleEnabled
          : ih?.r2Native?.commentEnabled;
      if (r2Enabled) {
        const ext = extensionFromMime(file.type);
        const key = buildObjectKey(pathway === "article" ? "articles" : "comments", ext);
        try {
          await MediaStorage.putToR2(context.env, file, key);
          return ok({ url: `/images/${key}` });
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
        return uploadToTelegram(ih.telegram, file);
      }
      return null;
    }

    case "discord": {
      if (ih?.discord?.botToken && ih?.discord?.channelId) {
        return uploadToDiscord(ih.discord, file);
      }
      return null;
    }

    case "huggingface": {
      if (ih?.huggingface?.token && ih?.huggingface?.repo) {
        return uploadToHuggingFace(ih.huggingface, file);
      }
      return null;
    }

    case "webdav": {
      if (ih?.webdav?.baseUrl) {
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

// ── 文章上传 ───────────────────────────────────────────────────

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
  const activeProvider = ih?.activeProvider ?? null;

  const getImageDimensionsResult = async () => {
    const buf = await file.arrayBuffer();
    return getImageDimensions(buf);
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
    const dimensions = await getImageDimensionsResult();
    return ok({
      mode: "image-hosting",
      provider: getProviderLabel(activeProvider),
      url: result.data.url,
      width: dimensions?.width,
      height: dimensions?.height,
    });
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
    const dimensions = await getImageDimensionsResult();
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

    const dimensions = await getImageDimensionsResult();
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
      const dimensions = await getImageDimensionsResult();
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

// ── 评论上传 ───────────────────────────────────────────────────

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
  const activeProvider = ih?.activeProvider ?? null;

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
    return ok({ url: result.data.url });
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
    (v) => typeof v === "string" && v.trim() !== "",
  );
}

export async function getCommentImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<CommentImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;

  if (ih?.activeProvider !== null && ih?.activeProvider !== undefined) {
    const provider = ih.activeProvider;
    if (provider === "r2-native" && ih.r2Native?.commentEnabled) {
      return { enabled: true, providerCategory: "r2-native" };
    }
    if (provider === "s3" && ih.s3?.commentEnabled) {
      return { enabled: true, providerCategory: "s3" };
    }
    if (provider === "api-key") {
      const activeApiProvider = ih.apiProviders?.find((p) => p.commentEnabled);
      if (activeApiProvider) {
        return {
          enabled: true,
          providerCategory: "api-key",
          providerType: activeApiProvider.type,
        };
      }
    }
    if (provider === "telegram" && isChannelConfigured(ih.telegram ?? {})) {
      return { enabled: true, providerCategory: "telegram" };
    }
    if (provider === "discord" && isChannelConfigured(ih.discord ?? {})) {
      return { enabled: true, providerCategory: "discord" };
    }
    if (provider === "huggingface" && isChannelConfigured(ih.huggingface ?? {})) {
      return { enabled: true, providerCategory: "huggingface" };
    }
    if (provider === "webdav" && isChannelConfigured(ih.webdav ?? {})) {
      return { enabled: true, providerCategory: "webdav" };
    }
    return { enabled: false, providerCategory: null };
  }

  // ── 旧版兼容：按优先级链检查 ──
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

  if (ih?.telegram && isChannelConfigured(ih.telegram)) {
    return { enabled: true, providerCategory: "telegram" };
  }

  if (ih?.discord && isChannelConfigured(ih.discord)) {
    return { enabled: true, providerCategory: "discord" };
  }

  if (ih?.huggingface && isChannelConfigured(ih.huggingface)) {
    return { enabled: true, providerCategory: "huggingface" };
  }

  if (ih?.webdav && isChannelConfigured(ih.webdav)) {
    return { enabled: true, providerCategory: "webdav" };
  }

  return { enabled: false, providerCategory: null };
}

export async function getArticleImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<ArticleImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;

  const activeProvider = ih?.activeProvider ?? null;

  if (activeProvider !== null) {
    switch (activeProvider) {
      case "s3":
        return { enabled: !!ih?.s3?.articleEnabled };
      case "api-key":
        return { enabled: !!ih?.apiProviders?.some((p) => p.articleEnabled) };
      case "r2-native":
        return { enabled: !!ih?.r2Native?.articleEnabled };
      case "telegram":
        return { enabled: isChannelConfigured(ih?.telegram ?? {}) };
      case "discord":
        return { enabled: isChannelConfigured(ih?.discord ?? {}) };
      case "huggingface":
        return { enabled: isChannelConfigured(ih?.huggingface ?? {}) };
      case "webdav":
        return { enabled: isChannelConfigured(ih?.webdav ?? {}) };
    }
  }

  // ── 旧版兼容 ──
  const s3Enabled = !!ih?.s3?.articleEnabled;
  const apiKeyEnabled = !!ih?.apiProviders?.some((p) => p.articleEnabled);
  const telegramEnabled = isChannelConfigured(ih?.telegram ?? {});
  const discordEnabled = isChannelConfigured(ih?.discord ?? {});
  const huggingfaceEnabled = isChannelConfigured(ih?.huggingface ?? {});
  const webdavEnabled = isChannelConfigured(ih?.webdav ?? {});

  return {
    enabled:
      s3Enabled ||
      apiKeyEnabled ||
      telegramEnabled ||
      discordEnabled ||
      huggingfaceEnabled ||
      webdavEnabled,
  };
}
