import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { HtmlBlockNode } from "@/features/posts/editor/extensions/html-block";

/**
 * htmlBlock 节点的编辑器版本：在交互式编辑器内直接预览原始 HTML。
 * 仅用于客户端编辑器扩展列表；服务端转换管线使用纯 schema 版本。
 */
export const HtmlBlockEditorExtension = HtmlBlockNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => (
      <NodeViewWrapper
        as="div"
        className="html-block-node"
        dangerouslySetInnerHTML={{ __html: (node.attrs.html as string) ?? "" }}
      />
    ));
  },
});
