import { highlight, loadLanguage } from "@/lib/shiki";

/**
 * 对已渲染的 HTML 中的 <pre><code class="language-xxx"> 代码块
 * 应用 Shiki 服务端高亮。用于关于页等 Markdown 内容的预渲染。
 *
 * 与文章的 highlightCodeBlocks（操作 TipTap JSON）不同，
 * 本函数直接操作 HTML 字符串，适合 Markdown → HTML 管线。
 */
export async function highlightHtmlCodeBlocks(html: string): Promise<string> {
  // 匹配 <pre><code class="language-xxx">...</code></pre>
  const codeBlockRegex =
    /<pre><code\s+class="language-([\w-]+)"[^>]*>([\s\S]*?)<\/code><\/pre>/g;

  // 收集所有需要高亮的代码块
  const matches: Array<{
    full: string;
    lang: string;
    code: string;
    index: number;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(html)) !== null) {
    matches.push({
      full: match[0],
      lang: match[1] || "text",
      code: match[2],
      index: match.index,
    });
  }

  if (matches.length === 0) return html;

  // 预加载所有需要的语言
  const uniqueLangs = [...new Set(matches.map((m) => m.lang))];
  await Promise.all(uniqueLangs.map((lang) => loadLanguage(lang)));

  // 从后往前替换，避免索引偏移
  let result = html;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { full, lang, code, index } = matches[i];
    const end = index + full.length;

    // 解码 HTML 实体
    const decoded = code
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    try {
      const highlighted = await highlight(decoded, lang);
      result = result.slice(0, index) + highlighted + result.slice(end);
    } catch {
      // 高亮失败时保留原始代码块
    }
  }

  return result;
}
