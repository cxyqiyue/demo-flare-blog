import { slugify } from "@/features/posts/utils/content";

/**
 * 章节锚点 id 生成器。
 *
 * 这是「正文标题渲染」与「大纲条目生成」两端的唯一公共来源，因此必须保持
 * 确定性：同样的标题文本永远得到同样的 id。Latin 内容走 slugify 得到可读
 * 前缀；但 slug 只保留 ASCII，中文部分会被剔除，导致「3、Variables变量」与
 * 「3、部署Variables」坍缩成同一个 slug。因此统一在 slug 后追加「全文 + 层级」
 * 的短哈希，保证不同标题的锚点互不相同（也避免 `#4` 这类短 id 撞上页面其他
 * 元素的 id）。纯中文（或 slugify 后被清空的内容）直接退回哈希。
 */
export function headingAnchorId(text: string, level?: number): string {
  const slug = slugify(text);
  const hash = hashText(`${text}\u0000${level ?? 0}`);
  if (slug && slug !== "untitled-log") {
    return `${slug}-${hash.slice(0, 6)}`;
  }
  const levelSuffix = level && level > 1 ? `-h${level}` : "";
  return `untitled-${hash}${levelSuffix}`;
}

/** FNV-1a 32 位散列，纯同步、跨端稳定 */
function hashText(text: string): string {
  let hash = 0x811c9dc5;
  const str = text ?? "";
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
