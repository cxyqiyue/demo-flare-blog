import type { Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";

const MARKDOWN_HINT =
  /(^|\n)\s{0,3}#{1,6}\s|\n\s{0,3}[-*+]\s|\n\s{0,3}\d+\.\s|```|~~~|\$\$|\[\^[^\]\s]+\]|\|\s*[^|\n]+\s*\||==[^=\n]+==|(?:^|\n)\s{0,3}(?:>|---|\*\*\*|___)\s*(?:\n|$)|\$(?!\s)[^$\n]+?\$/;

/**
 * 创建 TipTap editorProps.handlePaste 处理器：
 * 检测粘贴的纯文本是否包含 Markdown 特征，命中则转为 TipTap JSON 并插入。
 * 富文本 HTML 粘贴不干预，走默认行为。
 */
export function createMarkdownPasteHandler(
  getEditor: () => Editor | null,
): (view: EditorView, event: ClipboardEvent) => boolean {
  return (_view, event) => {
    if (event.clipboardData?.getData("text/html")) return false;
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!text.trim() || !MARKDOWN_HINT.test(text)) return false;

    event.preventDefault();
    const editor = getEditor();
    void (async () => {
      const { markdownToJsonContent } = await import(
        "@/features/import-export/utils/markdown-parser"
      );
      const doc = await markdownToJsonContent(text);
      editor?.commands.insertContent(doc.content ?? []);
    })();
    return true;
  };
}
