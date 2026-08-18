import type { JSONContent } from "@tiptap/react";
import { useMemo } from "react";
import { renderReact } from "@/features/theme/themes/fuwari/components/content/render";
import { cn, sanitizeJsonContent } from "@/lib/utils";

interface ContentRendererProps {
  content: JSONContent | null;
  className?: string;
}

/**
 * Fuwari Content Renderer:
 * Resolves standard Tiptap AST into React components tailored for the Fuwari theme (like Expressive Code).
 */
export function ContentRenderer({ content, className }: ContentRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;
    const safe = sanitizeJsonContent(content);
    return safe ? renderReact(safe) : null;
  }, [content]);

  if (!content) {
    return null;
  }

  return <div className={cn(className)}>{renderedContent}</div>;
}
