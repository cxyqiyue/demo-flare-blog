import type { JSONContent } from "@tiptap/react";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { getCommentExtensions } from "@/features/comments/components/editor/config";
import { sanitizeJsonContent } from "@/lib/utils";

export function renderCommentReact(content: JSONContent | null) {
  if (!content) return null;
  const safe = sanitizeJsonContent(content);
  if (!safe) return null;
  return renderToReactElement({
    extensions: getCommentExtensions(),
    content: safe,
    options: {
      nodeMapping: {
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
              className="max-w-full h-auto rounded-xl my-2"
            />
          );
        },
      },
    },
  });
}
