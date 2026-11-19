import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageLightbox } from "@/components/content/image-lightbox";
import { renderMarkdownToHtml } from "@/features/about/utils/markdown";
import { highlight } from "@/lib/shiki";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const html = useMemo(
    () => preRenderedHtml ?? renderMarkdownToHtml(markdown),
    [markdown, preRenderedHtml],
  );

  // 仅在非预渲染模式下执行客户端 Shiki 高亮
  const needsClientHighlight = !preRenderedHtml;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll("img").forEach((image) => {
      image.style.cursor = "zoom-in";
      image.draggable = false;
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", m.common_view_full_image());
    });
  }, [html]);

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
    <>
      <div
        ref={rootRef}
        className={cn("about-md", className)}
        onClick={(event) => {
          if (!(event.target instanceof HTMLImageElement)) return;
          event.preventDefault();
          setPreviewImage({
            src: event.target.currentSrc || event.target.src,
            alt: event.target.alt,
          });
        }}
        onKeyDown={(event) => {
          if (
            !(event.target instanceof HTMLImageElement) ||
            (event.key !== "Enter" && event.key !== " ")
          ) {
            return;
          }
          event.preventDefault();
          setPreviewImage({
            src: event.target.currentSrc || event.target.src,
            alt: event.target.alt,
          });
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {previewImage && (
        <ClientOnly>
          <ImageLightbox
            src={previewImage.src}
            alt={previewImage.alt}
            isOpen
            onClose={() => setPreviewImage(null)}
          />
        </ClientOnly>
      )}
    </>
  );
}
