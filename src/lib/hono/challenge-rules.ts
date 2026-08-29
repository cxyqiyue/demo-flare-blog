/**
 * 全站人机验证相关的纯函数规则，独立成模块以便单元测试。
 */

/**
 * 全站验证开启时，受保护前台页面的响应一律禁止缓存：
 * 浏览器/CDN 若缓存下「锁定态」或「已解锁态」的 HTML，
 * 会把其中一个状态的页面串给另一个状态的访客——
 * 已通过验证者再次看到遮罩，或未验证者命中已解锁缓存而绕过门卫。
 */
export function applyNoCachePageHeaders(headers: Headers): void {
  headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  headers.set("CDN-Cache-Control", "private, no-store");
}

/**
 * 必须始终执行人机验证的认证端点（登录 / 注册）。
 * 该白名单与保护范围无关：无论是 auth-only 还是 full-site，
 * 全站通行证 cookie 都不会豁免这些端点，防止自动化批量注册/登录滥用。
 */
export const PROTECTED_AUTH_PATHS = [
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
] as const;

export function isProtectedAuthPath(path: string): boolean {
  return (PROTECTED_AUTH_PATHS as readonly string[]).includes(path);
}
