import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  getCommentImageHostingConfigFn,
  uploadCommentImageFn,
} from "@/features/image-hosting/api/image-hosting.api";
import { IMGBB_UPLOAD_PAGE } from "@/features/image-hosting/image-hosting.schema";
import { extractImageUrlFromMarkdown } from "@/features/image-hosting/utils/extract-image-url";
import { handleServerError } from "@/lib/errors/error-handler";
import { parseRequestError } from "@/lib/errors/request-errors";
import { processImageBeforeUpload } from "@/lib/image-processing";
import { m } from "@/paraglide/messages";

const COMMENT_IMAGE_HOSTING_CONFIG_KEY = [
  "image-hosting",
  "comment-config",
] as const;

interface UploadPluginWindow extends Window {
  uploadPlugin?: Record<string, { autoInsert: string }>;
}

const POPUP_TIMEOUT_MS = 5 * 60 * 1000;

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

/**
 * 服务端上传（S3 / R2 原生 / 图床代理）：文件选择器批量上传，返回图片 URL 列表。
 * 上传前按渠道设置进行压缩 / 格式转换。
 */
function uploadViaFileInput(policy: {
  maxImageBytes: number | null;
  compressEnabled: boolean;
  convertToFormat: "none" | "webp" | "jpeg";
}): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ALLOWED_IMAGE_MIME_TYPES.join(",");
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) {
        resolve([]);
        return;
      }
      const urls: string[] = [];
      let failed = false;
      for (const rawFile of files) {
        try {
          const { file } = await processImageBeforeUpload(rawFile, {
            maxBytes: policy.maxImageBytes,
            compressEnabled: policy.compressEnabled,
            convertToFormat: policy.convertToFormat,
          });
          const formData = new FormData();
          formData.append("image", file);
          const result = await uploadCommentImageFn({ data: formData });
          if (result.error) {
            failed = true;
            toast.error(m.comments_editor_upload_failed(), {
              description: result.error.message,
            });
            continue;
          }
          urls.push(result.data.url);
        } catch (error) {
          failed = true;
          const parsed = parseRequestError(error);
          if (parsed.code === "UNKNOWN") {
            toast.error(m.comments_editor_upload_failed(), {
              description: parsed.message || undefined,
            });
          } else {
            handleServerError(error);
          }
        }
      }
      if (urls.length > 0 && !failed) {
        toast.success(m.comments_editor_upload_success());
      }
      resolve(urls);
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

function generateWindowName(): string {
  let randomPart = "";
  try {
    randomPart = crypto.randomUUID();
  } catch {
    randomPart = "";
  }
  if (!randomPart) {
    randomPart = `${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2)}`;
  }
  return `imgbb_${randomPart}`;
}

export function useCommentImageUploader() {
  const { data } = useQuery({
    queryKey: COMMENT_IMAGE_HOSTING_CONFIG_KEY,
    queryFn: getCommentImageHostingConfigFn,
    staleTime: 60_000,
  });

  const enabled = data?.enabled ?? false;
  const providerCategory = data?.providerCategory ?? null;
  const providerType = data?.providerType;
  const policy = {
    maxImageBytes: data?.maxImageBytes ?? null,
    compressEnabled: data?.compressEnabled ?? true,
    convertToFormat: data?.convertToFormat ?? ("none" as const),
  };

  const openUpload = useCallback(async (): Promise<string[]> => {
    // R2 原生 / S3 / api-key 中非 imgbb 的 → 使用文件选择器
    if (
      providerCategory === "r2-native" ||
      providerCategory === "s3" ||
      (providerCategory === "api-key" && providerType !== "imgbb")
    ) {
      return await uploadViaFileInput(policy);
    }

    // ImgBB → 弹窗上传（单张）
    const winName = generateWindowName();

    const hostWindow = window as UploadPluginWindow;
    hostWindow.uploadPlugin = {
      ...hostWindow.uploadPlugin,
      [winName]: { autoInsert: "markdown-embed-medium" },
    };

    const popup = window.open(
      IMGBB_UPLOAD_PAGE,
      winName,
      "width=900,height=620,left=120,top=120",
    );

    if (!popup) {
      toast.error(m.comments_editor_upload_failed(), {
        description: m.comments_editor_upload_popup_blocked(),
      });
      return [];
    }

    return new Promise<string[]>((resolve) => {
      let settled = false;

      const cleanup = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        window.clearInterval(pollTimer);
        window.clearTimeout(timeoutTimer);
        if (hostWindow.uploadPlugin) {
          delete hostWindow.uploadPlugin[winName];
        }
      };

      const settle = (url: string | null) => {
        cleanup();
        if (url) {
          toast.success(m.comments_editor_upload_success());
          resolve([url]);
          return;
        }
        resolve([]);
      };

      const onMessage = (event: MessageEvent) => {
        if (event.source !== popup) return;
        if (event.data?.id !== winName) return;
        settle(extractImageUrlFromMarkdown(event.data.message));
      };

      const pollTimer = window.setInterval(() => {
        if (popup.closed) settle(null);
      }, 500);

      const timeoutTimer = window.setTimeout(
        () => settle(null),
        POPUP_TIMEOUT_MS,
      );

      window.addEventListener("message", onMessage);
    });
  }, [providerCategory, providerType, policy]);

  return { enabled, providerCategory, openUpload };
}
