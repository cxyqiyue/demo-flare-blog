import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  getCommentImageHostingConfigFn,
  uploadCommentImageFn,
} from "@/features/image-hosting/api/image-hosting.api";
import { IMGBB_UPLOAD_PAGE } from "@/features/image-hosting/image-hosting.schema";
import { extractImageUrlFromMarkdown } from "@/features/image-hosting/utils/extract-image-url";
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
 * 服务端上传（S3 兼容存储 / 图床代理）：文件选择器上传，返回图片 URL。
 */
function uploadViaFileInput(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ALLOWED_IMAGE_MIME_TYPES.join(",");
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const formData = new FormData();
        formData.append("image", file);
        const result = await uploadCommentImageFn({ data: formData });
        if (result.error) {
          toast.error(m.comments_editor_upload_failed(), {
            description: result.error.message,
          });
          resolve(null);
          return;
        }
        toast.success(m.comments_editor_upload_success());
        resolve(result.data.url);
      } catch {
        toast.error(m.comments_editor_upload_failed());
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
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
  const provider = data?.provider ?? null;

  const openUpload = useCallback(async (): Promise<string | null> => {
    if (provider === "s3") {
      return await uploadViaFileInput();
    }

    const winName = generateWindowName();

    // Chevereto Upload Plugin (PUP) protocol: register the auto-insert target
    // on our own window before opening the popup. The popup reads
    // `window.opener.uploadPlugin[window.name]` and posts back the embed code.
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
      return null;
    }

    return new Promise<string | null>((resolve) => {
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
        }
        resolve(url);
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
  }, [provider]);

  return { enabled, provider, openUpload };
}
