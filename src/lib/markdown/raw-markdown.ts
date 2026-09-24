import type { JSONContent } from "@tiptap/react";
import { hasMarkdownSyntax } from "@/lib/markdown/markdown-detect";

/**
 * 存量「原文 Markdown」兜底转换。
 *
 * 背景：动态 / 评论编辑器过去只在「粘贴命中特定语法」时才把 Markdown 转成
 * TipTap JSON。用户手动输入的 Markdown（如 `![图](url)`）会以纯文本形式
 * 存入 content，前台原样展示。
 *
 * 这里在内容读出（服务端）时做一次兜底：若整篇文档只由纯文本构成、没有
 * 任何结构化节点 / marks，且文本命中 Markdown 语法特征，则视为未被解析的
 * 原文 Markdown，走 markdownToJsonContent 转换后返回。
 */

const PLAIN_NODE_TYPES = new Set(["doc", "paragraph", "hardBreak", "text"]);

/** 判断一个 TipTap 文档是否「疑似未解析的原文 Markdown」 */
export function looksLikeUnparsedMarkdown(
  content: JSONContent | null,
): boolean {
  if (!content || content.type !== "doc") return false;

  const texts: string[] = [];
  let isPlain = true;

  const walk = (node: JSONContent): void => {
    if (!isPlain) return;
    if (!PLAIN_NODE_TYPES.has(node.type ?? "")) {
      isPlain = false;
      return;
    }
    if (node.type === "text") {
      if ((node.marks?.length ?? 0) > 0) {
        isPlain = false;
        return;
      }
      if (node.text) texts.push(node.text);
      return;
    }
    for (const child of node.content ?? []) walk(child);
  };

  walk(content);

  if (!isPlain) return false;
  const text = texts.join("\n");
  return text.trim().length > 0 && hasMarkdownSyntax(text);
}

/** 提取纯文本文档中的 Markdown 原文（段落以换行拼接） */
export function extractRawMarkdownText(doc: JSONContent): string {
  const collectInline = (node: JSONContent, out: string[]): void => {
    if (node.type === "text") {
      out.push(node.text ?? "");
    } else if (node.type === "hardBreak") {
      out.push("\n");
    } else {
      for (const child of node.content ?? []) collectInline(child, out);
    }
  };

  const blocks: string[] = [];
  const walk = (node: JSONContent): void => {
    if (node.type === "paragraph") {
      const inline: string[] = [];
      collectInline(node, inline);
      blocks.push(inline.join(""));
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);

  return blocks.join("\n");
}

/**
 * 若内容为「未解析的原文 Markdown」则转换为 TipTap JSON，否则原样返回。
 * 转换失败时安全回退为原内容。
 */
export async function normalizeRawMarkdownContent(
  content: JSONContent | null,
): Promise<JSONContent | null> {
  if (!content) return content;
  if (!looksLikeUnparsedMarkdown(content)) return content;

  try {
    const { markdownToJsonContent } = await import(
      "@/features/import-export/utils/markdown-parser"
    );
    const converted = await markdownToJsonContent(
      extractRawMarkdownText(content),
    );
    if (converted?.type === "doc") return converted;
  } catch {
    // 转换失败时保留原文，避免破坏展示
  }
  return content;
}
