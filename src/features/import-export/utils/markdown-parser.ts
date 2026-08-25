import type { JSONContent } from "@tiptap/react";
import { HtmlBlockNode } from "@/features/posts/editor/extensions/html-block";
import { preprocessExtendedMarkdown } from "@/lib/markdown/extended-markdown";

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Pre-process markdown: convert $...$ and $$...$$ to HTML elements
 * so that marked passes them through and DOMParser can parse them.
 */
function preprocessMathInMarkdown(markdown: string): string {
  const placeholders: Array<string> = [];
  const savePlaceholder = (raw: string): string => {
    const idx = placeholders.push(raw) - 1;
    return `\u0000MATH_PLACEHOLDER_${idx}\u0000`;
  };

  // Protect code regions first to avoid replacing math syntax inside code.
  let result = markdown
    .replace(/~~~[\s\S]*?~~~/g, (m) => savePlaceholder(m))
    .replace(/(`+)[\s\S]*?\1/g, (m) => savePlaceholder(m));

  // Block math first: $$...$$ (multiline)
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
    const trimmed = latex.trim();
    const escaped = escapeHtmlAttr(trimmed);
    return `<div data-type="block-math" data-latex="${escaped}"></div>`;
  });
  // Inline math: $...$ (no $ or newline inside)
  result = result.replace(/\$([^$\n]+?)\$/g, (match, latex) => {
    const trimmed = latex.trim();

    const startsWithNumber = /^\d+([.,]\d+)?/.test(trimmed);
    const isPureNumber = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*$/.test(
      trimmed,
    );
    const hasRangeOrCurrencyWords = /\b(?:and|or|to|per|each)\b/i.test(trimmed);
    const hasEnglishWordsAfterNumber = /^\d+([.,]\d+)?\s+[a-zA-Z]+/.test(
      trimmed,
    );
    const hasNonLatexToken = /[^\d\s.,+\-*/=^_(){}\\a-zA-Z]/.test(trimmed);

    if (
      isPureNumber ||
      (startsWithNumber &&
        (hasRangeOrCurrencyWords ||
          hasEnglishWordsAfterNumber ||
          hasNonLatexToken))
    ) {
      return match; // leave as-is for currency/range-like text
    }

    const escaped = escapeHtmlAttr(trimmed);
    return `<span data-type="inline-math" data-latex="${escaped}"></span>`;
  });

  let restored = result;
  placeholders.forEach((value, idx) => {
    restored = restored.replaceAll(
      `\u0000MATH_PLACEHOLDER_${idx}\u0000`,
      value,
    );
  });
  return restored;
}

/**
 * Convert marked's GFM checkbox output (`<li><input disabled="" type="checkbox"> ...`)
 * into tiptap taskList/taskItem compatible markup.
 */
function transformTaskLists(html: string): string {
  return html
    .replace(
      /<li><input\s+([^>]*type="checkbox"[^>]*)>\s*/g,
      (_match, attrs: string) => {
        const checked = /checked=""/.test(attrs);
        return `<li data-type="taskItem" data-checked="${
          checked ? "true" : "false"
        }">`;
      },
    )
    .replace(/<ul>([\s\S]*?)<\/ul>/g, (full, inner: string) => {
      if (inner.includes('data-type="taskItem"')) {
        return `<ul data-type="taskList">${inner}</ul>`;
      }
      return full;
    });
}

/**
 * Markdown → JSONContent 转换
 *
 * NOTE: @tiptap/html checks for browser (window) or Node (process.versions.node)
 * and neither is available in Cloudflare Workers. We bypass this by calling
 * ProseMirror's DOMParser directly with linkedom as the DOM implementation.
 */
export async function markdownToJsonContent(
  markdown: string,
): Promise<JSONContent> {
  const withMath = preprocessMathInMarkdown(markdown);
  const { marked } = await import("marked");
  const preprocessed = preprocessExtendedMarkdown(withMath, {
    renderInline: (raw) => marked.parseInline(raw) as string,
    normalizeInlineHtml: true,
  });

  let html = await marked(preprocessed);
  html = transformTaskLists(html);

  const { getSchema } = await import("@tiptap/core");
  const { DOMParser: PMDOMParser } = await import("@tiptap/pm/model");
  const { parseHTML } = await import("linkedom");

  const { default: StarterKit } = await import("@tiptap/starter-kit");
  const { default: ImageExt } = await import("@tiptap/extension-image");
  const { default: Mathematics } = await import(
    "@tiptap/extension-mathematics"
  );
  const { default: Highlight } = await import("@tiptap/extension-highlight");
  const { default: Subscript } = await import("@tiptap/extension-subscript");
  const { default: Superscript } = await import(
    "@tiptap/extension-superscript"
  );
  const { Table } = await import("@tiptap/extension-table");
  const { default: TableRow } = await import("@tiptap/extension-table-row");
  const { default: TableHeader } = await import(
    "@tiptap/extension-table-header"
  );
  const { default: TableCell } = await import("@tiptap/extension-table-cell");
  const { default: TaskList } = await import("@tiptap/extension-task-list");
  const { default: TaskItem } = await import("@tiptap/extension-task-item");

  const schema = getSchema([
    StarterKit,
    ImageExt,
    Mathematics.configure({ katexOptions: { throwOnError: false } }),
    Highlight,
    Subscript,
    Superscript,
    HtmlBlockNode,
    Table,
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem,
  ]);

  const { document } = parseHTML(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
  );

  // <details> 等无法映射为 ProseMirror 节点的块级 HTML 包装为 htmlBlock 节点，
  // 由编辑器 NodeView / 前台 nodeMapping 负责展示。
  // 注意：使用 DOM API 时传原始 HTML，序列化转义由 DOM 实现负责。
  const htmlBlocks = Array.from(document.querySelectorAll("details"));
  for (const el of htmlBlocks) {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-type", "html-block");
    wrapper.setAttribute(
      "data-html",
      (el as unknown as { outerHTML: string }).outerHTML,
    );
    el.replaceWith(wrapper);
  }

  return PMDOMParser.fromSchema(schema)
    .parse(document.body as unknown as Element)
    .toJSON() as JSONContent;
}
