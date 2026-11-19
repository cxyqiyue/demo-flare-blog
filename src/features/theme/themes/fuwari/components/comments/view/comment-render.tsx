import type { JSONContent } from "@tiptap/react";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { ZoomableContentImage } from "@/components/content/zoomable-content-image";
import { getStaticRenderExtensions } from "@/features/posts/editor/static-extensions";
import { buildFuwariNodeMappings } from "@/features/theme/themes/fuwari/components/content/render";
import { sanitizeJsonContent } from "@/lib/utils";

export function renderCommentReact(
  content: JSONContent | null,
  options: { zoomableImages?: boolean } = {},
) {
  if (!content) return null;
  const safe = sanitizeJsonContent(content);
  if (!safe) return null;

  // 复用文章节点映射，但评论图片使用更紧凑的展示样式
  const { image: _postImage, ...mappings } = buildFuwariNodeMappings();

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

          const className =
            "mx-auto my-2 block h-auto max-h-[32rem] max-w-full rounded-xl";
          return options.zoomableImages ? (
            <ZoomableContentImage
              src={attrs.src}
              alt={alt}
              className={className}
              containerClassName="mx-auto w-fit"
            />
          ) : (
            <img
              src={attrs.src}
              alt={alt}
              loading="lazy"
              className={className}
            />
          );
        },
      },
    },
  });
}
