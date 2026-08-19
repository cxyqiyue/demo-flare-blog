import * as MediaRepo from "@/features/media/data/media.data";
import * as Storage from "@/features/media/data/media.storage";
import type {
  CreateMediaFolderInput,
  DeleteExternalFilesInput,
  DeleteMediaFoldersInput,
  GetMediaDirectoryInput,
  GetMediaListInput,
  ListExternalDirectoryInput,
  MediaProvider,
  RenameMediaFolderInput,
  UpdateMediaNameInput,
  UploadToProviderInput,
} from "@/features/media/media.schema";
import { getImageDimensions } from "@/features/media/utils/image-dimensions";
import {
  buildTransformOptions,
  getBasename,
  getContentTypeFromKey,
  getParentFolder,
  joinFolderKey,
  normalizeFolderPath,
} from "@/features/media/utils/media.utils";
import {
  deleteS3Objects,
  listS3Objects,
  uploadToS3,
  uploadToS3ForMediaLibrary,
  type S3Config,
} from "@/features/image-hosting/s3/s3-upload";
import type {
  DiscordChannel,
  HuggingFaceChannel,
  TelegramChannel,
  WebDAVChannel,
} from "@/features/image-hosting/image-hosting.schema";
import * as ConfigService from "@/features/config/service/config.service";
import * as PostMediaRepo from "@/features/posts/data/post-media.data";
import { CACHE_CONTROL } from "@/lib/constants";
import { err, ok, type Result } from "@/lib/errors";

const DEFAULT_DIRECTORY_LIMIT = 50;

export async function upload(
  context: DbContext & { executionCtx: ExecutionContext },
  input: { file: File; folder?: string },
) {
  const { file } = input;
  const folder = normalizeFolderPath(input.folder ?? "");

  const dimensions = getImageDimensions(await file.arrayBuffer());
  const width = dimensions?.width;
  const height = dimensions?.height;

  const uploaded = await Storage.putToR2(context.env, file, folder);

  try {
    const mediaRecord = await MediaRepo.insertMedia(context.db, {
      provider: "r2",
      key: uploaded.key,
      url: uploaded.url,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeInBytes: uploaded.sizeInBytes,
      width,
      height,
    });
    return ok(mediaRecord);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "media db insert failed, rolling back r2 upload",
        key: uploaded.key,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    context.executionCtx.waitUntil(
      Storage.deleteFromR2(context.env, uploaded.key).catch((rollbackError) =>
        console.error(
          JSON.stringify({
            message: "r2 rollback delete failed",
            key: uploaded.key,
            error:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError),
          }),
        ),
      ),
    );
    return err({ reason: "MEDIA_RECORD_CREATE_FAILED" });
  }
}

export async function uploadToProvider(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UploadToProviderInput,
  file: File,
) {
  const folder = normalizeFolderPath(data.folder ?? "");
  const provider = data.providerId;

  let uploadResult: Result<{ url: string; key?: string; fileName?: string; mimeType?: string; sizeInBytes?: number }, { reason: string }>;

  if (provider === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const result = await uploadToS3ForMediaLibrary(s3Config, file, folder);
    if (result.error) return err({ reason: "S3_UPLOAD_FAILED" });
    uploadResult = ok(result.data);
  } else if (provider === "telegram") {
    const config = await ConfigService.getSystemConfig(context);
    const tgConfig = resolveTelegramConfig(config);
    if (!tgConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const result = await uploadToTelegramDirect(tgConfig, file);
    if (result.error) return err({ reason: "TELEGRAM_UPLOAD_FAILED" });
    uploadResult = ok(result.data);
  } else if (provider === "discord") {
    const config = await ConfigService.getSystemConfig(context);
    const dcConfig = resolveDiscordConfig(config);
    if (!dcConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const result = await uploadToDiscordDirect(dcConfig, file);
    if (result.error) return err({ reason: "DISCORD_UPLOAD_FAILED" });
    uploadResult = ok({ ...result.data, key: result.data.key ?? `discord/${folder ? `${folder}/` : ""}${Date.now()}-${crypto.randomUUID()}` });
  } else if (provider === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const result = await uploadToHuggingFaceDirect(hfConfig, file, folder);
    if (result.error) return err({ reason: "HUGGINGFACE_UPLOAD_FAILED" });
    uploadResult = ok(result.data);
  } else if (provider === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const result = await uploadToWebDAVDirect(davConfig, file, folder);
    if (result.error) return err({ reason: "WEBDAV_UPLOAD_FAILED" });
    uploadResult = ok(result.data);
  } else {
    return err({ reason: "UNSUPPORTED_PROVIDER" });
  }

  if (uploadResult.error) return err({ reason: uploadResult.error.reason });

  const data_ = uploadResult.data;
  const key = data_.key ?? `${provider}/${folder ? `${folder}/` : ""}${Date.now()}-${crypto.randomUUID()}`;
  const url = data_.url;

  try {
    await MediaRepo.insertMedia(context.db, {
      provider,
      key,
      url,
      fileName: data_.fileName ?? file.name,
      mimeType: data_.mimeType ?? file.type,
      sizeInBytes: data_.sizeInBytes ?? file.size,
      width: null,
      height: null,
    });
  } catch (e) {
    console.error(JSON.stringify({ message: "media db insert failed after provider upload", provider, key, error: e instanceof Error ? e.message : String(e) }));
  }

  return ok({ url });
}

export async function deleteImage(
  context: DbContext & { executionCtx: ExecutionContext },
  key: string,
) {
  // 后端兜底检查：防止删除正在被引用的媒体
  const inUse = await PostMediaRepo.isMediaInUse(context.db, key);
  if (inUse) {
    return err({ reason: "MEDIA_IN_USE" });
  }

  await MediaRepo.deleteMedia(context.db, key);
  context.executionCtx.waitUntil(
    Storage.deleteFromR2(context.env, key).catch((deleteError) =>
      console.error(
        JSON.stringify({
          message: "r2 delete failed",
          key,
          error:
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError),
        }),
      ),
    ),
  );

  return ok({ success: true });
}

export async function getMediaList(
  context: DbContext,
  data: GetMediaListInput,
) {
  return await MediaRepo.getMediaList(context.db, data);
}

export async function isMediaInUse(context: DbContext, key: string) {
  return await PostMediaRepo.isMediaInUse(context.db, key);
}

export async function getLinkedPosts(context: DbContext, key: string) {
  return await PostMediaRepo.getPostsByMediaKey(context.db, key);
}

export async function getLinkedMediaKeys(
  context: DbContext,
  keys: Array<string>,
) {
  return await PostMediaRepo.getLinkedMediaKeys(context.db, keys);
}

export async function getTotalMediaSize(context: DbContext) {
  return await MediaRepo.getTotalMediaSize(context.db);
}

export async function updateMediaName(
  context: DbContext,
  data: UpdateMediaNameInput,
) {
  return await MediaRepo.updateMediaName(context.db, data.key, data.name);
}

async function enrichDirectoryFiles(
  context: DbContext,
  keys: string[],
): Promise<MediaDirectoryFile[]> {
  const mediaByKey = new Map(
    (await MediaRepo.getMediaByKeys(context.db, keys)).map((m) => [m.key, m]),
  );
  const linkedKeys = new Set(
    await PostMediaRepo.getLinkedMediaKeys(context.db, keys),
  );

  return keys.map((key) => {
    const rec = mediaByKey.get(key);
    return {
      key,
      name: rec?.fileName ?? getBasename(key),
      url: rec?.url ?? `/images/${key}`,
      mimeType:
        rec?.mimeType ??
        getContentTypeFromKey(key) ??
        "application/octet-stream",
      sizeInBytes: rec?.sizeInBytes ?? 0,
      width: rec?.width ?? null,
      height: rec?.height ?? null,
      createdAt: rec?.createdAt ?? null,
      isLinked: linkedKeys.has(key),
    };
  });
}

export async function getMediaDirectory(
  context: DbContext,
  data: GetMediaDirectoryInput,
) {
  const folder = normalizeFolderPath(data.folder);
  const search = data.search?.trim() ?? "";
  const unusedOnly = data.unusedOnly ?? false;
  const prefix = folder ? `${folder}/` : "";

  // Global search: flatten the whole bucket and filter by basename.
  if (search) {
    const allKeys = await Storage.listAllKeys(context.env, "");
    const fileKeys = allKeys.filter((k) => !k.endsWith("/"));
    let files = await enrichDirectoryFiles(context, fileKeys);

    const query = search.toLowerCase();
    files = files.filter((f) => f.name.toLowerCase().includes(query));
    if (unusedOnly) files = files.filter((f) => !f.isLinked);

    return {
      folder,
      folders: [],
      files,
      nextCursor: null,
      hasMore: false,
    };
  }

  const result = await Storage.listR2Directory(context.env, {
    prefix,
    cursor: data.cursor,
    limit: data.limit ?? DEFAULT_DIRECTORY_LIMIT,
  });

  const fileKeys = result.objects
    .map((o) => o.key)
    .filter((k) => !k.endsWith("/"));
  const folders = result.delimitedPrefixes
    .filter((p) => p.endsWith("/"))
    .map((key) => ({ key, name: getBasename(key) }));

  let files = await enrichDirectoryFiles(context, fileKeys);
  if (unusedOnly) files = files.filter((f) => !f.isLinked);

  return {
    folder,
    folders,
    files,
    nextCursor: result.truncated ? result.cursor : null,
    hasMore: result.truncated,
  };
}

export async function createFolder(
  context: DbContext,
  data: CreateMediaFolderInput,
) {
  const name = data.name.replace(/^\/+|\/+$/g, "").trim();
  if (!name || name.includes("/")) {
    return err({ reason: "MEDIA_INVALID_FOLDER_NAME" });
  }
  const parent = normalizeFolderPath(data.parent);
  const key = joinFolderKey(parent, name);
  await Storage.createFolderMarker(context.env, key);
  return ok({ key, name });
}

export async function renameFolder(
  context: DbContext & { executionCtx: ExecutionContext },
  data: RenameMediaFolderInput,
) {
  const folderKey = Storage.normalizeFolderKey(data.key);
  const name = data.name.replace(/^\/+|\/+$/g, "").trim();
  if (!folderKey || !name || name.includes("/")) {
    return err({ reason: "MEDIA_INVALID_FOLDER_NAME" });
  }

  const newKey = joinFolderKey(getParentFolder(folderKey), name);
  if (newKey === folderKey) {
    return ok({ key: folderKey });
  }

  const keys = await Storage.listAllKeys(context.env, folderKey);
  for (const sourceKey of keys) {
    const targetKey = `${newKey}${sourceKey.slice(folderKey.length)}`;
    await Storage.copyObject(context.env, sourceKey, targetKey);
  }
  if (keys.length > 0) {
    context.executionCtx.waitUntil(Storage.deleteKeys(context.env, keys));
  }

  await MediaRepo.updateMediaKeyPrefix(context.db, folderKey, newKey);
  return ok({ key: newKey });
}

export async function deleteFolders(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteMediaFoldersInput,
) {
  let deletedFiles = 0;
  let skippedFiles = 0;

  for (const folder of data.keys) {
    const folderKey = Storage.normalizeFolderKey(folder);
    if (!folderKey) continue;

    const keys = await Storage.listAllKeys(context.env, folderKey);
    const fileKeys = keys.filter((k) => !k.endsWith("/"));
    const linkedKeys = new Set(
      await PostMediaRepo.getLinkedMediaKeys(context.db, fileKeys),
    );

    // Keep folder markers and unlinked files, delete them; linked files stay.
    const toDelete = keys.filter((k) => k.endsWith("/") || !linkedKeys.has(k));
    if (toDelete.length > 0) {
      context.executionCtx.waitUntil(Storage.deleteKeys(context.env, toDelete));
    }
    await MediaRepo.deleteMediaByKeys(
      context.db,
      toDelete.filter((k) => !k.endsWith("/")),
    );

    deletedFiles += toDelete.filter((k) => !k.endsWith("/")).length;
    skippedFiles +=
      fileKeys.length - toDelete.filter((k) => !k.endsWith("/")).length;
  }

  return ok({
    deletedFolders: data.keys.length,
    deletedFiles,
    skippedFiles,
  });
}

export interface MediaDirectoryFile {
  key: string;
  name: string;
  url: string;
  mimeType: string;
  sizeInBytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date | null;
  isLinked: boolean;
}

export async function handleImageRequest(
  env: Env,
  key: string,
  request: Request,
) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const serveOriginal = async () => {
    const object = await env.R2.get(key);
    if (!object) {
      return new Response("Image not found", { status: 404 });
    }

    const contentType =
      object.httpMetadata?.contentType ||
      getContentTypeFromKey(key) ||
      "application/octet-stream";

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", contentType);
    headers.set("ETag", object.httpEtag);

    return new Response(object.body, { headers });
  };

  // 1. 防止循环调用 & 显式请求原图
  const viaHeader = request.headers.get("via");
  const isLoop = viaHeader && /image-resizing/.test(viaHeader);
  const wantsOriginal = searchParams.get("original") === "true";

  if (isLoop || wantsOriginal) {
    return await serveOriginal();
  }

  // 2. 构建 Cloudflare Image Resizing 参数
  const transformOptions = buildTransformOptions(
    searchParams,
    request.headers.get("Accept") || "",
  );

  // 3. 尝试进行图片处理
  try {
    const origin = url.origin;
    const sourceImageUrl = `${origin}/images/${key}?original=true`;

    const subRequestHeaders = new Headers();

    const headersToKeep = ["user-agent", "accept"];
    for (const [k, v] of request.headers.entries()) {
      if (headersToKeep.includes(k.toLowerCase())) {
        subRequestHeaders.set(k, v);
      }
    }

    const imageRequest = new Request(sourceImageUrl, {
      headers: subRequestHeaders,
    });

    // 调用 Cloudflare Images 变换
    const response = await fetch(imageRequest, {
      cf: { image: transformOptions },
    });

    // 如果变换失败 (如格式不支持)，降级回原图
    if (!response.ok) {
      console.error(
        JSON.stringify({
          message: "image transform failed",
          key,
          status: response.status,
          statusText: response.statusText,
        }),
      );
      return await serveOriginal();
    }

    // 4. 返回处理后的图片
    // 使用 new Response(response.body, response) 保持状态码和其它优化头信息
    const newResponse = new Response(response.body, response);

    // 覆盖/补充必要的缓存头
    newResponse.headers.set("Vary", "Accept");
    Object.entries(CACHE_CONTROL.immutable).forEach(([k, v]) => {
      newResponse.headers.set(k, v);
    });

    return newResponse;
  } catch (e) {
    console.error(
      JSON.stringify({
        message: "image transform error",
        key,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return await serveOriginal();
  }
}

// ── Media Provider Management ────────────────────────────────

function resolveS3ConfigForMedia(
  config: Awaited<ReturnType<typeof ConfigService.getSystemConfig>>,
): S3Config | null {
  const s3 = config?.imageHosting?.s3;
  if (!s3) return null;
  const endpoint = s3.endpoint?.trim();
  const bucket = s3.bucket?.trim();
  const accessKeyId = s3.accessKeyId?.trim();
  const secretAccessKey = s3.secretAccessKey?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    region: s3.region?.trim() || "us-east-1",
    accessKeyId,
    secretAccessKey,
    pathPrefix: s3.pathPrefix?.trim() || "",
    publicUrl: s3.publicUrl?.trim() || "",
    pathStyle: s3.pathStyle ?? false,
  };
}

function resolveTelegramConfig(
  config: Awaited<ReturnType<typeof ConfigService.getSystemConfig>>,
): TelegramChannel | null {
  const ch = config?.imageHosting?.telegram;
  if (!ch?.botToken?.trim() || !ch?.chatId?.trim()) return null;
  return ch;
}

function resolveDiscordConfig(
  config: Awaited<ReturnType<typeof ConfigService.getSystemConfig>>,
) {
  const ch = config?.imageHosting?.discord;
  if (!ch?.botToken?.trim() || !ch?.channelId?.trim()) return null;
  return ch;
}

function resolveHuggingFaceConfig(
  config: Awaited<ReturnType<typeof ConfigService.getSystemConfig>>,
): HuggingFaceChannel | null {
  const ch = config?.imageHosting?.huggingface;
  if (!ch?.token?.trim() || !ch?.repo?.trim()) return null;
  return ch;
}

function resolveWebDAVConfig(
  config: Awaited<ReturnType<typeof ConfigService.getSystemConfig>>,
): WebDAVChannel | null {
  const ch = config?.imageHosting?.webdav;
  if (!ch?.baseUrl?.trim()) return null;
  return ch;
}

// ── Direct upload functions for media library ─────────────────

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return map[mime] ?? "png";
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

async function uploadToTelegramDirect(
  config: TelegramChannel,
  file: File,
): Promise<Result<{ url: string }, { reason: string; message: string }>> {
  const botToken = config.botToken!.trim();
  const chatId = config.chatId!.trim();

  try {
    const proxyDomain = config.proxyUrl?.trim();
    const baseUrl = proxyDomain
      ? `https://${proxyDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : "https://api.telegram.org";
    const apiUrl = `${baseUrl}/bot${botToken}/sendPhoto`;
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("photo", file);

    const response = await fetch(apiUrl, { method: "POST", body: form });
    const responseText = await response.text();
    let parsed: unknown = null;
    try { parsed = responseText ? JSON.parse(responseText) : null; } catch { parsed = null; }

    if (typeof parsed !== "object" || parsed === null || !(parsed as Record<string, unknown>).ok) {
      return err({ reason: "TELEGRAM_UPLOAD_FAILED", message: extractErrorMessage(parsed, responseText) });
    }

    const result = parsed as Record<string, unknown>;
    const msg = result.result as Record<string, unknown> | undefined;
    const photo = msg?.photo as Array<Record<string, unknown>> | undefined;
    const fileId = photo && photo.length > 0
      ? (photo[photo.length - 1].file_id as string)
      : undefined;

    if (!fileId) {
      return err({ reason: "TELEGRAM_UPLOAD_FAILED", message: "No file_id returned from Telegram" });
    }

    const getFileResp = await fetch(`${baseUrl}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const fileText = await getFileResp.text();
    let fileParsed: unknown = null;
    try { fileParsed = fileText ? JSON.parse(fileText) : null; } catch { fileParsed = null; }

    const fileResult = fileParsed as Record<string, unknown>;
    const fileInfo = fileResult?.result as Record<string, unknown> | undefined;
    const filePath = fileInfo?.file_path as string | undefined;
    if (!filePath) {
      return err({ reason: "TELEGRAM_UPLOAD_FAILED", message: "No file_path returned from Telegram" });
    }

    const fileDomain = proxyDomain
      ? `https://${proxyDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : "https://api.telegram.org";
    return ok({ url: `${fileDomain}/file/bot${botToken}/${filePath}` });
  } catch (error) {
    return err({ reason: "TELEGRAM_UPLOAD_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
}

async function uploadToDiscordDirect(
  config: DiscordChannel,
  file: File,
): Promise<Result<{ url: string; key?: string }, { reason: string; message: string }>> {
  const botToken = config.botToken!.trim();
  const channelId = config.channelId!.trim();

  const MAX_SIZE = config.isNitro ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return err({ reason: "DISCORD_UPLOAD_FAILED", message: `File exceeds Discord limit of ${config.isNitro ? "25" : "10"}MB` });
  }

  try {
    const proxyDomain = config.proxyUrl?.trim();
    const apiBase = proxyDomain
      ? `https://${proxyDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : "https://discord.com/api/v10";
    const apiUrl = `${apiBase}/channels/${channelId}/messages`;
    const form = new FormData();
    form.append("files[0]", file, file.name || "image.png");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}` },
      body: form,
    });

    const responseText = await response.text();
    let parsed: unknown = null;
    try { parsed = responseText ? JSON.parse(responseText) : null; } catch { parsed = null; }

    if (!response.ok) {
      return err({ reason: "DISCORD_UPLOAD_FAILED", message: extractErrorMessage(parsed, responseText) });
    }

    const msg = parsed as Record<string, unknown>;
    const messageId = msg.id as string | undefined;
    const attachments = msg.attachments as Array<Record<string, unknown>> | undefined;
    if (!attachments || attachments.length === 0) {
      return err({ reason: "DISCORD_UPLOAD_FAILED", message: "No attachments returned from Discord" });
    }

    return ok({ url: attachments[0].url as string, key: messageId });
  } catch (error) {
    return err({ reason: "DISCORD_UPLOAD_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
}

async function uploadToHuggingFaceDirect(
  config: HuggingFaceChannel,
  file: File,
  folder: string,
): Promise<Result<{ url: string }, { reason: string; message: string }>> {
  const token = config.token!.trim();
  const repo = config.repo!.trim();

  try {
    const ext = extensionFromMime(file.type);
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = folder ? `${folder}/${fileName}` : `media/${fileName}`;
    const repoType = config.isPrivate ? "private" : "model";
    const apiUrl = `https://huggingface.co/api/repos/${repoType}/${repo}/upload/main`;

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
      try { parsed = responseText ? JSON.parse(responseText) : null; } catch { parsed = null; }
      return err({ reason: "HUGGINGFACE_UPLOAD_FAILED", message: extractErrorMessage(parsed, responseText) });
    }

    return ok({ url: `https://huggingface.co/${repo}/resolve/main/${filePath}` });
  } catch (error) {
    return err({ reason: "HUGGINGFACE_UPLOAD_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
}

async function uploadToWebDAVDirect(
  config: WebDAVChannel,
  file: File,
  folder: string,
): Promise<Result<{ url: string }, { reason: string; message: string }>> {
  const baseUrl = config.baseUrl!.trim().replace(/\/+$/, "");

  try {
    const ext = extensionFromMime(file.type);
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = folder ? `${folder}/${fileName}` : `media/${fileName}`;
    const uploadUrl = `${baseUrl}/${filePath}`;

    const headers: Record<string, string> = {};
    if (config.username) {
      headers.Authorization = `Basic ${btoa(`${config.username}:${config.password || ""}`)}`;
    }

    if (config.createDirectory) {
      const dirUrl = folder ? `${baseUrl}/${folder}` : baseUrl;
      await fetch(dirUrl, { method: "MKCOL", headers }).catch(() => {});
    }

    const body = await file.arrayBuffer();
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": file.type || "application/octet-stream" },
      body,
    });

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      const responseText = await response.text();
      return err({ reason: "WEBDAV_UPLOAD_FAILED", message: `WebDAV upload failed with status ${response.status}: ${responseText.slice(0, 300)}` });
    }

    const publicBase = config.publicUrl?.trim() || baseUrl;
    return ok({ url: `${publicBase.replace(/\/+$/, "")}/${filePath}` });
  } catch (error) {
    return err({ reason: "WEBDAV_UPLOAD_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
}

export async function getMediaProviders(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<MediaProvider[]> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;
  const activeProvider = ih?.activeProvider ?? null;
  const providers: MediaProvider[] = [];

  const isActive = (id: string) =>
    activeProvider === null ? false : activeProvider === id;

  // R2 Native — always available
  providers.push({
    id: "r2",
    name: "Cloudflare R2",
    type: "r2",
    canList: true,
    canDelete: true,
    canUpload: true,
    canCreateFolder: true,
    isDefault: activeProvider === null || activeProvider === "r2-native",
  });

  // S3
  const s3Config = resolveS3ConfigForMedia(config);
  if (s3Config) {
    providers.push({
      id: "s3",
      name: ih?.s3?.provider ? `${ih.s3.provider} (S3)` : "S3",
      type: "s3",
      canList: true,
      canDelete: true,
      canUpload: true,
      canCreateFolder: true,
      isDefault: isActive("s3"),
    });
  }

  // API Key providers
  const apiProviders = ih?.apiProviders ?? [];
  for (const p of apiProviders) {
    if (!p.apiKey?.trim()) continue;
    providers.push({
      id: p.id,
      name: p.name,
      type: "api-key",
      canList: false,
      canDelete: false,
      canUpload: true,
      canCreateFolder: false,
      isDefault: isActive("api-key"),
    });
  }

  // Telegram — listable via D1 index
  if (ih?.telegram?.botToken?.trim() && ih?.telegram?.chatId?.trim()) {
    providers.push({
      id: "telegram",
      name: "Telegram",
      type: "telegram",
      canList: true,
      canDelete: false,
      canUpload: true,
      canCreateFolder: false,
      isDefault: isActive("telegram"),
    });
  }

  // Discord — listable via D1 index, deletable via Discord API
  if (ih?.discord?.botToken?.trim() && ih?.discord?.channelId?.trim()) {
    providers.push({
      id: "discord",
      name: "Discord",
      type: "discord",
      canList: true,
      canDelete: true,
      canUpload: true,
      canCreateFolder: false,
      isDefault: isActive("discord"),
    });
  }

  // HuggingFace — full CRUD
  if (ih?.huggingface?.token?.trim() && ih?.huggingface?.repo?.trim()) {
    providers.push({
      id: "huggingface",
      name: "HuggingFace",
      type: "huggingface",
      canList: true,
      canDelete: true,
      canUpload: true,
      canCreateFolder: true,
      isDefault: isActive("huggingface"),
    });
  }

  // WebDAV — full CRUD
  if (ih?.webdav?.baseUrl?.trim()) {
    providers.push({
      id: "webdav",
      name: "WebDAV",
      type: "webdav",
      canList: true,
      canDelete: true,
      canUpload: true,
      canCreateFolder: true,
      isDefault: isActive("webdav"),
    });
  }

  return providers;
}

export interface ExternalDirectoryFile {
  key: string;
  name: string;
  url: string;
  mimeType: string;
  sizeInBytes: number;
}

export interface ExternalDirectoryResult {
  files: ExternalDirectoryFile[];
  folders: Array<{ key: string; name: string }>;
  nextContinuationToken: string | null;
  error?: string;
}

export async function listExternalDirectory(
  context: DbContext & { executionCtx: ExecutionContext },
  data: ListExternalDirectoryInput,
): Promise<ExternalDirectoryResult> {
  const provider = data.providerId;
  const search = data.search?.trim();

  // 1. Query D1 index for this provider
  const { items, nextCursor } = await MediaRepo.getMediaByProvider(context.db, provider, {
    limit: DEFAULT_DIRECTORY_LIMIT,
    search,
    cursor: data.continuationToken ? Number(data.continuationToken) : undefined,
  });

  // 2. If D1 has records for this provider, return them
  if (items.length > 0) {
    const files: ExternalDirectoryFile[] = items.map((item) => ({
      key: item.key,
      name: item.fileName,
      url: item.url,
      mimeType: item.mimeType,
      sizeInBytes: item.sizeInBytes,
    }));
    return {
      files,
      folders: [],
      nextContinuationToken: nextCursor ? String(nextCursor) : null,
    };
  }

  // 3. D1 empty — fallback to direct provider API listing
  //    (covers files uploaded before the provider index was introduced)
  return listExternalDirectoryDirect(context, data);
}

async function listExternalDirectoryDirect(
  context: DbContext & { executionCtx: ExecutionContext },
  data: ListExternalDirectoryInput,
): Promise<ExternalDirectoryResult> {
  const provider = data.providerId;

  if (provider === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return { files: [], folders: [], nextContinuationToken: null, error: "S3 未配置或缺少必要字段" };

    const prefix = normalizeFolderPath(data.folder);
    const result = await listS3Objects(s3Config, {
      prefix: prefix ? `${prefix}/` : "",
      delimiter: "/",
      continuationToken: data.continuationToken,
    });

    if (result.error) {
      console.error(JSON.stringify({ message: "s3 list failed", error: result.error.message }));
      return { files: [], folders: [], nextContinuationToken: null, error: result.error.message };
    }

    const files: ExternalDirectoryFile[] = result.data.objects.map((o) => ({
      key: o.key,
      name: getBasename(o.key),
      url: buildS3PublicUrl(s3Config, o.key),
      mimeType: guessMimeFromKey(o.key),
      sizeInBytes: o.size,
    }));

    return {
      files,
      folders: result.data.prefixes.map((p) => ({ key: p, name: getBasename(p) })),
      nextContinuationToken: result.data.isTruncated
        ? (result.data.nextContinuationToken ?? null)
        : null,
    };
  }

  if (provider === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return { files: [], folders: [], nextContinuationToken: null, error: "HuggingFace 未配置" };

    const token = hfConfig.token!.trim();
    const repo = hfConfig.repo!.trim();
    const folder = normalizeFolderPath(data.folder);
    const path = folder || "";
    const repoType = hfConfig.isPrivate ? "private" : "model";

    try {
      const url = `https://huggingface.co/api/repos/${repoType}/${repo}/tree/main/${path}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const text = await response.text();
        return { files: [], folders: [], nextContinuationToken: null, error: text.slice(0, 300) };
      }

      const entries: Array<{ path: string; type: string; size?: number }> = await response.json();
      const files: ExternalDirectoryFile[] = [];
      const folders: Array<{ key: string; name: string }> = [];

      for (const entry of entries) {
        const entryName = getBasename(entry.path);
        if (entryName.startsWith(".")) continue;

        if (entry.type === "file" || entry.type === "regular_file") {
          files.push({
            key: entry.path,
            name: entryName,
            url: `https://huggingface.co/${repo}/resolve/main/${entry.path}`,
            mimeType: guessMimeFromKey(entry.path),
            sizeInBytes: entry.size ?? 0,
          });
        } else if (entry.type === "directory" || entry.type === "tree") {
          folders.push({ key: entry.path, name: entryName });
        }
      }

      return { files, folders, nextContinuationToken: null };
    } catch (e) {
      return { files: [], folders: [], nextContinuationToken: null, error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (provider === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return { files: [], folders: [], nextContinuationToken: null, error: "WebDAV 未配置" };

    const baseUrl = davConfig.baseUrl!.trim().replace(/\/+$/, "");
    const folder = normalizeFolderPath(data.folder);
    const targetUrl = folder ? `${baseUrl}/${folder}` : baseUrl;

    const headers: Record<string, string> = { Depth: "1" };
    if (davConfig.username) {
      headers.Authorization = `Basic ${btoa(`${davConfig.username}:${davConfig.password || ""}`)}`;
    }

    try {
      const response = await fetch(targetUrl, {
        method: "PROPFIND",
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        return { files: [], folders: [], nextContinuationToken: null, error: text.slice(0, 300) };
      }

      const xml = await response.text();
      const files: ExternalDirectoryFile[] = [];
      const folders: Array<{ key: string; name: string }> = [];

      const responses = xml.split("<d:response>").slice(1);
      for (const block of responses) {
        const hrefMatch = block.match(/<d?:href>([^<]+)<\/d?:href>/);
        if (!hrefMatch) continue;

        const href = decodeURIComponent(hrefMatch[1]);
        const hrefPath = href.replace(/\/+$/, "");
        const entryName = getBasename(hrefPath);
        if (!entryName || entryName === getBasename(targetUrl.replace(/\/+$/, ""))) continue;

        const isCollection = /<d?:resourcetype>\s*<d?:collection\s*\/?>/.test(block);
        const contentLengthMatch = block.match(/<d?:getcontentlength>(\d+)<\/d?:getcontentlength>/);
        const contentTypeMatch = block.match(/<d?:getcontenttype>([^<]+)<\/d?:getcontenttype>/);

        const relKey = folder ? `${folder}/${entryName}` : entryName;

        if (isCollection) {
          folders.push({ key: relKey, name: entryName });
        } else {
          files.push({
            key: relKey,
            name: entryName,
            url: davConfig.publicUrl?.trim()
              ? `${davConfig.publicUrl.trim().replace(/\/+$/, "")}/${relKey}`
              : href,
            mimeType: contentTypeMatch?.[1] || guessMimeFromKey(entryName),
            sizeInBytes: parseInt(contentLengthMatch?.[1] ?? "0", 10) || 0,
          });
        }
      }

      return { files, folders, nextContinuationToken: null };
    } catch (e) {
      return { files: [], folders: [], nextContinuationToken: null, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { files: [], folders: [], nextContinuationToken: null };
}

export async function deleteExternalFiles(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteExternalFilesInput,
): Promise<{ deleted: number; skipped: number }> {
  const provider = data.providerId;

  // Delete from D1 index
  await MediaRepo.deleteMediaByKeys(context.db, data.keys);

  // Delete from remote provider
  if (provider === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return { deleted: data.keys.length, skipped: 0 };
    const result = await deleteS3Objects(s3Config, data.keys);
    if (result.error) {
      console.error(JSON.stringify({ message: "s3 delete failed", error: result.error.message }));
    }
    return { deleted: data.keys.length, skipped: 0 };
  }

  if (provider === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return { deleted: data.keys.length, skipped: 0 };
    const token = hfConfig.token!.trim();
    const repo = hfConfig.repo!.trim();

    for (const filePath of data.keys) {
      try {
        const commitUrl = `https://huggingface.co/api/datasets/${repo}/commit/main`;
        const body = [
          JSON.stringify({ key: "header", value: { summary: `Delete ${filePath} via media library` } }),
          JSON.stringify({ key: "deletedFile", value: { path: filePath } }),
        ].join("\n");
        await fetch(commitUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-ndjson",
          },
          body,
        });
      } catch (e) {
        console.error(JSON.stringify({ message: "huggingface delete failed", file: filePath, error: e instanceof Error ? e.message : String(e) }));
      }
    }
    return { deleted: data.keys.length, skipped: 0 };
  }

  if (provider === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return { deleted: data.keys.length, skipped: 0 };
    const baseUrl = davConfig.baseUrl!.trim().replace(/\/+$/, "");
    const headers: Record<string, string> = {};
    if (davConfig.username) {
      headers.Authorization = `Basic ${btoa(`${davConfig.username}:${davConfig.password || ""}`)}`;
    }

    for (const filePath of data.keys) {
      try {
        await fetch(`${baseUrl}/${filePath}`, { method: "DELETE", headers });
      } catch (e) {
        console.error(JSON.stringify({ message: "webdav delete failed", file: filePath, error: e instanceof Error ? e.message : String(e) }));
      }
    }
    return { deleted: data.keys.length, skipped: 0 };
  }

  if (provider === "discord") {
    const config = await ConfigService.getSystemConfig(context);
    const dcConfig = resolveDiscordConfig(config);
    if (!dcConfig) return { deleted: data.keys.length, skipped: 0 };
    const botToken = dcConfig.botToken!.trim();
    const channelId = dcConfig.channelId!.trim();
    const proxyDomain = dcConfig.proxyUrl?.trim();
    const apiBase = proxyDomain
      ? `https://${proxyDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : "https://discord.com/api/v10";

    for (const messageId of data.keys) {
      try {
        await fetch(`${apiBase}/channels/${channelId}/messages/${messageId}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}` },
        });
      } catch (e) {
        console.error(JSON.stringify({ message: "discord delete failed", messageId, error: e instanceof Error ? e.message : String(e) }));
      }
    }
    return { deleted: data.keys.length, skipped: 0 };
  }

  // Telegram — cannot delete from remote, but D1 record is already removed
  return { deleted: data.keys.length, skipped: 0 };
}

export async function createExternalFolder(
  context: DbContext & { executionCtx: ExecutionContext },
  data: { providerId: string; name: string; parent?: string },
): Promise<Result<{ key: string; name: string }, { reason: string }>> {
  if (data.providerId === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return err({ reason: "S3 未配置" });

    const name = data.name.replace(/^\/+|\/+$/g, "").trim();
    if (!name || name.includes("/")) return err({ reason: "MEDIA_INVALID_FOLDER_NAME" });

    const parent = normalizeFolderPath(data.parent ?? "");
    const folderKey = joinFolderKey(parent, name);

    const result = await uploadToS3(s3Config, {
      key: `${folderKey}/`,
      body: new ArrayBuffer(0),
      contentType: "application/x-directory",
    });

    if (result.error) {
      console.error(JSON.stringify({ message: "s3 create folder failed", error: result.error.message }));
      return err({ reason: "S3_FOLDER_CREATE_FAILED" });
    }

    return ok({ key: folderKey, name });
  }

  if (data.providerId === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return err({ reason: "HuggingFace 未配置" });

    const name = data.name.replace(/^\/+|\/+$/g, "").trim();
    if (!name || name.includes("/")) return err({ reason: "MEDIA_INVALID_FOLDER_NAME" });

    const parent = normalizeFolderPath(data.parent ?? "");
    const folderPath = joinFolderKey(parent, name);

    const token = hfConfig.token!.trim();
    const repo = hfConfig.repo!.trim();
    const repoType = hfConfig.isPrivate ? "private" : "model";

    try {
      const gitkeepPath = `${folderPath}/.gitkeep`;
      const response = await fetch(
        `https://huggingface.co/api/repos/${repoType}/${repo}/upload/main`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "text/plain",
            "X-Content-Type": gitkeepPath,
          },
          body: new TextEncoder().encode(""),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(JSON.stringify({ message: "huggingface create folder failed", error: text.slice(0, 300) }));
        return err({ reason: "HUGGINGFACE_FOLDER_CREATE_FAILED" });
      }

      return ok({ key: folderPath, name });
    } catch (e) {
      console.error(JSON.stringify({ message: "huggingface create folder failed", error: e instanceof Error ? e.message : String(e) }));
      return err({ reason: "HUGGINGFACE_FOLDER_CREATE_FAILED" });
    }
  }

  if (data.providerId === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return err({ reason: "WebDAV 未配置" });

    const name = data.name.replace(/^\/+|\/+$/g, "").trim();
    if (!name || name.includes("/")) return err({ reason: "MEDIA_INVALID_FOLDER_NAME" });

    const parent = normalizeFolderPath(data.parent ?? "");
    const folderPath = joinFolderKey(parent, name);
    const baseUrl = davConfig.baseUrl!.trim().replace(/\/+$/, "");
    const folderUrl = `${baseUrl}/${folderPath}`;

    const headers: Record<string, string> = {};
    if (davConfig.username) {
      headers.Authorization = `Basic ${btoa(`${davConfig.username}:${davConfig.password || ""}`)}`;
    }

    try {
      const response = await fetch(folderUrl, { method: "MKCOL", headers });

      if (!response.ok && response.status !== 201 && response.status !== 405) {
        const text = await response.text();
        console.error(JSON.stringify({ message: "webdav create folder failed", error: text.slice(0, 300) }));
        return err({ reason: "WEBDAV_FOLDER_CREATE_FAILED" });
      }

      return ok({ key: folderPath, name });
    } catch (e) {
      console.error(JSON.stringify({ message: "webdav create folder failed", error: e instanceof Error ? e.message : String(e) }));
      return err({ reason: "WEBDAV_FOLDER_CREATE_FAILED" });
    }
  }

  return err({ reason: "UNSUPPORTED_PROVIDER" });
}

function buildS3PublicUrl(cfg: S3Config, key: string): string {
  const fullKey = [cfg.pathPrefix?.trim(), key].filter(Boolean).join("/");
  const base = (
    cfg.publicUrl?.trim() ||
    `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}`
  ).replace(/\/+$/, "");
  const encoded = fullKey.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

function guessMimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}
