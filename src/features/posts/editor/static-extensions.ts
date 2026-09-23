import { mergeAttributes } from "@tiptap/core";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Mathematics from "@tiptap/extension-mathematics";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { HtmlBlockNode } from "@/features/posts/editor/extensions/html-block";
import { ImageExtension } from "@/features/posts/editor/extensions/images";
import { headingAnchorId } from "@/features/posts/utils/heading-ids";

/**
 * 前台展示用标题扩展：与编辑器一致地注入稳定锚点 id（slugify 规则同
 * `generateTableOfContents`），使正文标题在 DOM 中拥有与大纲条目一致
 * 的锚点，支撑滚动高亮与点击跳转。只注入 id、不叠加编辑器里的视觉类。
 */
const TocHeadingExtension = Heading.extend({
  renderHTML({ HTMLAttributes, node }) {
    const level = node.attrs.level as number;
    const id = headingAnchorId(node.textContent, level);
    return [`h${level}`, mergeAttributes(HTMLAttributes, { id }), 0];
  },
});

/**
 * 前台静态渲染专用扩展集（@tiptap/static-renderer）。
 *
 * 覆盖文章 / 动态 / 评论 JSON 中可能出现的一切节点与 mark：
 * - StarterKit：列表/引用/代码块/分割线/基础行内样式（标题由下方专用扩展接管）
 * - 表格四件套、任务列表、数学公式、图片
 * - 高亮 ==mark==、上标 <sup>、下标 <sub>、原始 HTML 块（details 等）
 *
 * 刻意不包含编辑器专属的重组件（shiki 高亮视图、图片上传、TOC、
 * FileHandler 等），避免污染纯展示页面的 bundle。
 */
export function getStaticRenderExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: {
        HTMLAttributes: {
          class: "font-mono",
        },
      },
      link: {
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      },
    }),
    TocHeadingExtension,
    Highlight,
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    Mathematics.configure({ katexOptions: { throwOnError: false } }),
    ImageExtension,
    HtmlBlockNode,
  ];
}
