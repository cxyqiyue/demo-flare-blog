import type { Context } from "hono";
import {
  createViewerAccess,
  type ViewerAccess,
} from "@/features/posts/services/post-access.service";
import { CACHE_CONTROL } from "@/lib/constants";

export function createRateLimiterIdentifier(
  c: Context,
  options: { includeQuery?: boolean } = {},
) {
  const identifier = c.req.header("cf-connecting-ip") ?? "unknown";
  const { pathname, search } = new URL(c.req.url);
  return `${identifier}:${c.req.method}:${pathname}${options.includeQuery ? search : ""}`;
}

export const setCacheHeaders = (
  headers: Headers,
  strategy: keyof typeof CACHE_CONTROL,
) => {
  Object.entries(CACHE_CONTROL[strategy]).forEach(([k, v]) => {
    headers.set(k, v);
  });
};

export function getExecutionContext(c: Context) {
  return c.executionCtx as ExecutionContext<unknown>;
}

export function getServiceContext(c: Context<{ Bindings: Env }>) {
  return {
    db: c.get("db"),
    env: c.env,
    executionCtx: getExecutionContext(c),
  };
}

/**
 * 从 hono 请求解析访客访问能力（解锁令牌 + 管理员判定），
 * 与 serverFn 侧 viewerAccessMiddleware 保持一致，供受限文章详情等路由使用。
 */
export async function getViewerContext(
  c: Context<{ Bindings: Env }>,
): Promise<ViewerAccess> {
  const cookieHeader = c.req.header("cookie");
  const session = cookieHeader
    ? await c.get("auth").api.getSession({ headers: c.req.raw.headers })
    : null;
  return createViewerAccess(c.env, session?.user, cookieHeader);
}
