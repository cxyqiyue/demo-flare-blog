// 从 DB schema 推断类型，避免重复定义
export type { Media as MediaAsset } from "@/features/media/data/media.data";

export interface MediaDirectoryFile {
  key: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeInBytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date | null;
  isLinked: boolean;
}

export interface MediaFolder {
  key: string;
  name: string;
}

export interface MediaDirectory {
  folder: string;
  folders: Array<MediaFolder>;
  files: Array<MediaDirectoryFile>;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UploadItem {
  id: string;
  name: string;
  size: string;
  progress: number;
  status: "WAITING" | "UPLOADING" | "COMPLETE" | "ERROR";
  log: string;
  file?: File;
  folder?: string;
}
