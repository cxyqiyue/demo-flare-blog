import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { getCommentImageHostingConfigFn } from "@/features/image-hosting/api/image-hosting.api";
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

  const openUpload = useCallback(async (): Promise<string | null> => {
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

      const timeoutTimer = window.setTimeout(() => settle(null), POPUP_TIMEOUT_MS);

      window.addEventListener("message", onMessage);
    });
  }, []);

  return { enabled, openUpload };
}
