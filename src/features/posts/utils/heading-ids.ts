import { slugify } from "@/features/posts/utils/content";

/**
 * 章节锚点 id 生成器。
 *
 * 这是「正文标题渲染」与「大纲条目生成」两端的唯一公共来源，因此必须保持
 * 确定性：同样的标题文本永远得到同样的 id。Latin 内容走 slugify 得到可读
 * 锚点；纯中文（或 slugify 后被清空的内容）退回「文本哈希」，避免所有中文
 * 标题都坍缩成重复的 `untitled-log`，从而支撑滚动高亮与点击跳转。
 */
export function headingAnchorId(text: string, level?: number): string {
  const slug = slugify(text);
  if (slug && slug !== "untitled-log") {
    return slug;
  }
  const levelSuffix = level && level > 1 ? `-h${level}` : "";
  return `untitled-${hashText(text)}${levelSuffix}`;
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
