import handler from "@tanstack/react-start/server-entry";
import type { Context } from "hono";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import {
  getChallengeServerConfig,
  isFullSiteChallengeEnabled,
  verifyAltchaSolutionPayload,
} from "@/features/challenge/service/challenge.service";
import { makeFullSitePassCookie } from "@/features/challenge/service/fullsite.service";
import * as ConfigService from "@/features/config/service/config.service";
import { handleOtpSend } from "@/features/email-otp/api/hono/otp.route";
import { imageHostingUploadRoute } from "@/features/image-hosting/api/hono/upload.route";
import { exportDownloadRoute } from "@/features/import-export/api/hono/download.route";
import { mediaUploadRoute } from "@/features/media/api/hono/upload.route";
import {
  getLinkAccessSettings,
  isRefererAllowed,
  resolveProxiedMedia,
} from "@/features/media/service/link-access.service";
import {
  handleImageRequest,
  resolveMediaRequestContext,
} from "@/features/media/service/media.service";
import { canReadPostMedia } from "@/features/media/service/post-media-access.service";
import { parseManagedMediaUrl } from "@/features/media/utils/post-media-access";
import navigationFaviconRoute from "@/features/navigation/api/hono/favicon.route";
import postsAdjacentRoute from "@/features/posts/api/hono/posts.adjacent.route";
import postsDetailRoute from "@/features/posts/api/hono/posts.detail.route";
import postsListRoute from "@/features/posts/api/hono/posts.list.route";
import postsPageRoute from "@/features/posts/api/hono/posts.page.route";
import postsRelatedRoute from "@/features/posts/api/hono/posts.related.route";
import postsUnlockRoute from "@/features/posts/api/hono/posts.unlock.route";
import { createViewerAccess } from "@/features/posts/services/post-access.service";
import searchRoute from "@/features/search/api/hono/search.route";
import siteDocumentsRoute from "@/features/site-documents/api/hono/site-documents.route";
import tagsRoute from "@/features/tags/api/hono/tags.list.route";
import wechatVerifyRoute from "@/features/wechat-verify/api/hono/wechat-verify.route";
import { serverEnv } from "@/lib/env/server.env";
import { PROTECTED_AUTH_PATHS } from "@/lib/hono/challenge-rules";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createRateLimiterIdentifier, getExecutionContext } from "./helper";
import {
  baseMiddleware,
  cacheMiddleware,
  challengeMiddleware,
  privateNoStoreMiddleware,
  rateLimitMiddleware,
  shieldMiddleware,
} from "./middlewares";

export const app = new Hono<{ Bindings: Env }>();

app.get("*", cacheMiddleware);

async function forwardAuthRequest(c: Context<{ Bindings: Env }>) {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
}

/* ================================ Public API ================================ */

// Public API routes with RPC support - 链式调用保留类型推断
const publicApi = new Hono<{ Bindings: Env }>()
  .route("/posts", postsListRoute)
  .route("/posts", postsPageRoute)
  .route("/post", postsDetailRoute)
  .route("/post", postsAdjacentRoute)
  .route("/post", postsRelatedRoute)
  .route("/post", postsUnlockRoute)
  .route("/tags", tagsRoute)
  .route("/search", searchRoute);

// Mount public API
app.route("/api", publicApi);

app.route("/", siteDocumentsRoute);

// Export type for RPC client
export type PublicApiType = typeof publicApi;

/* ================================ 路由开始 ================================ */
app.get("/stats.js", async (c) => {
  const env = serverEnv(c.env);
  const umamiSrc = env.UMAMI_SRC;
  if (!umamiSrc) {
    return c.text("Not Found", 404);
  }
  const scriptUrl = new URL("/script.js", umamiSrc).toString();
  const response = await proxy(scriptUrl);
  response.headers.set(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  return response;
});

app.all("/api/send", async (c) => {
  const env = serverEnv(c.env);
  const umamiSrc = env.UMAMI_SRC;
  if (!umamiSrc) {
    return c.text("Not Found", 404);
  }
  const sendUrl = new URL("/api/send", umamiSrc).toString();
  return proxy(sendUrl, c.req);
});

/**
 * 站点自身域名集合（请求主机 + DOMAIN / CDN_DOMAIN）：
 * 传给防盗链校验，保证博客自己页面的引用无条件放行，
 * 不依赖管理员在白名单里填写的格式。
 */
function ownSiteDomains(request: Request, env: Env): string[] {
  const domains = [new URL(request.url).hostname];
  try {
    const envVars = serverEnv(env);
    if (envVars.DOMAIN) domains.push(envVars.DOMAIN);
    if (envVars.CDN_DOMAIN) domains.push(envVars.CDN_DOMAIN);
  } catch {
    // env 解析失败时仅用请求主机
  }
  return domains;
}

app.on(
  ["GET", "HEAD"],
  "/images/:key{.+}",
  privateNoStoreMiddleware,
  baseMiddleware,
  async (c) => {
    try {
      const context = resolveMediaRequestContext(c);
      const target = parseManagedMediaUrl(c.req.url, [
        new URL(c.req.url).origin,
      ]);
      if (!target) return c.text("Not Found", 404);
      const session = await c.get("auth").api.getSession({
        headers: c.req.raw.headers,
        query: { disableCookieCache: true },
      });
      const access = await canReadPostMedia(
        {
          ...context,
          viewer: createViewerAccess(
            c.env,
            session?.user,
            c.req.header("cookie"),
          ),
        },
        target,
        { ownOrigins: [new URL(c.req.url).origin] },
      );
      if (!access.allowed) return c.text("Not Found", 404);

      const config = await ConfigService.getSystemConfig(context);
      const settings = getLinkAccessSettings(
        config,
        ownSiteDomains(c.req.raw, c.env),
      );
      if (
        settings.mode === "protected" &&
        !isRefererAllowed(c.req.raw, settings)
      )
        return c.text("Forbidden", 403);

      // All Post-associated images bypass shared Image Resizing, even while public,
      // so switching to private does not leave a reusable transformed response.
      return await handleImageRequest(c.env, target.key, c.req.raw, {
        originalOnly: access.associated,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "r2 image access failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return c.text("Internal server error", 500);
    }
  },
);

// Provider credentials remain entirely inside the Worker, after current Post access.
app.on(
  ["GET", "HEAD"],
  "/media/file/:provider/:key{.+}",
  privateNoStoreMiddleware,
  baseMiddleware,
  async (c) => {
    try {
      const context = resolveMediaRequestContext(c);
      const target = parseManagedMediaUrl(c.req.url, [
        new URL(c.req.url).origin,
      ]);
      if (!target) return c.text("Not Found", 404);
      const session = await c.get("auth").api.getSession({
        headers: c.req.raw.headers,
        query: { disableCookieCache: true },
      });
      const access = await canReadPostMedia(
        {
          ...context,
          viewer: createViewerAccess(
            c.env,
            session?.user,
            c.req.header("cookie"),
          ),
        },
        target,
        { ownOrigins: [new URL(c.req.url).origin] },
      );
      if (!access.allowed) return c.text("Not Found", 404);

      const config = await ConfigService.getSystemConfig(context);
      const settings = getLinkAccessSettings(
        config,
        ownSiteDomains(c.req.raw, c.env),
      );
      if (
        settings.mode === "protected" &&
        !isRefererAllowed(c.req.raw, settings)
      )
        return c.text("Forbidden", 403);
      if (target.provider === "r2")
        return handleImageRequest(c.env, target.key, c.req.raw, {
          originalOnly: true,
        });

      const result = await resolveProxiedMedia(
        context,
        c.req.param("provider"),
        c.req.param("key"),
      );
      if (result.error) {
        console.error(
          JSON.stringify({
            message: "media proxy resolve failed",
            provider: target.provider,
            error: result.error,
          }),
        );
        return c.text("Upstream unavailable", 502);
      }
      const upstream = result.data;
      const headers = new Headers();
      for (const name of ["content-type", "content-length", "etag"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(c.req.method === "HEAD" ? null : upstream.body, {
        status: 200,
        headers,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "media proxy access failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return c.text("Internal server error", 500);
    }
  },
);

app.get("/api/auth/*", baseMiddleware, forwardAuthRequest);

const protectedAuthPaths = PROTECTED_AUTH_PATHS;

protectedAuthPaths.forEach((path) => {
  app.post(
    path,
    baseMiddleware,
    challengeMiddleware,
    rateLimitMiddleware({
      capacity: 5,
      interval: "1m",
      identifier: createRateLimiterIdentifier,
    }),
    rateLimitMiddleware({
      capacity: 10,
      interval: "1h",
      identifier: (c) => `hourly:${createRateLimiterIdentifier(c)}`,
    }),
    forwardAuthRequest,
  );
});

// 邮箱验证码下发：服务端挑战 + IP 限流，并按邮箱严格限制发送频率和小时总量。
app.post(
  "/api/auth/otp/send",
  baseMiddleware,
  challengeMiddleware,
  rateLimitMiddleware({
    capacity: 5,
    interval: "1m",
    identifier: createRateLimiterIdentifier,
  }),
  rateLimitMiddleware({
    capacity: 10,
    interval: "1h",
    identifier: (c) => `hourly:${createRateLimiterIdentifier(c)}`,
  }),
  handleOtpSend,
);

app.post(
  "/api/auth/*",
  baseMiddleware,
  rateLimitMiddleware({
    capacity: 5,
    interval: "1m",
    identifier: createRateLimiterIdentifier,
  }),
  forwardAuthRequest,
);

// 全站人机验证：验证通过后签发同名通行证 cookie
app.post(
  "/api/challenge/fullsite/verify",
  baseMiddleware,
  rateLimitMiddleware({
    capacity: 10,
    interval: "1m",
    identifier: createRateLimiterIdentifier,
  }),
  async (c) => {
    const config = await getChallengeServerConfig({
      db: c.get("db"),
      env: c.env,
      executionCtx: c.executionCtx,
    });
    if (!isFullSiteChallengeEnabled(config)) {
      return c.json({ ok: false, code: "CHALLENGE_DISABLED" }, 400);
    }

    const turnstileToken = c.req.header("X-Turnstile-Token");
    const altchaSolution = c.req.header("X-Altcha-Solution");

    let verified = false;
    if (config.provider === "turnstile") {
      if (turnstileToken) {
        const result = await verifyTurnstileToken({
          secretKey: config.turnstile.secretKey,
          token: turnstileToken,
        });
        if (result.success) verified = true;
      }
      if (!verified && altchaSolution) {
        const res = await verifyAltchaSolutionPayload(c.env, altchaSolution);
        verified = res.ok;
      }
    } else if (config.provider === "altcha" && altchaSolution) {
      const res = await verifyAltchaSolutionPayload(c.env, altchaSolution);
      verified = res.ok;
    }

    if (!verified) {
      return c.json({ ok: false, code: "CHALLENGE_VERIFICATION_FAILED" }, 403);
    }

    c.header("Set-Cookie", makeFullSitePassCookie(c.env));
    return c.json({ ok: true });
  },
);

// Admin export download route
app.route("/api/admin/export", exportDownloadRoute);

// 上传端点（XHR 直传 + 真实进度），须在 shieldMiddleware 之前注册
app.route("/api/media", mediaUploadRoute);
app.route("/api/image-hosting", imageHostingUploadRoute);

// 微信部署验证文件（须在 shieldMiddleware 之前注册，否则 .txt 路径会被拦截）
app.route("/", wechatVerifyRoute);

// 导航页 favicon 代理（公开 GET 路由，须在 shieldMiddleware 之前注册）
app.route("/api/navigation", navigationFaviconRoute);

// Router之前的防护
app.all("*", shieldMiddleware);

app.all("*", (c) => {
  return handler.fetch(c.req.raw, {
    context: {
      env: c.env,
      executionCtx: getExecutionContext(c),
    },
  });
});
