import { useEffect, useMemo, useRef } from "react";
import { renderMarkdownToHtml } from "@/features/about/utils/markdown";
import { highlight } from "@/lib/shiki";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  markdown: string;
  /** 服务端预渲染的 HTML（含 Shiki 高亮），传入时跳过客户端高亮 */
  preRenderedHtml?: string | null;
  className?: string;
}

/**
 * 渲染 Markdown 内容（静态 HTML + 客户端代码高亮）。
 *
 * 支持两种模式：
 * - preRenderedHtml: 服务端已应用 Shiki 高亮，直接使用，跳过客户端 effect
 * - 纯 markdown: 服务端/首屏输出与客户端首帧一致，挂载后通过 effect 替换为 shiki 高亮
 */
export function MarkdownContent({
  markdown,
  preRenderedHtml,
  className,
}: MarkdownContentProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const html = useMemo(
    () => preRenderedHtml ?? renderMarkdownToHtml(markdown),
    [markdown, preRenderedHtml],
  );

  // 仅在非预渲染模式下执行客户端 Shiki 高亮
  const needsClientHighlight = !preRenderedHtml;

  useEffect(() => {
    if (!needsClientHighlight) return;

    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;
    const codeBlocks = Array.from(
      root.querySelectorAll<HTMLElement>("pre > code[class*='language-']"),
    );

    for (const codeEl of codeBlocks) {
      const lang =
        (codeEl.className.match(/language-([\w-]+)/)?.[1] ?? "") || "text";
      const code = codeEl.textContent ?? "";

      highlight(code, lang).then((html) => {
        if (cancelled) return;
        const pre = codeEl.parentElement;
        if (!pre) return;

        const temp = document.createElement("div");
        temp.innerHTML = html;
        const highlighted = temp.firstElementChild;
        if (highlighted) {
          pre.replaceWith(highlighted);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [markdown, needsClientHighlight]);

  return (
    <div
      ref={rootRef}
      className={cn("about-md", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
