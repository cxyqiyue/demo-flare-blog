import handler from "@tanstack/react-start/server-entry";
import type { Context } from "hono";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import { exportDownloadRoute } from "@/features/import-export/api/hono/download.route";
import { imageHostingUploadRoute } from "@/features/image-hosting/api/hono/upload.route";
import {
  getLinkAccessSettings,
  isRefererAllowed,
  resolveProxiedMedia,
} from "@/features/media/service/link-access.service";
import {
  handleImageRequest,
  resolveMediaRequestContext,
} from "@/features/media/service/media.service";
import { mediaUploadRoute } from "@/features/media/api/hono/upload.route";
import * as ConfigService from "@/features/config/service/config.service";
import navigationFaviconRoute from "@/features/navigation/api/hono/favicon.route";
import {
  getChallengeServerConfig,
  isFullSiteChallengeEnabled,
  verifyAltchaSolutionPayload,
} from "@/features/challenge/service/challenge.service";
import { makeFullSitePassCookie } from "@/features/challenge/service/fullsite.service";
import { verifyTurnstileToken } from "@/lib/turnstile";
import postsAdjacentRoute from "@/features/posts/api/hono/posts.adjacent.route";
import postsDetailRoute from "@/features/posts/api/hono/posts.detail.route";
import postsListRoute from "@/features/posts/api/hono/posts.list.route";
import postsPageRoute from "@/features/posts/api/hono/posts.page.route";
import postsRelatedRoute from "@/features/posts/api/hono/posts.related.route";
import searchRoute from "@/features/search/api/hono/search.route";
import siteDocumentsRoute from "@/features/site-documents/api/hono/site-documents.route";
import tagsRoute from "@/features/tags/api/hono/tags.list.route";
import wechatVerifyRoute from "@/features/wechat-verify/api/hono/wechat-verify.route";
import { serverEnv } from "@/lib/env/server.env";
import { createRateLimiterIdentifier, getExecutionContext } from "./helper";
import {
  baseMiddleware,
  cacheMiddleware,
  challengeMiddleware,
  isRequestFullSiteLocked,
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

app.get("/images/:key{.+}", async (c) => {
  const key = c.req.param("key");

  if (!key) return c.text("Image key is required", 400);

  // 防盗链：protected 模式下校验 Referer 白名单
  try {
    const context = resolveMediaRequestContext(c);
    const config = await ConfigService.getSystemConfig(context);
    const settings = getLinkAccessSettings(
      config,
      ownSiteDomains(c.req.raw, c.env),
    );
    if (settings.mode === "protected" && !isRefererAllowed(c.req.raw, settings)) {
      return c.text("Forbidden", 403);
    }
  } catch {
    // 配置读取失败时放行，避免阻断正常图片访问
  }

  try {
    return await handleImageRequest(c.env, key, c.req.raw);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "r2 image fetch failed",
        key,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return c.text("Internal server error", 500);
  }
});

// 第三方渠道媒体代理（Telegram/Discord 始终经此路由；其余渠道仅在
// protected 防盗链模式下使用）。回源凭据只存在于 Worker 内部。
app.get("/media/file/:provider/:key{.+}", async (c) => {
  const provider = c.req.param("provider");
  const key = c.req.param("key");
  if (!provider || !key) return c.text("Not Found", 404);

  const context = resolveMediaRequestContext(c);

  try {
    const config = await ConfigService.getSystemConfig(context);
    const settings = getLinkAccessSettings(
      config,
      ownSiteDomains(c.req.raw, c.env),
    );
    if (!isRefererAllowed(c.req.raw, settings)) {
      return c.text("Forbidden", 403);
    }
  } catch {
    return c.text("Internal server error", 500);
  }

  try {
    const result = await resolveProxiedMedia(context, provider, key);
    if (result.error) {
      console.error(
        JSON.stringify({
          message: "media proxy resolve failed",
          provider,
          error: result.error,
        }),
      );
      // 响应体附带短错误码（不含敏感信息），便于在浏览器 F12 中直接定位失败类别；
      // 完整错误消息仅写入 Worker 日志
      return c.text(`Upstream unavailable (${result.error.reason})`, 502);
    }

    const upstream = result.data;
    const headers = new Headers();
    for (const name of ["content-type", "content-length", "etag"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    // 内容按需现取（签名地址会轮换），仅允许浏览器私有缓存
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "media proxy failed",
        provider,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return c.text("Internal server error", 500);
  }
});

app.get("/api/auth/*", baseMiddleware, forwardAuthRequest);

const protectedAuthPaths = [
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
] as const;

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
      return c.json(
        { ok: false, code: "CHALLENGE_VERIFICATION_FAILED" },
        403,
      );
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

app.all("*", async (c) => {
  let request = c.req.raw;

  // 全站人机验证：未验证访客的受保护前台页面在客户端叠加毛玻璃验证遮罩。
  // 这里通过克隆请求注入标记头，供 SSR loader 读取以决定是否遮蔽正文。
  if (await isRequestFullSiteLocked(c)) {
    const cloned = new Request(request.url, {
      method: request.method,
      headers: new Headers([
        ...request.headers.entries(),
        ["x-fullsite-locked", "1"],
      ]),
      body: request.body,
    });
    request = cloned;
  }

  return handler.fetch(request, {
    context: {
      env: c.env,
      executionCtx: getExecutionContext(c),
    },
  });
});
