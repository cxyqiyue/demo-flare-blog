import { Hono } from "hono";
import type { Context } from "hono";
import * as ImageHostingService from "@/features/image-hosting/image-hosting.service";
import { getAuth } from "@/lib/auth/auth.server";
import { getDb } from "@/lib/db";
import {
  rateLimitMiddleware,
} from "@/lib/hono/middlewares";

/**
 * 编辑器图片上传端点（XMLHttpRequest 直传，支持真实上传进度回调）。
 * - POST /upload          文章/动态/关于页（仅管理员）
 * - POST /upload/comment  评论（登录用户，20 次/小时限流）
 * 必须挂载在 shieldMiddleware 之前（见 src/lib/hono/routes.ts）。
 */
export const imageHostingUploadRoute = new Hono<{ Bindings: Env }>();

type Ctx = Context<{ Bindings: Env }>;

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

interface UploadSession {
  user: { id: string };
}

async function requireSession(
  c: Ctx,
): Promise<UploadSession | null> {
  const db = getDb(c.env);
  const auth = getAuth({ db, env: c.env });
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return null;
  return { user: { id: session.user.id } };
}

imageHostingUploadRoute.post("/upload", async (c) => {
  const session = await requireSession(c);
  if (!session) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }

  try {
    const context = ImageHostingService.resolveImageHostingRequestContext(c);
    const formData = await c.req.formData();

    const result = await ImageHostingService.uploadForArticle(context, formData, {
      origin: new URL(c.req.url).origin,
    });

    if (result.error) {
      return jsonResponse(
        { ok: false, message: result.error.message || result.error.reason },
        502,
      );
    }

    return jsonResponse({ ok: true, data: result.data }, 200);
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      400,
    );
  }
});

// 与 RPC 版本一致：评论上传按 IP/用户 限流 20 次/小时
imageHostingUploadRoute.post(
  "/upload/comment",
  async (c, next) => {
    const session = await requireSession(c);
    if (!session) {
      return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
    }
    await next();
  },
  rateLimitMiddleware({
    capacity: 20,
    interval: "1h",
    identifier: (c) => `comment-image:${c.req.header("cf-connecting-ip") ?? "unknown"}`,
  }),
  async (c) => {
    try {
      const context = ImageHostingService.resolveImageHostingRequestContext(c);
      const formData = await c.req.formData();

      const result = await ImageHostingService.uploadCommentImage(
        context,
        formData,
        { origin: new URL(c.req.url).origin },
      );

      if (result.error) {
        return jsonResponse(
          { ok: false, message: result.error.message || result.error.reason },
          502,
        );
      }

      return jsonResponse({ ok: true, data: result.data }, 200);
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
        400,
      );
    }
  },
);
