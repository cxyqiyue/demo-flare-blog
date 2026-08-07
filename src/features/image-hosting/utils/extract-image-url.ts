/**
 * 从图床插件（Chevereto PUP）返回的 markdown 嵌入代码中提取直链。
 * 支持 `![alt](url)`、`[![alt](url)](viewer)` 以及裸 URL。
 */
export function extractImageUrlFromMarkdown(text: string): string | null {
  if (!text) return null;

  const markdownImage = text.match(/!\[[^\]]*]\(([^)]+)\)/);
  if (markdownImage?.[1]) return markdownImage[1].trim();

  const bareUrl = text.match(/https?:\/\/[^\s)'"}]+/);
  if (bareUrl) return bareUrl[0];

  return null;
}
