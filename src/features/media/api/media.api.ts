import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  assertMediaKey,
  CreateMediaFolderInputSchema,
  DeleteExternalFilesInputSchema,
  DeleteMediaFoldersInputSchema,
  GetMediaDirectoryInputSchema,
  GetMediaListInputSchema,
  ListExternalDirectoryInputSchema,
  MediaKeyInputSchema,
  MoveMediaFileInputSchema,
  parseUploadMediaInput,
  RenameMediaFolderInputSchema,
  UpdateMediaNameInputSchema,
  UploadMediaInputSchema,
} from "@/features/media/media.schema";
import * as MediaService from "@/features/media/service/media.service";
import { resolveR2NativeMaxBytes } from "@/features/image-hosting/size-limits";
import { adminMiddleware } from "@/lib/middlewares";
import { m } from "@/paraglide/messages";

export const uploadImageFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(UploadMediaInputSchema)
  .handler(({ data, context }) => {
    // 媒体库管理员上传：允许任意文件类型，并放宽到 R2 渠道上限。
    // 编辑器回退路径不带 source 字段，仍保持 10MB / 仅图片限制。
    const isMediaLibrary =
      (data.get("source") as string | null) === "media-library";
    return MediaService.upload(
      context,
      parseUploadMediaInput(data, m, isMediaLibrary
        ? {
            allowAnyFileType: true,
            maxSizeBytes: resolveR2NativeMaxBytes() ?? undefined,
          }
        : undefined),
    );
  });

export const uploadToProviderFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(UploadMediaInputSchema)
  .handler(({ data, context }) => {
    const providerId = data.get("providerId") as string;
    const folder = (data.get("folder") as string) ?? "";
    const file = data.get("image");
    if (!(file instanceof File)) {
      throw new Error(m.media_validation_file_required());
    }
    return MediaService.uploadToProvider(context, { providerId, folder }, file);
  });

export const deleteImageFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(MediaKeyInputSchema)
  .handler(({ data, context }) =>
    MediaService.deleteImage(context, assertMediaKey(data.key, m)),
  );

export const getMediaFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(GetMediaListInputSchema)
  .handler(({ data, context }) => MediaService.getMediaList(context, data));

export const getLinkedPostsFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(MediaKeyInputSchema)
  .handler(({ data, context }) =>
    MediaService.getLinkedPosts(context, assertMediaKey(data.key, m)),
  );

export const getLinkedMediaKeysFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      keys: z.array(z.string()),
    }),
  )
  .handler(({ data, context }) =>
    MediaService.getLinkedMediaKeys(context, data.keys),
  );

export const getTotalMediaSizeFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => MediaService.getTotalMediaSize(context));

export const updateMediaNameFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(UpdateMediaNameInputSchema)
  .handler(({ data, context }) => MediaService.updateMediaName(context, data));

export const getMediaDirectoryFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(GetMediaDirectoryInputSchema)
  .handler(({ data, context }) =>
    MediaService.getMediaDirectory(context, data),
  );

export const createMediaFolderFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(CreateMediaFolderInputSchema)
  .handler(({ data, context }) => MediaService.createFolder(context, data));

export const renameMediaFolderFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(RenameMediaFolderInputSchema)
  .handler(({ data, context }) => MediaService.renameFolder(context, data));

export const deleteMediaFoldersFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(DeleteMediaFoldersInputSchema)
  .handler(({ data, context }) => MediaService.deleteFolders(context, data));

export const getMediaProvidersFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => MediaService.getMediaProviders(context));

export const listExternalDirectoryFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(ListExternalDirectoryInputSchema)
  .handler(({ data, context }) => MediaService.listExternalDirectory(context, data));

export const deleteExternalFilesFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(DeleteExternalFilesInputSchema)
  .handler(({ data, context }) => MediaService.deleteExternalFiles(context, data));

export const createExternalFolderFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      providerId: z.string(),
      name: z.string(),
      parent: z.string().optional(),
    }),
  )
  .handler(({ data, context }) => MediaService.createExternalFolder(context, data));

export const moveMediaFileFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(MoveMediaFileInputSchema)
  .handler(({ data, context }) => MediaService.moveMediaFile(context, data));
