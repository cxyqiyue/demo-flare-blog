import katex from "katex";
import { Marked, type RendererThis, type Tokens } from "marked";
import { preprocessExtendedMarkdown } from "@/lib/markdown/extended-markdown";

/** 标题锚点 id 生成（与文章标题 slugify 规则保持一致） */
function slugifyHeading(text: string | null | undefined) {
  if (!text) return "untitled";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\-\u4E00-\u9FA5]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * 将 markdown 中的 $...$ / $$...$$ 数学公式替换为 KaTeX HTML。
 * 先保护代码区，避免替换代码内的 $ 符号。
 */
function preprocessMath(markdown: string): string {
  const placeholders: Array<string> = [];
  const savePlaceholder = (raw: string): string => {
    const idx = placeholders.push(raw) - 1;
    return `\u0000MATH_PLACEHOLDER_${idx}\u0000`;
  };

  let result = markdown
    .replace(/~~~[\s\S]*?~~~/g, (m) => savePlaceholder(m))
    .replace(/(`+)[\s\S]*?\1/g, (m) => savePlaceholder(m));

  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex: string) => {
    const trimmed = latex.trim();
    if (!trimmed) return "$$$$";
    const html = katex.renderToString(trimmed, {
      throwOnError: false,
      displayMode: true,
    });
    return `<div class="about-math-block">${html}</div>`;
  });

  result = result.replace(/\$([^$\n]+?)\$/g, (match, latex: string) => {
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
      return match;
    }

    const html = katex.renderToString(trimmed, {
      throwOnError: false,
      displayMode: false,
    });
    return `<span class="about-math-inline">${html}</span>`;
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

const md = new Marked();
md.use({
  gfm: true,
  renderer: {
    heading(this: RendererThis, { tokens, depth }: Tokens.Heading) {
      const text = tokens.map((t) => t.raw ?? "").join("");
      const id = slugifyHeading(text);
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="${id}">${inner}</h${depth}>`;
    },
  },
});

/** Markdown → HTML（含 GFM 表格/任务列表/删除线、代码块、数学公式、标题锚点、脚注、高亮、内联 HTML） */
export function renderMarkdownToHtml(markdown: string): string {
  const withMath = preprocessMath(markdown);
  const preprocessed = preprocessExtendedMarkdown(withMath, {
    renderInline: (raw) => md.parseInline(raw) as string,
  });
  return md.parse(preprocessed) as string;
}

/** Markdown → 纯文本（用于 SEO description 等） */
export function markdownToPlainText(markdown: string, maxLength = 160): string {
  const html = renderMarkdownToHtml(markdown);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
