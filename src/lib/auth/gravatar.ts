import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * 邮箱头像（Gravatar）工具：
 * 邮箱账号（Gmail / Outlook / qq.com / 163.com 等）本身没有头像字段，
 * 但绝大多数主流邮箱服务依托 Gravatar 体系。这里用邮箱 MD5 生成 Gravatar
 * 头像地址，并支持验证该邮箱是否存在真实头像。
 *
 * Gravatar URL 规范：
 *   https://www.gravatar.com/avatar/{md5(email小写并去除首尾空格)}
 * 若该邮箱在 Gravatar 注册过头像则返回真实头像；否则返回默认图。
 */

/** 返回小写去空格后的邮箱，Gravatar 规范要求作为 MD5 输入。 */
export function normalizeEmailForAvatar(email: string): string {
  return email.trim().toLowerCase();
}

/** 使用 WebCrypto / noble md5 计算邮箱的 Gravatar hash（32 位十六进制）。 */
export function gravatarHash(email: string): string {
  const normalized = normalizeEmailForAvatar(email);
  return bytesToHex(md5(new TextEncoder().encode(normalized)));
}

/** Gravatar 头像基础地址（不含默认参数）。 */
export function buildGravatarUrl(
  email: string,
  options: { size?: number; default?: "404" | "identicon" | "mp" | "retro" | "monsterid" | "wavatar" } = {},
): string {
  const hash = gravatarHash(email);
  const base = `https://www.gravatar.com/avatar/${hash}`;
  const params: Array<string> = [];
  if (options.size) params.push(`s=${options.size}`);
  if (options.default) params.push(`d=${options.default}`);
  return params.length > 0 ? `${base}?${params.join("&")}` : base;
}

/**
 * 解析邮箱的 Gravatar 头像（仅当该邮箱确实存在真实头像时返回完整 URL，
 * 否则返回 null —— 这样不显示占位图，前端继续用首字母/图标 fallback）。
 *
 * 实现：请求 Gravatar 的 `d=404` 接口，若返回 404 说明无真实头像。
 * 有头像则重定向到真实图片地址，这里直接返回 404-param 版本的 URL
 * （浏览器渲染时 Gravatar 会按 d=404 响应，若无头像也可观测）。
 */
export async function resolveGravatarEmailAvatar(
  email: string,
  options: { size?: number } = {},
): Promise<string | null> {
  const checkUrl = buildGravatarUrl(email, { ...options, default: "404" });
  try {
    const res = await globalThis.fetch(checkUrl, { method: "HEAD" });
    if (res.status === 404) {
      return null;
    }
    return options.size ? buildGravatarUrl(email, { size: options.size }) : buildGravatarUrl(email);
  } catch {
    // 网络失败时宁可留空，不影响登录流程。
    return null;
  }
}