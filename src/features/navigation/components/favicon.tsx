import { useState } from "react";

/** 提取 URL 的 hostname，失败时返回空字符串 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * 站点图标自动获取：
 * - 有显式 iconUrl 时直接使用；
 * - 否则走服务端 favicon 代理（依次尝试站点 favicon.ico 与公共图标服务），
 *   加载失败时回退为文字占位图标。
 */
export function useFaviconSource(domain: string, iconUrl?: string | null) {
  const [failed, setFailed] = useState(false);

  const src =
    iconUrl ||
    (domain ? `/api/navigation/favicon?domain=${encodeURIComponent(domain)}` : "");

  return {
    src,
    hasIcon: Boolean(src) && !failed,
    onError: () => setFailed(true),
  };
}
