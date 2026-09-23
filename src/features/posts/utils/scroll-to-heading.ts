/**
 * 平滑滚动到标题锚点，并容忍后续布局变化。
 *
 * 懒加载图片 / 评论区等异步内容撑高文档会打断浏览器正在进行的平滑滚动，
 * 导致落点停在半路。这里在每次滚动结束后检查与目标的偏差，偏差过大则
 * 重试（最多 maxRetries 次）；用户主动滚动（滚轮 / 触摸）即取消重试，
 * 避免与用户操作打架。
 */
export function scrollToHeadingWithRetry(
  element: HTMLElement,
  offset = 80,
  maxRetries = 4,
): void {
  let attempts = 0;
  let finished = false;
  let timer = 0;

  const targetTop = () =>
    element.getBoundingClientRect().top + window.scrollY - offset;

  const finish = () => {
    finished = true;
    window.clearTimeout(timer);
    window.removeEventListener("wheel", finish);
    window.removeEventListener("touchstart", finish);
  };

  const check = () => {
    if (finished) return;
    if (
      Math.abs(window.scrollY - targetTop()) <= 40 ||
      attempts >= maxRetries
    ) {
      finish();
      return;
    }
    attempts++;
    window.scrollTo({ top: targetTop(), behavior: "smooth" });
    timer = window.setTimeout(check, 900);
  };

  window.addEventListener("wheel", finish, { passive: true });
  window.addEventListener("touchstart", finish, { passive: true });
  window.scrollTo({ top: targetTop(), behavior: "smooth" });
  timer = window.setTimeout(check, 700);
}