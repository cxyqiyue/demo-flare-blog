import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MediaProvider } from "@/features/media/media.schema";
import { MEDIA_KEYS } from "@/features/media/queries";
import { formatBytes } from "@/lib/utils";
import { xhrUpload } from "@/lib/xhr-upload";
import { m } from "@/paraglide/messages";
import type { UploadItem } from "../types";

interface UseMediaUploadOptions {
  provider: MediaProvider | undefined;
}

export type InputFile = File | { file: File; relativePath: string };

interface WalkedEntry {
  file: File;
  relativePath: string;
}

function readAllEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function walkEntry(
  entry: FileSystemEntry,
  path: string,
  out: WalkedEntry[],
): Promise<void> {
  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntry);
    out.push({ file, relativePath: path ? `${path}/${file.name}` : file.name });
    return;
  }
  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const childPath = path ? `${path}/${dirEntry.name}` : dirEntry.name;
    const reader = dirEntry.createReader();
    const entries = await readAllEntries(reader);
    for (const child of entries) {
      await walkEntry(child, childPath, out);
    }
  }
}

/**
 * 从拖拽事件中递归提取文件。支持拖入文件夹（webkitGetAsEntry），
 * 不支持目录 API 的浏览器回退为拍平文件列表。
 */
export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<WalkedEntry[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const hasDirectoryItem = items.some(
    (item) =>
      item.kind === "file" &&
      typeof item.webkitGetAsEntry === "function" &&
      item.webkitGetAsEntry()?.isDirectory,
  );

  if (hasDirectoryItem) {
    const out: WalkedEntry[] = [];
    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.();
      if (entry) await walkEntry(entry, "", out);
    }
    if (out.length > 0) return out;
  }

  return Array.from(dataTransfer.files).map((file) => ({
    file,
    relativePath: "",
  }));
}

export function useMediaUpload({ provider }: UseMediaUploadOptions) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [queue, setQueue] = useState<Array<UploadItem>>([]);
  const [isDragging, setIsDragging] = useState(false);

  const processingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updateItem = (
    waitingIndex: number,
    patch: Partial<UploadItem> | ((item: UploadItem) => Partial<UploadItem>),
  ) => {
    setQueue((prev) =>
      prev.map((q, i) => {
        if (i !== waitingIndex) return q;
        const extra = typeof patch === "function" ? patch(q) : patch;
        return { ...q, ...extra };
      }),
    );
  };

  // Process upload queue
  useEffect(() => {
    const processQueue = async () => {
      const waitingIndex = queue.findIndex((item) => item.status === "WAITING");
      const item = queue[waitingIndex];

      if (waitingIndex === -1 || processingRef.current) return;
      processingRef.current = true;

      if (!item.file) {
        updateItem(waitingIndex, {
          status: "ERROR",
          log: m.media_upload_log_error_no_data(),
        });
        processingRef.current = false;
        return;
      }

      updateItem(waitingIndex, {
        status: "UPLOADING",
        progress: 0,
        log: m.media_upload_log_stream_sending(),
      });

      try {
        const formData = new FormData();
        formData.append("image", item.file);
        if (item.folder) {
          formData.append("folder", item.folder);
        }
        const isProviderUpload =
          provider && provider.type !== "r2" && Boolean(provider.id);
        if (isProviderUpload) {
          formData.append("providerId", provider?.id ?? "");
        } else {
          formData.append("source", "media-library");
        }

        const result = await xhrUpload<{ url?: string }>({
          url: isProviderUpload
            ? "/api/media/upload/provider"
            : "/api/media/upload",
          formData,
          onProgress: (fraction) => {
            updateItem(waitingIndex, () => ({
              progress: Math.max(1, Math.round(fraction * 100)),
            }));
          },
        });

        if (!result.ok || !isMountedRef.current) {
          if (!result.ok) {
            const message = result.message || m.media_upload_error_db();
            updateItem(waitingIndex, {
              status: "ERROR",
              progress: 0,
              log: m.media_upload_log_error({ message }),
            });
            toast.error(m.media_upload_fail({ name: item.name }), {
              description: message,
            });
          }
          return;
        }

        updateItem(waitingIndex, {
          status: "COMPLETE",
          progress: 100,
          log: m.media_upload_log_complete(),
        });
        toast.success(m.media_upload_success({ name: item.name }));
        queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      } catch (error) {
        if (isMountedRef.current) {
          const message =
            error instanceof Error
              ? error.message
              : m.request_error_unknown_title();
          updateItem(waitingIndex, {
            status: "ERROR",
            progress: 0,
            log: m.media_upload_log_error({ message }),
          });
          toast.error(m.media_upload_fail({ name: item.name }), {
            description: message,
          });
        }
      } finally {
        processingRef.current = false;
      }
    };

    processQueue();
  }, [queue, provider, queryClient]);

  const processFiles = (files: Array<InputFile>, folder = "") => {
    const limitBytes = provider?.maxFileSizeBytes ?? null;
    const newItems: Array<UploadItem> = files.map((entry) => {
      const file = entry instanceof File ? entry : entry.file;
      const rel = (
        entry instanceof File
          ? (entry.webkitRelativePath ?? "")
          : (entry.relativePath ?? "")
      ).replace(/^\/+/, "");
      // folder 上传：把相对子目录拼接进目标文件夹，保留目录结构
      let targetFolder = folder ?? "";
      if (rel) {
        const parts = rel.split("/");
        parts.pop();
        if (parts.length > 0) {
          const relDir = parts.join("/");
          targetFolder = targetFolder ? `${targetFolder}/${relDir}` : relDir;
        }
      }
      const displayName = rel || file.name;
      // 上传前判断渠道大小限制：超限文件直接标记失败，不发起上传
      if (limitBytes !== null && file.size > limitBytes) {
        return {
          id: Math.random().toString(36).substr(2, 9),
          name: displayName,
          size: formatBytes(file.size),
          progress: 0,
          status: "ERROR" as const,
          log: m.media_upload_file_too_large_channel({
            limit: String(Math.round(limitBytes / 1024 / 1024)),
          }),
          file,
          folder: targetFolder,
        };
      }
      return {
        id: Math.random().toString(36).substr(2, 9),
        name: displayName,
        size: formatBytes(file.size),
        progress: 0,
        status: "WAITING" as const,
        log: m.media_upload_log_init(),
        file,
        folder: targetFolder,
      };
    });
    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent, folder = "") => {
    e.preventDefault();
    setIsDragging(false);
    const files = await extractFilesFromDataTransfer(e.dataTransfer);
    if (files.length > 0) {
      processFiles(files, folder);
    }
  };

  const reset = () => {
    setQueue([]);
    processingRef.current = false;
    setIsOpen(false);
  };

  return {
    isOpen,
    setIsOpen,
    queue,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFiles,
    reset,
    canUpload: provider?.canUpload ?? false,
  };
}
