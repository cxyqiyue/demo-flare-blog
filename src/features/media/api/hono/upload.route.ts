import { Hono } from "hono";
import type { Context } from "hono";
import { isAdmin, isSuperAdmin } from "@/lib/auth/access";
import { resolveR2NativeMaxBytes } from "@/features/image-hosting/size-limits";
import { parseUploadMediaInput } from "@/features/media/media.schema";
import * as MediaService from "@/features/media/service/media.service";
import { getAuth } from "@/lib/auth/auth.server";
import { getDb } from "@/lib/db";
import { m } from "@/paraglide/messages";

/**
 * 媒体库上传端点（XMLHttpRequest 直传，支持真实上传进度回调）。
 * 必须挂载在 shieldMiddleware 之前（见 src/lib/hono/routes.ts）。
 */
export const mediaUploadRoute = new Hono<{ Bindings: Env }>();

type Ctx = Context<{ Bindings: Env }>;

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

/** 管理员鉴权；失败时返回 Response，否则返回 null。 */
async function requireAdmin(c: Ctx): Promise<Response | null> {
  const db = getDb(c.env);
  const auth = getAuth({ db, env: c.env });
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }
  if (!isAdmin(session.user, c.env)) {
    return jsonResponse({ ok: false, message: "Forbidden" }, 403);
  }
  return null;
}

/** 超级管理员鉴权（媒体库管理）；失败时返回 Response，否则返回 null。 */
async function requireSuperAdmin(c: Ctx): Promise<Response | null> {
  const db = getDb(c.env);
  const auth = getAuth({ db, env: c.env });
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }
  if (!isSuperAdmin(session.user, c.env)) {
    return jsonResponse({ ok: false, message: "Forbidden" }, 403);
  }
  return null;
}

function errorStatus(reason: string): number {
  switch (reason) {
    case "FILE_TOO_LARGE":
      return 413;
    case "CONTENT_MODERATION_BLOCKED":
      return 422;
    case "PROVIDER_NOT_CONFIGURED":
    case "UNSUPPORTED_PROVIDER":
      return 400;
    case "MEDIA_RECORD_CREATE_FAILED":
      return 500;
    default:
      return 502;
  }
}

mediaUploadRoute.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    // 媒体库管理上传（UI 直传、允许任意文件类型、放宽到 R2 渠道上限）——仅最高管理员；
    // 编辑器内传图（source != media-library）——管理员可在写文章时上传配图。
    const isMediaLibrary =
      (formData.get("source") as string | null) === "media-library";
    const denied = isMediaLibrary
      ? await requireSuperAdmin(c)
      : await requireAdmin(c);
    if (denied) return denied;

    const context = MediaService.resolveMediaRequestContext(c);
    const input = parseUploadMediaInput(
      formData,
      m,
      isMediaLibrary
        ? {
            allowAnyFileType: true,
            maxSizeBytes: resolveR2NativeMaxBytes() ?? undefined,
          }
        : undefined,
    );

    const result = await MediaService.upload(context, {
      ...input,
      origin: new URL(c.req.url).origin,
    });

    if (result.error) {
      const detail =
        "message" in result.error && result.error.message
          ? result.error.message
          : result.error.reason;
      return jsonResponse({ ok: false, message: detail }, errorStatus(result.error.reason));
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

mediaUploadRoute.post("/upload/provider", async (c) => {
  const denied = await requireSuperAdmin(c);
  if (denied) return denied;

  try {
    const context = MediaService.resolveMediaRequestContext(c);
    const formData = await c.req.formData();
    const providerId = formData.get("providerId") as string;
    const folder = (formData.get("folder") as string) ?? "";
    const file = formData.get("image");
    if (!providerId || !(file instanceof File)) {
      return jsonResponse({ ok: false, message: "Invalid request" }, 400);
    }

    const result = await MediaService.uploadToProvider(
      context,
      { providerId, folder },
      file,
      { origin: new URL(c.req.url).origin },
    );

    if (result.error) {
      return jsonResponse(
        {
          ok: false,
          message:
            "message" in result.error && result.error.message
              ? result.error.message
              : result.error.reason,
        },
        errorStatus(result.error.reason),
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
