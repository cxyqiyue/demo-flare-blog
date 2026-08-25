import type { JSONContent } from "@tiptap/react";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { getStaticRenderExtensions } from "@/features/posts/editor/static-extensions";
import { sanitizeJsonContent } from "@/lib/utils";
import { buildDefaultNodeMappings } from "@/features/theme/themes/default/components/content/render";

export function renderCommentReact(content: JSONContent | null) {
  if (!content) return null;
  const safe = sanitizeJsonContent(content);
  if (!safe) return null;

  // 复用文章节点映射，但评论图片使用更紧凑的展示样式
  const { image: _postImage, ...mappings } = buildDefaultNodeMappings();

  return renderToReactElement({
    extensions: getStaticRenderExtensions(),
    content: safe,
    options: {
      nodeMapping: {
        ...mappings,
        image: ({ node }) => {
          const attrs = node.attrs as {
            src: string;
            alt?: string | null;
          };

          const alt =
            (attrs.alt && attrs.alt !== "null" ? attrs.alt : null) ||
            "comment image";

          return (
            <img
              src={attrs.src}
              alt={alt}
              loading="lazy"
              className="max-w-full h-auto rounded-sm my-2 border border-border/40"
            />
          );
        },
      },
    },
  });
}
