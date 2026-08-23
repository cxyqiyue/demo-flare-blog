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
 * - POST /upload/comment  评论（登录用户，按用户 200 次/小时限流）
 * 必须挂载在 shieldMiddleware 之前（见 src/lib/hono/routes.ts）。
 */
export const imageHostingUploadRoute = new Hono<{ Bindings: Env }>();

declare module "hono" {
  interface ContextVariableMap {
    /** 评论上传限流用的会话用户 id（由会话校验中间件写入） */
    imageUploadUserId?: string;
  }
}

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

// 评论传图：按登录用户计数（无会话时回退按 IP），200 次/小时；
// 避免同一出口 IP（NAT/公司网络）下的用户互相挤占额度
imageHostingUploadRoute.post(
  "/upload/comment",
  async (c, next) => {
    const session = await requireSession(c);
    if (!session) {
      return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
    }
    c.set("imageUploadUserId", session.user.id);
    await next();
  },
  rateLimitMiddleware({
    capacity: 200,
    interval: "1h",
    identifier: (c) => {
      const userId = c.get("imageUploadUserId");
      if (userId) return `comment-image:user:${userId}`;
      const ip = c.req.header("cf-connecting-ip") ?? "unknown";
      return `comment-image:ip:${ip}`;
    },
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
