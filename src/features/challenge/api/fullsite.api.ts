import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  getChallengeServerConfig,
  isFullSiteChallengeEnabled,
} from "@/features/challenge/service/challenge.service";
import {
  FULLSITE_PASS_COOKIE,
  verifyFullSitePass,
} from "@/features/challenge/service/fullsite.service";
import { dbMiddleware } from "@/lib/middlewares";

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || undefined;
  }
  return undefined;
}

/**
 * 全站人机验证「锁定」状态：
 * - 未开启全站保护 → false
 * - 携带有效通行证 cookie → false
 * - 否则 → true（前端应在 _public 布局叠加毛玻璃验证遮罩）
 *
 * 与 Hono 层的差异：此 server function 会随每次请求（含客户端 SPA 导航携带的
 * cookie）执行，因此能正确覆盖纯客户端导航，避免绕过验证。
 */
export const getFullSiteLockedFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const config = await getChallengeServerConfig({
      db: context.db,
      env: context.env,
      executionCtx: context.executionCtx,
    });
    if (!isFullSiteChallengeEnabled(config)) return false;

    const cookie = getRequestHeader("cookie") ?? "";
    const pass = readCookie(cookie, FULLSITE_PASS_COOKIE);
    return !verifyFullSitePass(context.env, pass);
  });
