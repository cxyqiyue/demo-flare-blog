import type { JSONContent } from "@tiptap/react";
import { useCallback, useState } from "react";
import { jsonContentToMarkdown } from "@/features/import-export/utils/markdown-serializer";

export type MarkdownEditorMode = "rich" | "markdown";

export interface UseMarkdownModeResult {
  mode: MarkdownEditorMode;
  setMode: (mode: MarkdownEditorMode) => void;
  markdownText: string;
  setMarkdownText: (text: string) => void;
  converting: boolean;
  /** 从富文本切到 Markdown：把当前富文本转成 Markdown 源码 */
  switchToMarkdown: (currentContent: JSONContent | null) => void;
  /** 从 Markdown 切回富文本：返回转换后的 JSON，供调用方 setContent */
  switchToRich: () => Promise<JSONContent | null>;
  /** 以 Markdown 源码提交：转换为 JSON 后调用 submit，成功后清空源码 */
  submitInMarkdown: (
    submit: (content: JSONContent) => Promise<boolean | undefined>,
  ) => Promise<boolean | undefined>;
}

/**
 * 编辑器「富文本 / Markdown」双模式。
 * 动态与评论编辑器共用，Markdown 模式直接编辑源码，提交时统一经
 * markdownToJsonContent 转成 TipTap JSON 再入库。
 */
export function useMarkdownMode(
  initialMode: MarkdownEditorMode = "rich",
): UseMarkdownModeResult {
  const [mode, setMode] = useState<MarkdownEditorMode>(initialMode);
  const [markdownText, setMarkdownText] = useState("");
  const [converting, setConverting] = useState(false);

  const switchToMarkdown = useCallback((currentContent: JSONContent | null) => {
    if (
      currentContent?.type === "doc" &&
      (currentContent.content?.length ?? 0) > 0
    ) {
      setMarkdownText(jsonContentToMarkdown(currentContent).trimEnd());
    } else {
      setMarkdownText("");
    }
    setMode("markdown");
  }, []);

  const switchToRich = useCallback(async () => {
    setConverting(true);
    try {
      const { markdownToJsonContent } = await import(
        "@/features/import-export/utils/markdown-parser"
      );
      const json = await markdownToJsonContent(markdownText || "");
      setMode("rich");
      return json;
    } finally {
      setConverting(false);
    }
  }, [markdownText]);

  const submitInMarkdown = useCallback(
    async (submit: (content: JSONContent) => Promise<boolean | undefined>) => {
      setConverting(true);
      try {
        const { markdownToJsonContent } = await import(
          "@/features/import-export/utils/markdown-parser"
        );
        const json = await markdownToJsonContent(markdownText || "");
        const ok = await submit(json);
        if (ok !== false) setMarkdownText("");
        return ok;
      } finally {
        setConverting(false);
      }
    },
    [markdownText],
  );

  return {
    mode,
    setMode,
    markdownText,
    setMarkdownText,
    converting,
    switchToMarkdown,
    switchToRich,
    submitInMarkdown,
  };
}
