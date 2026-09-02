import { createMiddleware } from "@tanstack/react-start";
import {
  getRequestHeader,
  getRequestHeaders,
} from "@tanstack/react-start/server";
import { getAuth } from "@/lib/auth/auth.server";
import { isAdmin } from "@/lib/auth/access";
import { getDb } from "@/lib/db";
import type { RateLimitOptions } from "@/lib/do/rate-limiter";
import {
  createAuthError,
  createPermissionError,
  createRateLimitError,
} from "@/lib/errors";

/* ======================= Error Logging ====================== */

export const errorLoggingMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "server function error",
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : String(error),
        timestamp: new Date().toISOString(),
      }),
    );
    throw error;
  }
});

/* ======================= Infrastructure ====================== */

export const dbMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const db = getDb(context.env);
    return next({
      context: {
        db,
      },
    });
  },
);

export const sessionMiddleware = createMiddleware({ type: "function" })
  .middleware([dbMiddleware])
  .server(async ({ next, context }) => {
    const auth = getAuth({
      db: context.db,
      env: context.env,
    });
    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });

    return next({
      context: {
        auth,
        session,
      },
    });
  });

export const authMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    const session = context.session;

    if (!session) {
      throw createAuthError();
    }

    return next({
      context: {
        session,
      },
    });
  });

export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ context, next }) => {
    const session = context.session;

    // 超级管理员（ADMIN_EMAIL 持有者）在运行时派生权限，不依赖数据库 role 字段，
    // 避免数据库 role 被误改 / 未同步导致超管账号被锁定。
    if (!isAdmin(session.user, context.env)) {
      throw createPermissionError();
    }

    return next({
      context: {
        session,
      },
    });
  });

/* ======================= Rate Limiting ====================== */
export const createRateLimitMiddleware = (
  options: RateLimitOptions & {
    key?: string;
    /** 限流标识优先级：默认按 IP（兼容旧行为）；"session" 按登录用户计数 */
    identifierPriority?: "ip" | "session";
  },
) => {
  return createMiddleware({ type: "function" })
    .middleware([sessionMiddleware])
    .server(async ({ next, context }) => {
      const session = context.session;

      const ip = getRequestHeader("cf-connecting-ip");
      const identifier =
        options.identifierPriority === "session"
          ? session?.user.id || ip || "unknown"
          : ip || session?.user.id || "unknown";
      const scope = options.key || "default";
      const uniqueIdentifier = `${identifier}:${scope}`;

      const id = context.env.RATE_LIMITER.idFromName(uniqueIdentifier);
      const rateLimiter = context.env.RATE_LIMITER.get(id);

      const result = await rateLimiter.checkLimit(options);

      if (!result.allowed) {
        throw createRateLimitError(result.retryAfterMs);
      }

      return next();
    });
};
