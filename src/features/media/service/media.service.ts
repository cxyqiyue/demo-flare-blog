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
  MoveMediaFileInput,
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
  listAllS3Keys,
  listS3Objects,
  moveS3Objects,
  moveS3Object,
  renameS3Object,
  resolveValidatedS3Config,
  uploadToS3,
  uploadToS3ForMediaLibrary,
  type S3Config,
} from "@/features/image-hosting/s3/s3-upload";
import * as TelegramChannelApi from "@/features/image-hosting/channels/telegram";
import * as DiscordChannelApi from "@/features/image-hosting/channels/discord";
import * as HuggingFaceChannelApi from "@/features/image-hosting/channels/huggingface";
import * as WebDavChannelApi from "@/features/image-hosting/channels/webdav";
import type {
  HuggingFaceChannel,
  TelegramChannel,
  WebDAVChannel,
} from "@/features/image-hosting/image-hosting.schema";
import {
  resolveDiscordMaxBytes,
  resolveHuggingFaceMaxBytes,
  resolveImgbbMaxBytes,
  resolveFfskyMaxBytes,
  resolveR2NativeMaxBytes,
  resolveS3MaxBytes,
  resolveTelegramMaxBytes,
  resolveWebDavMaxBytes,
  formatLimitMb,
} from "@/features/image-hosting/size-limits";
import * as ConfigService from "@/features/config/service/config.service";
import {
  buildMediaAccessUrl,
  getLinkAccessSettings,
} from "@/features/media/service/link-access.service";
import { enforceImageModeration } from "@/features/image-hosting/moderation/moderation.service";
import { m } from "@/paraglide/messages";
import * as PostMediaRepo from "@/features/posts/data/post-media.data";
import { CACHE_CONTROL } from "@/lib/constants";
import { err, ok, type Result } from "@/lib/errors";
import { getDb } from "@/lib/db";

const DEFAULT_DIRECTORY_LIMIT = 50;

/**
 * 将 Hono 上下文适配为服务层依赖（db + env + executionCtx），
 * 供 /media/file 等直接挂载的 Hono 路由复用服务层函数。
 */
export function resolveMediaRequestContext(
  c: { env: Env; executionCtx: ExecutionContext },
): DbContext & { executionCtx: ExecutionContext } {
  return {
    db: getDb(c.env),
    env: c.env,
    executionCtx: c.executionCtx,
  };
}

export async function upload(
  context: DbContext & { executionCtx: ExecutionContext },
  input: { file: File; folder?: string; origin?: string },
) {
  const { file } = input;
  const folder = normalizeFolderPath(input.folder ?? "");

  const dimensions = getImageDimensions(await file.arrayBuffer());
  const width = dimensions?.width;
  const height = dimensions?.height;

  const uploaded = await Storage.putToR2(context.env, file, folder);

  // 上传审查：判定为成人内容时拒绝并尽力清理远端对象
  const moderation = await enforceImageModeration(context, {
    url: uploaded.url,
    file,
    origin: input.origin,
    providerLabel: "r2",
    key: uploaded.key,
  });
  if (moderation.error) {
    return err({ reason: "MEDIA_RECORD_CREATE_FAILED", message: moderation.error.message });
  }

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

/**
 * 解析媒体库外部渠道的上传大小上限（字节）。null = 无固定上限。
 */
function providerLimitBytes(
  config: Awaited<ReturnType<typeof ConfigService.getSystemConfig>>,
  provider: string,
): number | null {
  const ih = config?.imageHosting;
  switch (provider) {
    case "s3":
      return resolveS3MaxBytes(ih?.s3);
    case "telegram":
      return resolveTelegramMaxBytes(ih?.telegram);
    case "discord":
      return resolveDiscordMaxBytes(ih?.discord);
    case "huggingface":
      return resolveHuggingFaceMaxBytes(ih?.huggingface);
    case "webdav":
      return resolveWebDavMaxBytes(ih?.webdav);
    default:
      return null;
  }
}

function fileSizeTooLargeError(limitBytes: number): {
  reason: "FILE_TOO_LARGE";
  message: string;
} {
  return {
    reason: "FILE_TOO_LARGE",
    message: m.media_upload_file_too_large_channel({
      limit: formatLimitMb(limitBytes),
    }),
  };
}

export async function uploadToProvider(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UploadToProviderInput,
  file: File,
  options?: { origin?: string },
) {
  const folder = normalizeFolderPath(data.folder ?? "");
  const provider = data.providerId;

  let uploadResult: Result<
    {
      key?: string;
      url: string;
      fileName?: string;
      mimeType?: string;
      sizeInBytes?: number;
    },
    { reason: string; message?: string }
  >;

  if (provider === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const limit = providerLimitBytes(config, provider);
    if (limit !== null && file.size > limit) {
      return err(fileSizeTooLargeError(limit));
    }
    const result = await uploadToS3ForMediaLibrary(s3Config, file, folder);
    if (result.error) return err({ reason: "S3_UPLOAD_FAILED" });
    uploadResult = ok(result.data);
  } else if (provider === "telegram") {
    const config = await ConfigService.getSystemConfig(context);
    const tgConfig = resolveTelegramConfig(config);
    if (!tgConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const limit = providerLimitBytes(config, provider);
    if (limit !== null && file.size > limit) {
      return err(fileSizeTooLargeError(limit));
    }
    const result = await TelegramChannelApi.uploadToTelegramChannel(
      tgConfig,
      file,
    );
    if (result.error) return err({ reason: "TELEGRAM_UPLOAD_FAILED" });
    // 键携带双重句柄：messageId 用于远程删除，fileId 用于代理回源。
    uploadResult = ok({
      ...result.data,
      key: `telegram/${result.data.messageId}:${result.data.fileId}`,
    });
  } else if (provider === "discord") {
    const config = await ConfigService.getSystemConfig(context);
    const dcConfig = resolveDiscordConfig(config);
    if (!dcConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const limit = providerLimitBytes(config, provider);
    if (limit !== null && file.size > limit) {
      return err(fileSizeTooLargeError(limit));
    }
    const result = await DiscordChannelApi.uploadToDiscordChannel(
      dcConfig,
      file,
    );
    if (result.error) return err({ reason: "DISCORD_UPLOAD_FAILED" });
    // The Discord message id is the durable handle used for remote delete.
    uploadResult = ok({
      ...result.data,
      key: result.data.messageId,
    });
  } else if (provider === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const limit = providerLimitBytes(config, provider);
    if (limit !== null && file.size > limit) {
      return err(fileSizeTooLargeError(limit));
    }
    const result = await HuggingFaceChannelApi.uploadToHuggingFaceChannel(
      hfConfig,
      file,
      folder,
    );
    if (result.error) return err({ reason: "HUGGINGFACE_UPLOAD_FAILED" });
    uploadResult = ok(result.data);
  } else if (provider === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });
    const limit = providerLimitBytes(config, provider);
    if (limit !== null && file.size > limit) {
      return err(fileSizeTooLargeError(limit));
    }
    const result = await WebDavChannelApi.uploadToWebDavChannel(
      davConfig,
      file,
      folder,
    );
    if (result.error) return err({ reason: "WEBDAV_UPLOAD_FAILED" });
    uploadResult = ok(result.data);
  } else {
    return err({ reason: "UNSUPPORTED_PROVIDER" });
  }

  if (uploadResult.error) return err({ reason: uploadResult.error.reason });

  const data_ = uploadResult.data;
  const key = data_.key ?? `${provider}/${folder ? `${folder}/` : ""}${Date.now()}-${crypto.randomUUID()}`;
  const url = data_.url;

  // 上传审查：判定为成人内容时拒绝并尽力清理远端对象
  const configForModeration = await ConfigService.getSystemConfig(context);
  const moderation = await enforceImageModeration(context, {
    url,
    file,
    origin: options?.origin,
    providerLabel: provider,
    key,
  });
  if (moderation.error) {
    return err({ reason: "CONTENT_MODERATION_BLOCKED", message: moderation.error.message });
  }

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
    // D1 记录写入失败：尽力清理远端对象，并向调用方返回失败，
    // 避免「返回成功但媒体库无记录 / 无法受访问控制保护」的不一致状态。
    context.executionCtx.waitUntil(
      deleteUploadedMediaBestEffortForService(
        context,
        provider,
        key,
      ).catch((rollbackError) =>
        console.error(
          JSON.stringify({
            message: "provider upload rollback failed",
            provider,
            key,
            error:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError),
          }),
        ),
      ),
    );
    console.error(
      JSON.stringify({
        message: "media db insert failed after provider upload",
        provider,
        key,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return err({ reason: "MEDIA_RECORD_CREATE_FAILED" });
  }

  // 对外返回按访问模式计算后的图链（Telegram/Discord 恒为代理地址）
  const accessUrl = buildMediaAccessUrl(
    getLinkAccessSettings(configForModeration),
    provider,
    key,
    url,
  );
  return ok({ url: accessUrl });
}

/** 尽力删除刚上传到外部渠道的远端对象（用于 D1 记录写入失败后的回滚）。 */
async function deleteUploadedMediaBestEffortForService(
  context: DbContext & { executionCtx: ExecutionContext },
  provider: string,
  key: string,
): Promise<void> {
  const config = await ConfigService.getSystemConfig(context);
  const ih = config?.imageHosting;
  try {
    switch (provider) {
      case "r2":
      case "r2-native":
        await Storage.deleteFromR2(context.env, key);
        break;
      case "telegram": {
        const { messageId } = TelegramChannelApi.parseTelegramKey(key);
        if (/^\d+$/.test(messageId) && ih?.telegram?.botToken) {
          await TelegramChannelApi.deleteTelegramMessage(
            ih.telegram as TelegramChannel,
            messageId,
          );
        }
        break;
      }
      case "discord": {
        const dcConfig = resolveDiscordConfig(config);
        if (dcConfig) {
          await DiscordChannelApi.deleteDiscordMessage(dcConfig, key);
        }
        break;
      }
      case "s3": {
        const cfg = resolveS3ConfigForMedia(config);
        if (cfg) {
          await deleteS3Objects(cfg, [key]);
        }
        break;
      }
      case "huggingface":
        if (ih?.huggingface?.token && ih?.huggingface?.repo) {
          await HuggingFaceChannelApi.deleteHuggingFaceFiles(
            ih.huggingface as HuggingFaceChannel,
            [key],
          );
        }
        break;
      case "webdav":
        if (ih?.webdav?.baseUrl) {
          await WebDavChannelApi.deleteWebDavPaths(
            ih.webdav as WebDAVChannel,
            [key],
          );
        }
        break;
      default:
        // api-key 图床（imgbb/ffsky）无远程删除能力；记录未写入不影响安全。
        break;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "provider upload rollback delete failed",
        provider,
        key,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
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
  context: DbContext & { executionCtx: ExecutionContext },
  data: UpdateMediaNameInput,
) {
  // S3: rename the actual file in remote storage
  if (data.providerId === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return err({ reason: "S3_NOT_CONFIGURED" });

    const media = await MediaRepo.getMediaByKey(context.db, data.key);
    if (!media) return err({ reason: "MEDIA_NOT_FOUND" });

    const oldKey = data.key;
    const lastSlash = oldKey.lastIndexOf("/");
    const dir = lastSlash >= 0 ? oldKey.substring(0, lastSlash + 1) : "";
    const newKey = `${dir}${data.name}`;

    if (oldKey === newKey) {
      await MediaRepo.updateMediaName(context.db, data.key, data.name);
      return ok({ success: true });
    }

    const renameResult = await renameS3Object(s3Config, oldKey, newKey);
    if (renameResult.error) {
      console.error(JSON.stringify({ message: "s3 rename failed", error: renameResult.error.message }));
      return err({ reason: "S3_RENAME_FAILED" });
    }

    const newUrl = buildS3PublicUrl(s3Config, newKey);
    await MediaRepo.updateMediaKeyAndName(context.db, oldKey, newKey, data.name, newUrl);
    return ok({ success: true });
  }

  // HuggingFace: re-commit the content under the new repo path
  if (data.providerId === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });

    const media = await MediaRepo.getMediaByKey(context.db, data.key);
    if (!media) return err({ reason: "MEDIA_NOT_FOUND" });

    const oldPath = data.key;
    const lastSlash = oldPath.lastIndexOf("/");
    const dir = lastSlash >= 0 ? oldPath.substring(0, lastSlash + 1) : "";
    const newPath = `${dir}${data.name}`;

    if (oldPath === newPath) {
      await MediaRepo.updateMediaName(context.db, data.key, data.name);
      return ok({ success: true });
    }

    const moveResult = await HuggingFaceChannelApi.moveHuggingFaceFile(
      hfConfig,
      oldPath,
      newPath,
    );
    if (moveResult.error) {
      console.error(JSON.stringify({ message: "huggingface rename failed", error: moveResult.error.message }));
      return err({ reason: "HUGGINGFACE_RENAME_FAILED" });
    }

    await MediaRepo.updateMediaKeyAndName(
      context.db,
      oldPath,
      newPath,
      data.name,
      HuggingFaceChannelApi.buildHfResolveUrl(hfConfig.repo!.trim(), newPath),
    );
    return ok({ success: true });
  }

  // WebDAV: MOVE the real object on the server
  if (data.providerId === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });

    const media = await MediaRepo.getMediaByKey(context.db, data.key);
    if (!media) return err({ reason: "MEDIA_NOT_FOUND" });

    const oldPath = data.key;
    const lastSlash = oldPath.lastIndexOf("/");
    const dir = lastSlash >= 0 ? oldPath.substring(0, lastSlash + 1) : "";
    const newPath = `${dir}${data.name}`;

    if (oldPath === newPath) {
      await MediaRepo.updateMediaName(context.db, data.key, data.name);
      return ok({ success: true });
    }

    const moveResult = await WebDavChannelApi.moveWebDavObject(
      davConfig,
      oldPath,
      newPath,
    );
    if (moveResult.error) {
      console.error(JSON.stringify({ message: "webdav rename failed", error: moveResult.error.message }));
      return err({ reason: "WEBDAV_RENAME_FAILED" });
    }

    await MediaRepo.updateMediaKeyAndName(
      context.db,
      oldPath,
      newPath,
      data.name,
      WebDavChannelApi.buildWebDavPublicUrl(davConfig, newPath),
    );
    return ok({ success: true });
  }

  // Telegram/Discord messages and R2 objects: display-name only for R2;
  // message-based channels cannot rename remotely.
  if (
    data.providerId === "telegram" ||
    data.providerId === "discord"
  ) {
    return err({ reason: "UNSUPPORTED_PROVIDER" });
  }

  // R2 (default): just update display name
  await MediaRepo.updateMediaName(context.db, data.key, data.name);
  return ok({ success: true });
}

export async function moveMediaFile(
  context: DbContext & { executionCtx: ExecutionContext },
  data: MoveMediaFileInput,
): Promise<Result<{ success: boolean }, { reason: string }>> {
  const provider = data.providerId;

  if (provider === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return err({ reason: "S3_NOT_CONFIGURED" });

    const media = await MediaRepo.getMediaByKey(context.db, data.key);
    if (!media) return err({ reason: "MEDIA_NOT_FOUND" });

    const oldKey = data.key;
    const fileName = oldKey.split("/").pop() ?? oldKey;
    const targetFolder = normalizeFolderPath(data.targetFolder ?? "");
    const newKey = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    if (oldKey === newKey) {
      return ok({ success: true });
    }

    const moveResult = await moveS3Object(s3Config, oldKey, newKey);
    if (moveResult.error) {
      console.error(JSON.stringify({ message: "s3 move failed", error: moveResult.error.message }));
      return err({ reason: "S3_MOVE_FAILED" });
    }

    const newUrl = buildS3PublicUrl(s3Config, newKey);
    await MediaRepo.updateMediaKeyAndName(context.db, oldKey, newKey, media.fileName, newUrl);
    return ok({ success: true });
  }

  // HuggingFace: re-commit content under the target folder path
  if (provider === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });

    const media = await MediaRepo.getMediaByKey(context.db, data.key);
    if (!media) return err({ reason: "MEDIA_NOT_FOUND" });

    const oldPath = data.key;
    const fileName = oldPath.split("/").pop() ?? oldPath;
    const targetFolder = normalizeFolderPath(data.targetFolder ?? "");
    const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    if (oldPath === newPath) {
      return ok({ success: true });
    }

    const moveResult = await HuggingFaceChannelApi.moveHuggingFaceFile(
      hfConfig,
      oldPath,
      newPath,
    );
    if (moveResult.error) {
      console.error(JSON.stringify({ message: "huggingface move failed", error: moveResult.error.message }));
      return err({ reason: "HUGGINGFACE_MOVE_FAILED" });
    }

    await MediaRepo.updateMediaKeyAndName(
      context.db,
      oldPath,
      newPath,
      media.fileName,
      HuggingFaceChannelApi.buildHfResolveUrl(hfConfig.repo!.trim(), newPath),
    );
    return ok({ success: true });
  }

  // WebDAV: MOVE the real object on the server
  if (provider === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });

    const media = await MediaRepo.getMediaByKey(context.db, data.key);
    if (!media) return err({ reason: "MEDIA_NOT_FOUND" });

    const oldPath = data.key;
    const fileName = oldPath.split("/").pop() ?? oldPath;
    const targetFolder = normalizeFolderPath(data.targetFolder ?? "");
    const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    if (oldPath === newPath) {
      return ok({ success: true });
    }

    const moveResult = await WebDavChannelApi.moveWebDavObject(
      davConfig,
      oldPath,
      newPath,
    );
    if (moveResult.error) {
      console.error(JSON.stringify({ message: "webdav move failed", error: moveResult.error.message }));
      return err({ reason: "WEBDAV_MOVE_FAILED" });
    }

    await MediaRepo.updateMediaKeyAndName(
      context.db,
      oldPath,
      newPath,
      media.fileName,
      WebDavChannelApi.buildWebDavPublicUrl(davConfig, newPath),
    );
    return ok({ success: true });
  }

  // Message-based channels have no folder concept to move into.
  if (provider === "telegram" || provider === "discord") {
    return err({ reason: "UNSUPPORTED_PROVIDER" });
  }

  // R2: copy + delete
  if (!provider || provider === "r2") {
    const media = await MediaRepo.getMediaByKey(context.db, data.key);
    if (!media) return err({ reason: "MEDIA_NOT_FOUND" });

    const oldKey = data.key;
    const fileName = oldKey.split("/").pop() ?? oldKey;
    const targetFolder = normalizeFolderPath(data.targetFolder ?? "");
    const newKey = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    if (oldKey === newKey) {
      return ok({ success: true });
    }

    await Storage.copyObject(context.env, oldKey, newKey);
    context.executionCtx.waitUntil(
      Storage.deleteFromR2(context.env, oldKey).catch((e) =>
        console.error(JSON.stringify({ message: "r2 move delete failed", key: oldKey, error: e instanceof Error ? e.message : String(e) })),
      ),
    );

    const newUrl = `/images/${newKey}`;
    await MediaRepo.updateMediaKeyAndName(context.db, oldKey, newKey, media.fileName, newUrl);
    return ok({ success: true });
  }

  return err({ reason: "UNSUPPORTED_PROVIDER" });
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
  const folder = normalizeFolderPath(data.folder ?? "");
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

  // S3 folder rename
  if (data.providerId === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return err({ reason: "S3_NOT_CONFIGURED" });

    const mediaRecords = await MediaRepo.getMediaByKeyPrefix(context.db, folderKey);

    const keysResult = await listAllS3Keys(s3Config, folderKey);
    if (keysResult.error) return err({ reason: "S3_RENAME_FAILED" });

    const keys = keysResult.data;
    if (keys.length > 0) {
      const operations = keys.map((sourceKey) => ({
        oldKey: sourceKey,
        newKey: `${newKey}${sourceKey.slice(folderKey.length)}`,
      }));
      const moveResult = await moveS3Objects(s3Config, operations);
      if (moveResult.error) return err({ reason: "S3_RENAME_FAILED" });
    }

    // Rewrite D1 records with the new full key and a rebuilt public URL.
    for (const record of mediaRecords) {
      const recordNewKey = `${newKey}${record.key.slice(folderKey.length)}`;
      await MediaRepo.updateMediaKeyAndUrl(
        context.db,
        record.key,
        recordNewKey,
        buildS3PublicUrl(s3Config, recordNewKey),
      );
    }
    return ok({ key: newKey });
  }

  // HuggingFace folder rename: re-commit every file under the new prefix
  if (data.providerId === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });

    const mediaRecords = await MediaRepo.getMediaByKeyPrefix(context.db, folderKey);

    const pathsResult = await HuggingFaceChannelApi.listAllHuggingFacePaths(
      hfConfig,
      normalizeFolderPath(folderKey),
    );
    if (pathsResult.error) return err({ reason: "HUGGINGFACE_RENAME_FAILED" });

    for (const sourcePath of pathsResult.data) {
      const targetPath = `${normalizeFolderPath(newKey)}${sourcePath.slice(normalizeFolderPath(folderKey).length)}`;
      const moveResult = await HuggingFaceChannelApi.moveHuggingFaceFile(
        hfConfig,
        sourcePath,
        targetPath,
      );
      if (moveResult.error) {
        console.error(JSON.stringify({ message: "huggingface folder rename failed", path: sourcePath, error: moveResult.error.message }));
        return err({ reason: "HUGGINGFACE_RENAME_FAILED" });
      }
    }

    // Rewrite D1 records with the new full key and a rebuilt resolve URL.
    const cleanFolderKey = normalizeFolderPath(folderKey);
    const cleanNewKey = normalizeFolderPath(newKey);
    for (const record of mediaRecords) {
      if (!record.key.startsWith(cleanFolderKey)) continue;
      const recordNewKey = `${cleanNewKey}${record.key.slice(cleanFolderKey.length)}`;
      await MediaRepo.updateMediaKeyAndUrl(
        context.db,
        record.key,
        recordNewKey,
        HuggingFaceChannelApi.buildHfResolveUrl(hfConfig.repo!.trim(), recordNewKey),
      );
    }
    return ok({ key: newKey });
  }

  // WebDAV folder rename: MOVE the collection on the server
  if (data.providerId === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });

    const mediaRecords = await MediaRepo.getMediaByKeyPrefix(context.db, folderKey);

    const moveResult = await WebDavChannelApi.moveWebDavObject(
      davConfig,
      normalizeFolderPath(folderKey),
      normalizeFolderPath(newKey),
    );
    if (moveResult.error) {
      console.error(JSON.stringify({ message: "webdav folder rename failed", error: moveResult.error.message }));
      return err({ reason: "WEBDAV_RENAME_FAILED" });
    }

    for (const record of mediaRecords) {
      if (!record.key.startsWith(folderKey)) continue;
      const recordNewKey = `${newKey}${record.key.slice(folderKey.length)}`;
      await MediaRepo.updateMediaKeyAndUrl(
        context.db,
        record.key,
        recordNewKey,
        WebDavChannelApi.buildWebDavPublicUrl(davConfig, recordNewKey),
      );
    }
    return ok({ key: newKey });
  }

  // Unknown external providers must never fall through to R2 operations.
  if (data.providerId && data.providerId !== "r2") {
    return err({ reason: "UNSUPPORTED_PROVIDER" });
  }

  // R2 folder rename (default)
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

  // S3 folder delete
  if (data.providerId === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return err({ reason: "S3_NOT_CONFIGURED" });

    for (const folder of data.keys) {
      const folderKey = Storage.normalizeFolderKey(folder);
      if (!folderKey) continue;

      const keysResult = await listAllS3Keys(s3Config, folderKey);
      if (keysResult.error) continue;

      const allKeys = keysResult.data;
      const fileKeys = allKeys.filter((k) => !k.endsWith("/"));
      const linkedKeys = new Set(
        await PostMediaRepo.getLinkedMediaKeys(context.db, fileKeys),
      );

      const toDeleteFiles = fileKeys.filter((k) => !linkedKeys.has(k));
      // Also remove zero-byte folder markers so the folder really disappears.
      const markers = allKeys.filter((k) => k.endsWith("/"));
      const toDelete = [...toDeleteFiles, ...markers];
      if (toDelete.length > 0) {
        await deleteS3Objects(s3Config, toDelete);
      }
      await MediaRepo.deleteMediaByKeys(context.db, toDeleteFiles);

      deletedFiles += toDeleteFiles.length;
      skippedFiles += fileKeys.length - toDeleteFiles.length;
    }

    return ok({ deletedFolders: data.keys.length, deletedFiles, skippedFiles });
  }

  // HuggingFace folder delete: recursive tree walk + batched deletedFile commits
  if (data.providerId === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });

    for (const folder of data.keys) {
      const cleanFolder = normalizeFolderPath(folder);
      if (!cleanFolder) continue;

      const pathsResult = await HuggingFaceChannelApi.listAllHuggingFacePaths(
        hfConfig,
        cleanFolder,
      );
      if (pathsResult.error) continue;

      const fileKeys = pathsResult.data;
      const linkedKeys = new Set(
        await PostMediaRepo.getLinkedMediaKeys(context.db, fileKeys),
      );

      const toDeleteFiles = fileKeys.filter((k) => !linkedKeys.has(k));
      if (toDeleteFiles.length > 0) {
        const result = await HuggingFaceChannelApi.deleteHuggingFaceFiles(hfConfig, toDeleteFiles);
        if (result.error) {
          console.error(JSON.stringify({ message: "huggingface folder delete failed", error: result.error.message }));
          continue;
        }
      }
      await MediaRepo.deleteMediaByKeys(context.db, toDeleteFiles);

      deletedFiles += toDeleteFiles.length;
      skippedFiles += fileKeys.length - toDeleteFiles.length;
    }

    return ok({ deletedFolders: data.keys.length, deletedFiles, skippedFiles });
  }

  // WebDAV folder delete: enumerate files first so linked files survive
  if (data.providerId === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return err({ reason: "PROVIDER_NOT_CONFIGURED" });

    for (const folder of data.keys) {
      const folderKey = Storage.normalizeFolderKey(folder);
      if (!folderKey) continue;

      const pathsResult = await WebDavChannelApi.listAllWebDavFilePaths(
        davConfig,
        normalizeFolderPath(folderKey),
      );
      if (pathsResult.error) continue;

      const fileKeys = pathsResult.data;
      const linkedKeys = new Set(
        await PostMediaRepo.getLinkedMediaKeys(context.db, fileKeys),
      );

      const toDeleteFiles = fileKeys.filter((k) => !linkedKeys.has(k));
      if (toDeleteFiles.length > 0) {
        const result = await WebDavChannelApi.deleteWebDavPaths(davConfig, toDeleteFiles);
        if (result.error) {
          console.error(JSON.stringify({ message: "webdav folder delete failed", error: result.error.message }));
          continue;
        }
      }
      await MediaRepo.deleteMediaByKeys(context.db, toDeleteFiles);

      deletedFiles += toDeleteFiles.length;
      skippedFiles += fileKeys.length - toDeleteFiles.length;
    }

    return ok({ deletedFolders: data.keys.length, deletedFiles, skippedFiles });
  }

  // Unknown external providers must never fall through to R2 operations.
  if (data.providerId && data.providerId !== "r2") {
    return err({ reason: "UNSUPPORTED_PROVIDER" });
  }

  // R2 folder delete (default)
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

    const headersToKeep = ["user-agent", "accept", "referer"];
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
  return resolveValidatedS3Config(config?.imageHosting?.s3);
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
    canRename: true,
    canMove: true,
    isDefault: activeProvider === null || activeProvider === "r2-native",
    maxFileSizeBytes: resolveR2NativeMaxBytes(),
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
      canRename: true,
      canMove: true,
      isDefault: isActive("s3"),
      maxFileSizeBytes: resolveS3MaxBytes(ih?.s3),
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
      maxFileSizeBytes:
        p.type === "imgbb"
          ? resolveImgbbMaxBytes()
          : resolveFfskyMaxBytes(),
    });
  }

  // Telegram — D1-index listing; real remote delete via Bot API.
  // No rename/move/folders: messages cannot be edited into other "paths".
  if (ih?.telegram?.botToken?.trim() && ih?.telegram?.chatId?.trim()) {
    providers.push({
      id: "telegram",
      name: "Telegram",
      type: "telegram",
      canList: true,
      canDelete: true,
      canUpload: true,
      canCreateFolder: false,
      canRename: false,
      canMove: false,
      isDefault: isActive("telegram"),
      maxFileSizeBytes: resolveTelegramMaxBytes(ih.telegram),
    });
  }

  // Discord — authoritative channel-history listing; real remote delete.
  if (ih?.discord?.botToken?.trim() && ih?.discord?.channelId?.trim()) {
    providers.push({
      id: "discord",
      name: "Discord",
      type: "discord",
      canList: true,
      canDelete: true,
      canUpload: true,
      canCreateFolder: false,
      canRename: false,
      canMove: false,
      isDefault: isActive("discord"),
      maxFileSizeBytes: resolveDiscordMaxBytes(ih.discord),
    });
  }

  // HuggingFace — full CRUD via the datasets commit protocol
  if (ih?.huggingface?.token?.trim() && ih?.huggingface?.repo?.trim()) {
    providers.push({
      id: "huggingface",
      name: "HuggingFace",
      type: "huggingface",
      canList: true,
      canDelete: true,
      canUpload: true,
      canCreateFolder: true,
      canRename: true,
      canMove: true,
      isDefault: isActive("huggingface"),
      maxFileSizeBytes: resolveHuggingFaceMaxBytes(ih.huggingface),
    });
  }

  // WebDAV — full CRUD via PROPFIND/MKCOL/MOVE/DELETE
  if (ih?.webdav?.baseUrl?.trim()) {
    providers.push({
      id: "webdav",
      name: "WebDAV",
      type: "webdav",
      canList: true,
      canDelete: true,
      canUpload: true,
      canCreateFolder: true,
      canRename: true,
      canMove: true,
      isDefault: isActive("webdav"),
      maxFileSizeBytes: resolveWebDavMaxBytes(ih.webdav),
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

  // Telegram & API-Key: D1 index only. The Telegram Bot API cannot
  // enumerate chat history, so the blog's own upload index is the only
  // possible (and authoritative-for-blog) view of these channels.
  if (provider === "telegram" || provider === "api-key") {
    return listExternalDirectoryFromD1(context, data);
  }

  // S3, Discord, HuggingFace, WebDAV: the remote channel listing is
  // authoritative and complete — anything uploaded outside the blog shows
  // up and remotely deleted files disappear. No D1 merge, otherwise records
  // whose real object is gone would linger and duplicates would appear.
  return listExternalDirectoryDirect(context, data);
}

async function listExternalDirectoryFromD1(
  context: DbContext & { executionCtx: ExecutionContext },
  data: ListExternalDirectoryInput,
): Promise<ExternalDirectoryResult> {
  const provider = data.providerId;
  const search = data.search?.trim();

  const { items, nextCursor } = await MediaRepo.getMediaByProvider(context.db, provider, {
    limit: DEFAULT_DIRECTORY_LIMIT,
    search,
    cursor: data.continuationToken ? Number(data.continuationToken) : undefined,
  });

  // 对外展示/复制的链接按访问模式计算（Telegram/Discord 恒为代理地址）
  const config = await ConfigService.getSystemConfig(context);
  const accessSettings = getLinkAccessSettings(config);

  const files: ExternalDirectoryFile[] = items.map((item) => ({
    key: item.key,
    name: item.fileName,
    url: buildMediaAccessUrl(accessSettings, provider, item.key, item.url),
    mimeType: item.mimeType,
    sizeInBytes: item.sizeInBytes,
  }));

  return {
    files,
    folders: [],
    nextContinuationToken: nextCursor ? String(nextCursor) : null,
  };
}

/** 按访问模式把渠道直链转换为对外地址（Telegram/Discord 恒代理，其余 protected 时代理） */
function withAccessUrls(
  config: Awaited<ReturnType<typeof ConfigService.getSystemConfig>>,
  provider: string,
  files: ExternalDirectoryFile[],
): ExternalDirectoryFile[] {
  const settings = getLinkAccessSettings(config);
  return files.map((f) => ({
    ...f,
    url: buildMediaAccessUrl(settings, provider, f.key, f.url),
  }));
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

    // Browse the REAL bucket root: the configured pathPrefix appears as a
    // regular folder, exactly like the actual S3 storage layout.
    const folder = normalizeFolderPath(data.folder ?? "");
    const result = await listS3Objects(s3Config, {
      prefix: folder ? `${folder}/` : "",
      delimiter: "/",
      continuationToken: data.continuationToken,
    });

    if (result.error) {
      console.error(JSON.stringify({ message: "s3 list failed", error: result.error.message }));
      return { files: [], folders: [], nextContinuationToken: null, error: result.error.message };
    }

    // Zero-byte keys ending with "/" are folder markers — hide them from files.
    const files: ExternalDirectoryFile[] = result.data.objects
      .filter((o) => !o.key.endsWith("/"))
      .map((o) => ({
        key: o.key,
        name: getBasename(o.key),
        url: buildS3PublicUrl(s3Config, o.key),
        mimeType: guessMimeFromKey(o.key),
        sizeInBytes: o.size,
      }));

    return {
      files: withAccessUrls(config, provider, files),
      // Trailing-slash keys keep frontend folder detection (isFolderKey)
      // consistent with the R2 provider.
      folders: result.data.prefixes.map((p) => ({ key: `${p}/`, name: getBasename(p) })),
      nextContinuationToken: result.data.isTruncated
        ? (result.data.nextContinuationToken ?? null)
        : null,
    };
  }

  if (provider === "discord") {
    const config = await ConfigService.getSystemConfig(context);
    const discordConfig = resolveDiscordConfig(config);
    if (!discordConfig) return { files: [], folders: [], nextContinuationToken: null, error: "Discord 未配置" };

    // Page through the real channel history; every attachment becomes an
    // entry keyed by `${messageId}:${index}` so deletion maps back to the
    // exact message that carries it.
    const page = await DiscordChannelApi.listDiscordAttachments(
      discordConfig,
      data.continuationToken || undefined,
    );

    if (page.error) {
      console.error(JSON.stringify({ message: "discord list failed", error: page.error.message }));
      return { files: [], folders: [], nextContinuationToken: null, error: page.error.message };
    }

    return {
      files: withAccessUrls(
        config,
        provider,
        page.data.files.map((f) => ({
          key: f.key,
          name: f.name,
          url: f.url,
          mimeType: f.mimeType,
          sizeInBytes: f.sizeInBytes,
        })),
      ),
      folders: [],
      nextContinuationToken: page.data.nextBefore,
    };
  }

  if (provider === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return { files: [], folders: [], nextContinuationToken: null, error: "HuggingFace 未配置" };

    const folder = normalizeFolderPath(data.folder ?? "");
    const result = await HuggingFaceChannelApi.listHuggingFaceDirectory(
      hfConfig,
      folder,
    );

    if (result.error) {
      console.error(JSON.stringify({ message: "huggingface list failed", error: result.error.message }));
      return { files: [], folders: [], nextContinuationToken: null, error: result.error.message };
    }

    return {
      files: withAccessUrls(config, provider, result.data.files),
      folders: result.data.folders,
      nextContinuationToken: null,
    };
  }

  if (provider === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return { files: [], folders: [], nextContinuationToken: null, error: "WebDAV 未配置" };

    const folder = normalizeFolderPath(data.folder ?? "");
    const result = await WebDavChannelApi.listWebDavDirectory(davConfig, folder);

    if (result.error) {
      console.error(JSON.stringify({ message: "webdav list failed", error: result.error.message }));
      return { files: [], folders: [], nextContinuationToken: null, error: result.error.message };
    }

    return {
      files: withAccessUrls(config, provider, result.data.files),
      folders: result.data.folders,
      nextContinuationToken: null,
    };
  }

  return { files: [], folders: [], nextContinuationToken: null };
}

export async function deleteExternalFiles(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteExternalFilesInput,
): Promise<{ deleted: number; skipped: number }> {
  const provider = data.providerId;
  const keys = data.keys;

  // Delete from the REAL channel first; only keys whose remote deletion
  // succeeded (or never had a remote object) are removed from the D1 index,
  // so failed entries stay visible and can be retried.
  let okKeys = keys;
  let skipped = 0;

  if (provider === "s3") {
    const config = await ConfigService.getSystemConfig(context);
    const s3Config = resolveS3ConfigForMedia(config);
    if (!s3Config) return { deleted: 0, skipped: keys.length };
    const result = await deleteS3Objects(s3Config, keys);
    if (result.error) {
      console.error(JSON.stringify({ message: "s3 delete failed", error: result.error.message }));
      return { deleted: 0, skipped: keys.length };
    }
  }

  if (provider === "huggingface") {
    const config = await ConfigService.getSystemConfig(context);
    const hfConfig = resolveHuggingFaceConfig(config);
    if (!hfConfig) return { deleted: 0, skipped: keys.length };

    const result = await HuggingFaceChannelApi.deleteHuggingFaceFiles(hfConfig, keys);
    if (result.error) {
      console.error(JSON.stringify({ message: "huggingface delete failed", error: result.error.message }));
      return { deleted: 0, skipped: keys.length };
    }
  }

  if (provider === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return { deleted: 0, skipped: keys.length };

    const result = await WebDavChannelApi.deleteWebDavPaths(davConfig, keys);
    if (result.error) {
      console.error(JSON.stringify({ message: "webdav delete failed", error: result.error.message }));
      return { deleted: 0, skipped: keys.length };
    }
  }

  if (provider === "discord") {
    const config = await ConfigService.getSystemConfig(context);
    const dcConfig = resolveDiscordConfig(config);
    if (!dcConfig) return { deleted: 0, skipped: keys.length };

    const failedKeys: string[] = [];
    for (const key of keys) {
      const result = await DiscordChannelApi.deleteDiscordMessage(dcConfig, key);
      if (result.error) {
        console.error(JSON.stringify({ message: "discord delete failed", key, error: result.error.message }));
        failedKeys.push(key);
      }
    }
    skipped += failedKeys.length;
    okKeys = keys.filter((k) => !failedKeys.includes(k));
  }

  if (provider === "telegram") {
    const config = await ConfigService.getSystemConfig(context);
    const tgConfig = resolveTelegramConfig(config);

    const failedKeys: string[] = [];
    for (const key of keys) {
      // 键形如 `telegram/{messageId}:{fileId}`（旧版为纯 messageId）；
      // 合成键（`telegram/{ts}-{uuid}`）没有远程消息可删。
      const { messageId } = TelegramChannelApi.parseTelegramKey(key);
      if (!tgConfig || !/^\d+$/.test(messageId)) continue;

      const result = await TelegramChannelApi.deleteTelegramMessage(tgConfig, messageId);
      if (result.error) {
        console.error(JSON.stringify({ message: "telegram delete failed", key, error: result.error.message }));
        failedKeys.push(key);
      }
    }
    skipped += failedKeys.length;
    okKeys = keys.filter((k) => !failedKeys.includes(k));
  }

  await MediaRepo.deleteMediaByKeys(context.db, okKeys);
  return { deleted: okKeys.length, skipped };
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

    // joinFolderKey already ends with a single trailing slash — this creates
    // a real zero-byte folder marker object in the bucket.
    const result = await uploadToS3(s3Config, {
      key: folderKey,
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
    const folderPath = normalizeFolderPath(joinFolderKey(parent, name));

    const result = await HuggingFaceChannelApi.createHuggingFaceFolder(hfConfig, folderPath);
    if (result.error) {
      console.error(JSON.stringify({ message: "huggingface create folder failed", error: result.error.message }));
      return err({ reason: "HUGGINGFACE_FOLDER_CREATE_FAILED" });
    }

    return ok({ key: folderPath, name });
  }

  if (data.providerId === "webdav") {
    const config = await ConfigService.getSystemConfig(context);
    const davConfig = resolveWebDAVConfig(config);
    if (!davConfig) return err({ reason: "WebDAV 未配置" });

    const name = data.name.replace(/^\/+|\/+$/g, "").trim();
    if (!name || name.includes("/")) return err({ reason: "MEDIA_INVALID_FOLDER_NAME" });

    const parent = normalizeFolderPath(data.parent ?? "");
    const folderPath = normalizeFolderPath(joinFolderKey(parent, name));

    const result = await WebDavChannelApi.ensureWebDavFolder(davConfig, folderPath);
    if (result.error) {
      console.error(JSON.stringify({ message: "webdav create folder failed", error: result.error.message }));
      return err({ reason: "WEBDAV_FOLDER_CREATE_FAILED" });
    }

    return ok({ key: folderPath, name });
  }

  return err({ reason: "UNSUPPORTED_PROVIDER" });
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
