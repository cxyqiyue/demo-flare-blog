/**
 * 上传进度 toast：sonner 原生不支持动态进度条，这里在 loading toast 的
 * description 里渲染一个带唯一 token 的进度条，更新时直接改 DOM 宽度。
 * 用于无弹窗场景（动态 / 关于页 / 评论 / 媒体库）的上传进度展示。
 */
import { toast } from "sonner";
import { m } from "@/paraglide/messages";

export interface UploadProgressToast {
  /** fraction ∈ [0,1] */
  update: (fraction: number) => void;
  /** 完成：关闭进度 toast（调用方自行展示成功/失败提示） */
  done: () => void;
}

export function showUploadProgressToast(fileName: string): UploadProgressToast {
  const token = `upt-${Math.random().toString(36).slice(2)}`;
  const toastId = toast.loading(m.upload_progress_active({ name: fileName }), {
    description: (
      <div
        data-upload-progress-track=""
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          data-upload-token={token}
          className="h-full w-0 rounded-full bg-primary transition-[width] duration-150 ease-out"
        />
      </div>
    ),
    duration: Infinity,
  });

  return {
    update(fraction: number) {
      const clamped = Math.max(0, Math.min(1, fraction));
      const fill = document.querySelector<HTMLElement>(
        `[data-upload-token="${token}"]`,
      );
      if (fill) {
        fill.style.width = `${Math.round(clamped * 100)}%`;
      }
    },
    done() {
      toast.dismiss(toastId);
    },
  };
}
