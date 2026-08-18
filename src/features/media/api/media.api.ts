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
  parseUploadMediaInput,
  RenameMediaFolderInputSchema,
  UpdateMediaNameInputSchema,
  UploadMediaInputSchema,
} from "@/features/media/media.schema";
import * as MediaService from "@/features/media/service/media.service";
import { adminMiddleware } from "@/lib/middlewares";
import { m } from "@/paraglide/messages";

export const uploadImageFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(UploadMediaInputSchema)
  .handler(({ data, context }) =>
    MediaService.upload(context, parseUploadMediaInput(data, m)),
  );

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
