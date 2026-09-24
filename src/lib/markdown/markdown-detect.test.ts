import { describe, expect, it } from "vitest";
import { hasMarkdownSyntax } from "@/lib/markdown/markdown-detect";
import {
  extractRawMarkdownText,
  looksLikeUnparsedMarkdown,
} from "@/lib/markdown/raw-markdown";

describe("hasMarkdownSyntax", () => {
  it("detects images/links/headings/list/table/quote/code/everything", () => {
    expect(
      hasMarkdownSyntax(
        "![网络修复脚本.bat](https://imgbed.qyfy.kdns.fr/file/VMware/1790154614367_网络修复脚本.bat)",
      ),
    ).toBe(true);
    expect(hasMarkdownSyntax("**加粗** 测试")).toBe(true);
    expect(hasMarkdownSyntax("_斜体_ 内容")).toBe(true);
    expect(hasMarkdownSyntax("*还不错*")).toBe(true);
    expect(hasMarkdownSyntax("[链接](https://example.com)")).toBe(true);
    expect(hasMarkdownSyntax("# 标题")).toBe(true);
    expect(hasMarkdownSyntax("- 列表")).toBe(true);
    expect(hasMarkdownSyntax("1. 有序")).toBe(true);
    expect(hasMarkdownSyntax("| a | b |")).toBe(true);
    expect(hasMarkdownSyntax("> 引用")).toBe(true);
    expect(hasMarkdownSyntax("```js code```")).toBe(true);
    expect(hasMarkdownSyntax("==高亮==")).toBe(true);
    expect(hasMarkdownSyntax("~~删除~~")).toBe(true);
    expect(hasMarkdownSyntax("Footnote ref[^1]")).toBe(true);
    expect(hasMarkdownSyntax("Use `code` here")).toBe(true);
  });

  it("does not treat arithmetic or plain text as markdown", () => {
    expect(hasMarkdownSyntax("5 * 3 * 2 = 30")).toBe(false);
    expect(hasMarkdownSyntax("2 * 3 = 6")).toBe(false);
    expect(hasMarkdownSyntax("5 > 3 > 2")).toBe(false);
    expect(hasMarkdownSyntax("a*b*c")).toBe(false);
    expect(hasMarkdownSyntax("我_真的_很厉害")).toBe(false);
    expect(hasMarkdownSyntax("10*10=100")).toBe(false);
    expect(hasMarkdownSyntax("今天天气不错")).toBe(false);
    expect(hasMarkdownSyntax("https://example.com/x.png")).toBe(false);
  });

  it("detects inline markdown inside surrounding text", () => {
    expect(hasMarkdownSyntax("this is *important text* here")).toBe(true);
  });
});

describe("looksLikeUnparsedMarkdown", () => {
  it("returns true for a plain-text doc holding raw markdown", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "![网络修复脚本.bat](https://imgbed.qyfy.kdns.fr/file/VMware/1790154614367_网络修复脚本.bat)",
            },
          ],
        },
      ],
    };
    expect(looksLikeUnparsedMarkdown(doc)).toBe(true);
  });

  it("returns true for multi-paragraph raw markdown", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "**加粗** 第一段" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "- 列表项" }],
        },
      ],
    };
    expect(looksLikeUnparsedMarkdown(doc)).toBe(true);
  });

  it("returns false for plain prose", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "今天天气不错，适合休息。" }],
        },
      ],
    };
    expect(looksLikeUnparsedMarkdown(doc)).toBe(false);
  });

  it("returns false for structured rich content", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "标题" }],
        },
      ],
    };
    expect(looksLikeUnparsedMarkdown(doc)).toBe(false);
  });

  it("returns false for text with marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "加粗内容",
              marks: [{ type: "bold" }],
            },
          ],
        },
      ],
    };
    expect(looksLikeUnparsedMarkdown(doc)).toBe(false);
  });

  it("returns false for null/empty", () => {
    expect(looksLikeUnparsedMarkdown(null)).toBe(false);
  });
});

describe("extractRawMarkdownText", () => {
  it("joins paragraphs and hard breaks into lines", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "第一段 **加粗**" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "- 第二段 " },
            { type: "hardBreak" },
            { type: "text", text: "- 第三段" },
          ],
        },
      ],
    };
    expect(extractRawMarkdownText(doc)).toBe(
      "第一段 **加粗**\n- 第二段 \n- 第三段",
    );
  });
});
