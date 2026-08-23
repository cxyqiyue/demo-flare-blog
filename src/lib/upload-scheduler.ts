/**
 * 客户端上传并发调度器：全局最多 MAX_CONCURRENT_UPLOADS 个上传同时在途，
 * 且相邻两次请求的发起间隔不小于 MIN_START_GAP_MS。
 *
 * 目的：部署环境若在 Cloudflare（或前置 CDN）上配置了速率限制规则，
 * 编辑器一次粘贴/拖入多张图片时不再以无上限并发触发限流（HTTP 429），
 * 配合 xhrUpload 的自动重试让批量上传平稳完成。
 */

export const MAX_CONCURRENT_UPLOADS = 2;
export const MIN_START_GAP_MS = 500;

let activeCount = 0;
/** 下一个任务最早允许的发起新时刻（单调节流） */
let nextAllowedStartAt = 0;
const waiters: Array<() => void> = [];

function pump(): void {
  if (waiters.length === 0) return;

  if (activeCount >= MAX_CONCURRENT_UPLOADS) return;

  const waitMs = nextAllowedStartAt - Date.now();
  if (waitMs > 0) {
    setTimeout(pump, waitMs);
    return;
  }

  const release = waiters.shift();
  if (!release) return;

  activeCount += 1;
  nextAllowedStartAt = Date.now() + MIN_START_GAP_MS;
  release();
}

/**
 * 在全局上传槽位内执行 task；等待期间按 FIFO 排队。
 * 返回值与异常都原样透传，槽位保证释放。
 */
export async function withUploadSlot<T>(task: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => {
    waiters.push(resolve);
    pump();
  });

  try {
    return await task();
  } finally {
    activeCount -= 1;
    pump();
  }
}
