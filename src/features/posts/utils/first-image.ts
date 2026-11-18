import type { JSONContent } from "@tiptap/react";

export function firstPostImage(node: JSONContent | null): string | null {
  if (!node) return null;
  const src = node.attrs?.src;
  if (node.type === "image" && typeof src === "string") {
    const url = src.trim();
    if (url.startsWith("/") && !url.startsWith("//")) return url;
    if (url && URL.canParse(url)) {
      const protocol = new URL(url).protocol;
      if (url && (protocol === "https:" || protocol === "http:")) return url;
    }
  }
  for (const child of node.content ?? []) {
    const image = firstPostImage(child);
    if (image) return image;
  }
  return null;
}
