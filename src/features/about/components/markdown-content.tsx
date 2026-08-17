import { useEffect, useMemo, useRef } from "react";
import { renderMarkdownToHtml } from "@/features/about/utils/markdown";
import { highlight } from "@/lib/shiki";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  markdown: string;
  className?: string;
}

/**
 * 渲染 Markdown 内容（静态 HTML + 客户端代码高亮）。
 * 服务端/首屏输出与客户端首帧一致，避免 hydration 不匹配；
 * 挂载后通过 effect 将代码块替换为 shiki 高亮结果。
 */
export function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown]);

  useEffect(() => {
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
  }, [markdown]);

  return (
    <div
      ref={rootRef}
      className={cn("about-md", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
