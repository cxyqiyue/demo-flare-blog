import type { JSONContent } from "@tiptap/react";
import type { NodeProps } from "@tiptap/static-renderer";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import type { ReactNode } from "react";
import { MathFormula } from "@/components/content/math-formula";
import { getStaticRenderExtensions } from "@/features/posts/editor/static-extensions";
import { CodeBlock } from "@/features/theme/themes/fuwari/components/content/code-block";
import { ImageDisplay } from "@/features/theme/themes/fuwari/components/content/image-display";

/** static-renderer 节点映射函数签名 */
type NodeRenderer = (ctx: NodeProps) => ReactNode;

/** 文章 / 动态 / 评论共用的节点映射（fuwari 主题视觉） */
export function buildFuwariNodeMappings(): Record<string, NodeRenderer> {
  return {
    image: ({ node }) => {
      const attrs = node.attrs as {
        src: string;
        alt?: string | null;
        width?: number | string;
        height?: number | string;
      };

      const alt =
        (attrs.alt && attrs.alt !== "null" ? attrs.alt : null) || "blog image";

      const width =
        typeof attrs.width === "string" ? parseInt(attrs.width) : attrs.width;
      const height =
        typeof attrs.height === "string" ? parseInt(attrs.height) : attrs.height;

      return (
        <ImageDisplay
          src={attrs.src}
          alt={alt}
          width={width || undefined}
          height={height || undefined}
        />
      );
    },
    codeBlock: ({ node }) => {
      const code = node.textContent || "";
      const attrs = node.attrs as {
        language?: string | null;
        highlightedHtml?: string;
      };

      return (
        <CodeBlock
          code={code}
          language={attrs.language || null}
          highlightedHtml={attrs.highlightedHtml}
        />
      );
    },
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse content-table"
          style={{ tableLayout: "auto" }}
        >
          {children}
        </table>
      </div>
    ),
    tableCell: ({ node, children }) => {
      const attrs = node.attrs as {
        colspan?: number;
        rowspan?: number;
        colwidth?: Array<number>;
        style?: string;
      };
      return (
        <td
          colSpan={attrs.colspan}
          rowSpan={attrs.rowspan}
          style={attrs.style ? { width: attrs.style } : undefined}
        >
          {children}
        </td>
      );
    },
    tableHeader: ({ node, children }) => {
      const attrs = node.attrs as {
        colspan?: number;
        rowspan?: number;
        colwidth?: Array<number>;
        style?: string;
      };
      return (
        <th
          colSpan={attrs.colspan}
          rowSpan={attrs.rowspan}
          style={attrs.style ? { width: attrs.style } : undefined}
        >
          {children}
        </th>
      );
    },
    inlineMath: ({ node }) => {
      const latex = (node.attrs as { latex?: string }).latex ?? "";
      return <MathFormula latex={latex} mode="inline" />;
    },
    blockMath: ({ node }) => {
      const latex = (node.attrs as { latex?: string }).latex ?? "";
      return <MathFormula latex={latex} mode="block" />;
    },
    htmlBlock: ({ node }) => (
      <div
        className="html-block-content"
        dangerouslySetInnerHTML={{
          __html: (node.attrs as { html?: string }).html ?? "",
        }}
      />
    ),
  };
}

export function renderReact(content: JSONContent) {
  return renderToReactElement({
    extensions: getStaticRenderExtensions(),
    content,
    options: { nodeMapping: buildFuwariNodeMappings() },
  });
}
