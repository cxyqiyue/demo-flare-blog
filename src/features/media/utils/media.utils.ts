export function getContentTypeFromKey(key: string): string | undefined {
  const extension = key.split(".").pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
  };
  return contentTypes[extension || ""];
}

export function generateKey(fileName: string, folder = ""): string {
  const uuid = crypto.randomUUID();
  const extension = fileName.split(".").pop()?.toLowerCase() || "bin";

  const prefix = normalizeFolderPath(folder);
  return prefix ? `${prefix}/${uuid}.${extension}` : `${uuid}.${extension}`;
}

/**
 * Normalize a folder path: strip leading/trailing slashes and collapse any
 * runs of slashes into a single one so folder keys never contain `//`.
 * `""` is the root folder.
 */
export function normalizeFolderPath(folder: string): string {
  return folder.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
}

/**
 * Build a folder key (trailing slash) from a parent path and a folder name.
 */
export function joinFolderKey(parent: string, name: string): string {
  const base = normalizeFolderPath(parent);
  const cleanName = name.replace(/^\/+|\/+$/g, "");
  return base ? `${base}/${cleanName}/` : `${cleanName}/`;
}

export type MediaSortBy = "name" | "size" | "time";
export type MediaSortDir = "asc" | "desc";

export interface SortableMediaFile {
  fileName: string;
  sizeInBytes: number;
  createdAt: Date | null;
}

/**
 * Sort a list of media files by name/size/time. Files without a date always
 * sink to the bottom, regardless of direction, so unknown timestamps never
 * crowd out known ones. Name comparison is numeric- and case-insensitive.
 */
export function sortMediaFiles<T extends SortableMediaFile>(
  items: T[],
  sortBy: MediaSortBy,
  sortDir: MediaSortDir,
): T[] {
  const dir = sortDir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    if (sortBy === "size") {
      return (a.sizeInBytes - b.sizeInBytes) * dir;
    }
    if (sortBy === "time") {
      const at = a.createdAt ? a.createdAt.getTime() : null;
      const bt = b.createdAt ? b.createdAt.getTime() : null;
      if (at === null && bt === null) return 0;
      if (at === null) return 1;
      if (bt === null) return -1;
      return (at - bt) * dir;
    }
    return (
      a.fileName.localeCompare(b.fileName, undefined, {
        numeric: true,
        sensitivity: "base",
      }) * dir
    );
  });
}

export type CopyLinkFormat = "url" | "markdown" | "html" | "bbcode";

const escapeHtmlAttr = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * Render a media link in the selected copy format. `url` is expected to be
 * absolute; `name` is used as the alt text for Markdown/HTML.
 */
export function formatCopyLink(
  format: CopyLinkFormat,
  url: string,
  name: string,
): string {
  switch (format) {
    case "markdown":
      return `![${name}](${url})`;
    case "html":
      return `<img src="${escapeHtmlAttr(url)}" alt="${escapeHtmlAttr(name)}" />`;
    case "bbcode":
      return `[img]${url}[/img]`;
    default:
      return url;
  }
}

/**
 * Extract the last path segment of a key/folder key.
 */
export function getBasename(key: string): string {
  const normalized = key.replace(/\/+$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

/**
 * Return the parent folder path (no trailing slash) for a folder key.
 * E.g. `photos/albums/` -> `photos`, `photos/` -> ``.
 */
export function getParentFolder(folderKey: string): string {
  const normalized = folderKey.replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "" : normalized.slice(0, idx);
}

/**
 * 从图片 URL 中提取 R2 key
 * 支持格式：
 * - /images/${key}
 * - /images/${key}?quality=80&format=webp
 * - https://domain.com/images/${key}?quality=80
 */
export function extractImageKey(src: string): string | undefined {
  if (!src) return undefined;

  const prefix = "/images/";
  let pathname = "";

  try {
    // 尝试解析为 URL
    const url = new URL(src, "http://dummy.com"); // 传入 base 确保相对路径也能被解析
    pathname = url.pathname;
  } catch {
    // 极少数情况解析失败，手动截断 query
    pathname = src.split("?")[0];
  }

  if (pathname.startsWith(prefix)) {
    return pathname.replace(prefix, "");
  }
  return undefined;
}

/**
 * 生成优化后的图片 URL
 * @param key - R2 key
 * @param width - 可选的宽度限制
 */
export function getOptimizedImageUrl(key: string, width?: number) {
  return `/images/${key}?quality=80${width ? `&width=${width}` : ""}`;
}

export function buildTransformOptions(
  searchParams: URLSearchParams,
  accept: string,
) {
  const transformOptions: Record<string, unknown> = { quality: 80 };

  if (searchParams.has("width")) {
    const width = Number.parseInt(searchParams.get("width")!, 10);
    if (!Number.isNaN(width) && width > 0) transformOptions.width = width;
  }
  if (searchParams.has("height")) {
    const height = Number.parseInt(searchParams.get("height")!, 10);
    if (!Number.isNaN(height) && height > 0) transformOptions.height = height;
  }
  if (searchParams.has("quality")) {
    const quality = Number.parseInt(searchParams.get("quality")!, 10);
    if (!Number.isNaN(quality) && quality > 0 && quality <= 100)
      transformOptions.quality = quality;
  }
  if (searchParams.has("fit")) transformOptions.fit = searchParams.get("fit");

  if (/image\/avif/.test(accept)) {
    transformOptions.format = "avif";
  } else if (/image\/webp/.test(accept)) {
    transformOptions.format = "webp";
  }

  return transformOptions;
}
