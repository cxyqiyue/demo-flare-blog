import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import {
  getChallengeServerConfig,
  isChallengeReady,
  verifyAltchaSolutionPayload,
} from "@/features/challenge/service/challenge.service";
import * as ConfigService from "@/features/config/service/config.service";
import { getLinkAccessSettings } from "@/features/media/service/link-access.service";
import { getAuth } from "@/lib/auth/auth.server";
import { CACHE_CONTROL } from "@/lib/constants";
import { getDb } from "@/lib/db";
import type { Duration } from "@/lib/duration";
import { serverEnv } from "@/lib/env/server.env";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isPathValid } from "./path-manifest.generated";

declare module "hono" {
  interface ContextVariableMap {
    db: ReturnType<typeof getDb>;
    auth: ReturnType<typeof getAuth>;
  }
}

export const baseMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const db = getDb(c.env);
    const auth = getAuth({ db, env: c.env });
    c.set("db", db);
    c.set("auth", auth);
    return next();
  },
);

const tryCacheResponse = (c: Context, cache: Cache) => {
  let strategy:
    | typeof CACHE_CONTROL.notFound
    | typeof CACHE_CONTROL.serverError
    | typeof CACHE_CONTROL.forbidden
    | null = null;
  if (c.res.status === 404) {
    strategy = CACHE_CONTROL.notFound;
  } else if (c.res.status >= 500) {
    strategy = CACHE_CONTROL.serverError;
  }
  if (strategy) {
    Object.entries(strategy).forEach(([k, v]) => {
      c.res.headers.set(k, v);
    });
  }

  const resCacheControl = c.res.headers.get("Cache-Control");
  const hasSetCookie = c.res.headers.has("Set-Cookie");

  const isStatusCacheable =
    c.res.status === 200 || c.res.status === 404 || c.res.status >= 500;

  const isCacheable =
    isStatusCacheable &&
    !hasSetCookie &&
    resCacheControl &&
    !resCacheControl.includes("no-store") &&
    !resCacheControl.includes("no-cache") &&
    !resCacheControl.includes("private");

  if (!isCacheable) return;

  const responseToCache = c.res.clone();
  c.executionCtx.waitUntil(
    cache.put(c.req.raw, responseToCache).catch(() => {}),
  );
};

export const cacheMiddleware = createMiddleware(async (c, next) => {
  if (c.req.method !== "GET") {
    return next();
  }

  const path = c.req.path;

  // 排除需要 session 的 API（如 /api/auth, /api/send）
  // 但包含 public API（/api/posts, /api/post, /api/tags, /api/search）
  const EXCLUDED_PREFIXES = ["/api/auth", "/api/send", "/media/file"];
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return next();
  }

  // 防盗链 protected 模式下，/images/* 响应依赖 Referer，不能进边缘缓存
  // （缓存键不含 Referer，否则白名单校验会被缓存绕过）
  if (path.startsWith("/images/") && c.env) {
    try {
      const config = await ConfigService.getSystemConfig({
        db: getDb(c.env),
        env: c.env,
        executionCtx: c.executionCtx,
      });
      if (getLinkAccessSettings(config).mode === "protected") {
        return next();
      }
    } catch {
      // 配置读取失败时保守处理：不缓存
      return next();
    }
  }

  // 缓存响应逻辑
  const cache = (caches as unknown as { default: Cache }).default;

  const cachedResponse = await cache.match(c.req.raw);
  if (cachedResponse) return cachedResponse;

  await next();

  tryCacheResponse(c, cache);
});

const SHIELD_ALLOWED_PATHS = new Set([
  "/atom.xml",
  "/feed.json",
  "/robots.txt",
  "/rss.xml",
  "/site.webmanifest",
  "/sitemap.xml",
]);

interface RateLimitOptions {
  capacity: number;
  interval: Duration;
  identifier: string | ((c: Context) => string | undefined);
}

export const rateLimitMiddleware = (options: RateLimitOptions) =>
  createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const identifier =
      typeof options.identifier === "function"
        ? options.identifier(c)
        : options.identifier;
    const id = c.env.RATE_LIMITER.idFromName(identifier ?? "unknown");
    const rateLimiter = c.env.RATE_LIMITER.get(id);

    const result = await rateLimiter.checkLimit({
      capacity: options.capacity,
      interval: options.interval,
    });

    if (!result.allowed) {
      // RFC 7231：Retry-After 单位为秒
      c.res.headers.set(
        "Retry-After",
        Math.ceil(result.retryAfterMs / 1000).toString(),
      );
      return c.json(
        {
          code: "RATE_LIMITED",
          message: "Too Many Requests",
          retryAfterMs: result.retryAfterMs,
        },
        429,
      );
    }

    return next();
  });

export const shieldMiddleware = createMiddleware(async (c, next) => {
  if (serverEnv(c.env).ENVIRONMENT === "dev") return next();

  const path = c.req.path;

  if (
    // 静态资源
    path.startsWith("/assets/") ||
    path.startsWith("/favicon") ||
    SHIELD_ALLOWED_PATHS.has(path) ||
    path.startsWith("/apple-touch-icon") ||
    path.startsWith("/web-app-manifest") ||
    // Server Function
    path.startsWith("/_serverFn/")
  ) {
    return next();
  }

  if (isPathValid(path)) {
    return next();
  }
  const response = c.text("Not Found", 404);
  // 只缓存 Shield 拦截的 404，保护正常 404
  Object.entries(CACHE_CONTROL.notFound).forEach(([k, v]) => {
    response.headers.set(k, v);
  });
  return response;
});

/* ======================= Challenge (Turnstile / ALTCHA PoW) ====================== */
/**
 * 人机验证中间件：
 * - provider = "none" 或未就绪：跳过。
 * - provider = "turnstile"：Turnstile token 通过即短路；失败/缺失时接受 ALTCHA PoW 兜底。
 * - provider = "altcha"：只校验 X-Altcha-Solution。
 */
export const challengeMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const config = await getChallengeServerConfig({
      db: c.get("db"),
      env: c.env,
      executionCtx: c.executionCtx,
    });
    if (!isChallengeReady(config)) return next();

    const turnstileToken = c.req.header("X-Turnstile-Token");
    const altchaSolution = c.req.header("X-Altcha-Solution");

    if (config.provider === "turnstile") {
      if (turnstileToken) {
        const result = await verifyTurnstileToken({
          secretKey: config.turnstile.secretKey,
          token: turnstileToken,
        });
        if (result.success) return next(); // Turnstile 短路，跳过 PoW
      }

      if (altchaSolution) {
        const verification = await verifyAltchaSolutionPayload(
          c.env,
          altchaSolution,
        );
        if (verification.ok) return next();
        return c.json(
          {
            code: "CHALLENGE_VERIFICATION_FAILED",
            message: "Challenge verification failed",
          },
          403,
        );
      }

      return c.json(
        {
          code: "TURNSTILE_MISSING_TOKEN",
          message: "Missing Turnstile token",
        },
        400,
      );
    }

    if (altchaSolution) {
      const verification = await verifyAltchaSolutionPayload(
        c.env,
        altchaSolution,
      );
      if (verification.ok) return next();
      return c.json(
        {
          code: "CHALLENGE_VERIFICATION_FAILED",
          message: "Challenge verification failed",
        },
        403,
      );
    }

    return c.json(
      {
        code: "CHALLENGE_MISSING_TOKEN",
        message: "Missing challenge token",
      },
      400,
    );
  },
);
