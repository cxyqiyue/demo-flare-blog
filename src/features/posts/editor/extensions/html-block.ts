import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    htmlBlock: {
      /** 在光标处插入一个原始 HTML 块 */
      setHtmlBlock: (html: string) => ReturnType;
    };
  }
}

/**
 * 原始 HTML 块节点（atom，纯 schema 定义，无 React 依赖）。
 *
 * 用途：Markdown 中 `<details>` 这类无法映射为 ProseMirror 节点的块级
 * HTML，经转换管线包装为 `htmlBlock` 节点保存：
 * - 服务端 JSON 转换管线：仅依赖本文件（避免把 React 打进 Workers bundle）
 * - 交互式编辑器：使用 html-block-view.tsx 中带 NodeView 的扩展版本
 * - 前台静态渲染：由 static-renderer 的 nodeMapping 输出原始 HTML
 *
 * HTML 内容存于 `html` 属性；与 CodeBlock 的 highlightedHtml 同级信任
 * （单作者内容）。
 */
export const HtmlBlockNode = Node.create({
  name: "htmlBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      html: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-html") ?? "",
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='html-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "html-block" }),
    ];
  },

  addCommands() {
    return {
      setHtmlBlock:
        (html: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { html } }),
    };
  },
});
