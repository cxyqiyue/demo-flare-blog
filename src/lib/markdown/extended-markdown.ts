/**
 * 扩展 Markdown 预处理：脚注（Footnotes）、高亮（==mark==）、内联 HTML 标签
 *
 * 设计目标：
 * - 在交给 marked / TipTap 解析之前，把 GFM 扩展语法改写为标准 HTML，
 *   使「关于页」的直出 HTML 管线和「文章页」的 JSON 转换管线都能渲染。
 * - 所有替换都在代码区域（围栏代码块 / 行内代码 span）之外进行。
 */

export interface ExtendedMarkdownOptions {
  /**
   * 渲染脚注定义正文中的行内 Markdown（粗体、链接等）。
   * 不提供时退化为 HTML 转义。
   */
  renderInline?: (markdown: string) => string;
}

interface CodeGuard {
  /** 包裹后的文本，代码区域已替换为占位符 */
  text: string;
  /** 还原占位符为原始代码 */
  restore: (text: string) => string;
}

/** 保护代码区域（~~~ 围栏与反引号 span），避免后续替换破坏代码内容 */
export function guardCodeRegions(markdown: string): CodeGuard {
  const saved: Array<string> = [];
  const save = (raw: string): string =>
    `\u0000EXTMD${saved.push(raw) - 1}\u0000`;

  const guarded = markdown
    .replace(/~~~[\s\S]*?~~~/g, save)
    .replace(/(`+)[\s\S]*?\1/g, save);

  return {
    text: guarded,
    restore: (text: string) => {
      let restored = text;
      saved.forEach((value, idx) => {
        restored = restored.replaceAll(`\u0000EXTMD${idx}\u0000`, value);
      });
      return restored;
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 脚注处理：
 * - 收集 `[^label]: 内容` 定义（支持缩进续行）
 * - 将正文中 `[^label]` 引用替换为带锚点的上标链接
 * - 从原位置移除定义，在文末追加脚注列表区块
 *
 * 输出为普通 HTML（sup/a/hr/ol/li），两条渲染管线均可直接消费：
 * - 关于页：marked 原样透传
 * - 文章页：DOMParser 映射为 sup/link/horizontalRule/orderedList 节点
 */
export function processFootnotes(
  markdown: string,
  options?: ExtendedMarkdownOptions,
): string {
  interface FootnoteDef {
    label: string;
    body: string;
  }

  const defs: Array<FootnoteDef> = [];
  const labelIndex = new Map<string, number>();

  const DEF_RE = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/;

  const outLines: Array<string> = [];
  let collecting: FootnoteDef | null = null;

  const flushDef = () => {
    if (!collecting) return;
    const idx = defs.length;
    labelIndex.set(collecting.label, idx);
    defs.push(collecting);
    collecting = null;
  };

  for (const line of markdown.split("\n")) {
    if (collecting) {
      // 缩进续行归入当前定义
      if (/^\s+\S/.test(line)) {
        collecting.body += (collecting.body ? "\n" : "") + line.trim();
        continue;
      }
      // 其它任何行都结束当前定义
      flushDef();
    }

    const match = line.match(DEF_RE);
    if (match) {
      collecting = { label: match[1], body: match[2].trim() };
      continue;
    }
    outLines.push(line);
  }
  flushDef();

  if (defs.length === 0) return markdown;

  let body = outLines.join("\n");

  // 替换正文中的引用（定义内部出现的引用保持原样）
  body = body.replace(/\[\^([^\]\s]+)\]/g, (whole, label: string) => {
    const idx = labelIndex.get(label);
    if (idx === undefined) return whole;
    const n = idx + 1;
    return (
      `<sup id="fnref-${n}" class="footnote-ref">` +
      `<a href="#fn-${n}">[${n}]</a></sup>`
    );
  });

  const items = defs.map((def, idx) => {
    const n = idx + 1;
    const raw = def.body.replace(/\n/g, " ");
    const content = options?.renderInline
      ? options.renderInline(raw)
      : escapeHtml(raw);
    return (
      `<li id="fn-${n}">${content} ` +
      `<a class="footnote-backref" href="#fnref-${n}">&#8617;</a></li>`
    );
  });

  const section =
    `\n\n<div class="footnotes">\n<hr>\n<ol>\n${items.join("\n")}\n</ol>\n</div>\n`;

  return body.replace(/\n*$/, "\n") + section;
}

/** ==高亮== → <mark>高亮</mark>（不跨行，内容两端不含 =） */
export function applyHighlightSyntax(markdown: string): string {
  return markdown.replace(
    /==([^=\n](?:[^=\n]*[^=\n])?)==/g,
    (_match, inner: string) => `<mark>${inner}</mark>`,
  );
}

/**
 * 内联 HTML 标签规范化（供不支持透传未知标签的管线使用，如文章 JSON 转换）：
 * - <kbd>x</kbd> → 行内代码 `x`
 * - 其余标签（mark/sub/sup/u 等）由对应 TipTap 扩展的原生 parseHTML 规则处理
 */
export function normalizeInlineHtmlTags(markdown: string): string {
  return markdown.replace(
    /<kbd>([\s\S]*?)<\/kbd>/gi,
    (_match, inner: string) => `\`${inner.replace(/<[^>]+>/g, "").trim()}\``,
  );
}

/** 一站式预处理：保护代码 → 脚注 → 高亮 → 内联标签规范化 → 还原代码 */
export function preprocessExtendedMarkdown(
  markdown: string,
  options?: ExtendedMarkdownOptions & { normalizeInlineHtml?: boolean },
): string {
  const guard = guardCodeRegions(markdown);
  let result = guard.text;
  result = processFootnotes(result, options);
  result = applyHighlightSyntax(result);
  if (options?.normalizeInlineHtml) {
    result = normalizeInlineHtmlTags(result);
  }
  return guard.restore(result);
}
