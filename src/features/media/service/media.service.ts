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
  uploadToS3ForMediaLibrary,
  type S3Config,
} from "@/features/image-hosting/s3/s3-upload";
import * as ConfigService from "@/features/config/service/config.service";
import * as PostMediaRepo from "@/features/posts/data/post-media.data";
import { CACHE_CONTROL } from "@/lib/constants";
import { err, ok } from "@/lib/errors";

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

  if (data.providerId === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) {
      return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    }

    const result = await uploadToS3ForMediaLibrary(s3Config, file, folder);
    if (result.error) {
      return err({ reason: "S3_UPLOAD_FAILED" });
    }
    return ok(result.data);
  }

  return err({ reason: "UNSUPPORTED_PROVIDER" });
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
    region: s3.region?.trim() || "",
    accessKeyId,
    secretAccessKey,
    pathPrefix: s3.pathPrefix?.trim() || "",
    publicUrl: s3.publicUrl?.trim() || "",
  };
}

export async function getMediaProviders(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<MediaProvider[]> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;
  const providers: MediaProvider[] = [];

  // R2 Native — always available
  providers.push({
    id: "r2",
    name: "Cloudflare R2",
    type: "r2",
    canList: true,
    canDelete: true,
    canUpload: true,
    canCreateFolder: true,
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
      canCreateFolder: false,
    });
  }

  // API Key providers — upload only
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
}

export async function listExternalDirectory(
  context: DbContext & { executionCtx: ExecutionContext },
  data: ListExternalDirectoryInput,
): Promise<ExternalDirectoryResult> {
  if (data.providerId === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return { files: [], folders: [], nextContinuationToken: null };

    const prefix = normalizeFolderPath(data.folder);
    const result = await listS3Objects(s3Config, {
      prefix: prefix ? `${prefix}/` : "",
      delimiter: "/",
      continuationToken: data.continuationToken,
    });

    if (result.error) {
      console.error(JSON.stringify({ message: "s3 list failed", error: result.error.message }));
      return { files: [], folders: [], nextContinuationToken: null };
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

  return { files: [], folders: [], nextContinuationToken: null };
}

export async function deleteExternalFiles(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteExternalFilesInput,
): Promise<{ deleted: number; skipped: number }> {
  if (data.providerId === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return { deleted: 0, skipped: data.keys.length };

    const result = await deleteS3Objects(s3Config, data.keys);
    if (result.error) {
      console.error(JSON.stringify({ message: "s3 delete failed", error: result.error.message }));
      return { deleted: 0, skipped: data.keys.length };
    }
    return { deleted: result.data.deleted, skipped: 0 };
  }

  return { deleted: 0, skipped: data.keys.length };
}

function buildS3PublicUrl(cfg: S3Config, key: string): string {
  const base = (
    cfg.publicUrl?.trim() ||
    `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}`
  ).replace(/\/+$/, "");
  const encoded = key.split("/").filter(Boolean).map(encodeURIComponent).join("/");
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
