import { z } from "zod";
import type { Messages } from "@/lib/i18n";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const UploadMediaInputSchema = z.instanceof(FormData);

export function parseUploadMediaInput(formData: FormData, messages: Messages) {
  const file = formData.get("image");
  if (!(file instanceof File)) {
    throw new Error(messages.media_validation_file_required());
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(messages.media_validation_file_too_large());
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(messages.media_validation_file_invalid_type());
  }

  const folderRaw = formData.get("folder");
  const folder =
    typeof folderRaw === "string" ? folderRaw.trim() : "";

  return { file, folder };
}

export const MediaKeyInputSchema = z.object({
  key: z.string(),
});

export function assertMediaKey(key: string, messages: Messages) {
  const trimmedKey = key.trim();
  if (trimmedKey.length === 0) {
    throw new Error(messages.media_validation_key_required());
  }

  return trimmedKey;
}

export const UpdateMediaNameInputSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
});

export const GetMediaListInputSchema = z.object({
  cursor: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  unusedOnly: z.boolean().optional(),
});

export const GetMediaDirectoryInputSchema = z.object({
  folder: z.string().max(500).default(""),
  cursor: z.string().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  unusedOnly: z.boolean().optional(),
});

export const CreateMediaFolderInputSchema = z.object({
  name: z.string().min(1).max(200),
  parent: z.string().max(500).default(""),
});

export const RenameMediaFolderInputSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).max(200),
});

export const DeleteMediaFoldersInputSchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(500),
});

export type UpdateMediaNameInput = z.infer<typeof UpdateMediaNameInputSchema>;
export type GetMediaListInput = z.infer<typeof GetMediaListInputSchema>;
export type GetMediaDirectoryInput = z.infer<typeof GetMediaDirectoryInputSchema>;
export type CreateMediaFolderInput = z.infer<typeof CreateMediaFolderInputSchema>;
export type RenameMediaFolderInput = z.infer<typeof RenameMediaFolderInputSchema>;
export type DeleteMediaFoldersInput = z.infer<typeof DeleteMediaFoldersInputSchema>;
