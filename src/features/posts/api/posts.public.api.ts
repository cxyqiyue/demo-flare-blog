import { createMiddleware, createServerFn } from "@tanstack/react-start";
import {
  getRequestHeader,
  getRequestHeaders,
} from "@tanstack/react-start/server";
import { z } from "zod";
import * as PageviewService from "@/features/pageview/service/pageview.service";
import {
  FindAdjacentPostsInputSchema,
  FindPostBySlugInputSchema,
  FindRelatedPostsInputSchema,
  GetPostsCursorInputSchema,
  GetPublicPostsPageInputSchema,
} from "@/features/posts/schema/posts.schema";
import { createViewerAccess } from "@/features/posts/services/post-access.service";
import * as PostService from "@/features/posts/services/posts.service";
import { getAuth } from "@/lib/auth/auth.server";
import { dbMiddleware } from "@/lib/middlewares";

/**
 * 解析访客访问能力（解锁令牌 + 是否管理员）。
 * - 无任何 cookie 的请求直接跳过 session 查询（公开热路径零开销）。
 * - 管理员判定仅在线查看文章等受限场景使用，随请求头派生。
 */
const viewerAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([dbMiddleware])
  .server(async ({ next, context }) => {
    const cookieHeader = getRequestHeader("cookie");
    const session = cookieHeader
      ? await getAuth({ db: context.db, env: context.env }).api.getSession({
          headers: getRequestHeaders(),
        })
      : null;
    const viewer = createViewerAccess(context.env, session?.user, cookieHeader);

    return next({ context: { viewer } });
  });

export const getPostsCursorFn = createServerFn()
  .middleware([dbMiddleware, viewerAccessMiddleware])
  .inputValidator(GetPostsCursorInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.getPostsCursor(context, data);
  });

export const getPublicPostsPageFn = createServerFn()
  .middleware([dbMiddleware, viewerAccessMiddleware])
  .inputValidator(GetPublicPostsPageInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.getPublicPostsPage(context, data);
  });

export const findPostBySlugFn = createServerFn()
  .middleware([viewerAccessMiddleware])
  .inputValidator(FindPostBySlugInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.findPostBySlug(context, data);
  });

export const findAdjacentPostsFn = createServerFn()
  .middleware([viewerAccessMiddleware])
  .inputValidator(FindAdjacentPostsInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.findAdjacentPosts(context, data);
  });

export const getRelatedPostsFn = createServerFn()
  .middleware([viewerAccessMiddleware])
  .inputValidator(FindRelatedPostsInputSchema)
  .handler(async ({ data, context }) => {
    return await PostService.getRelatedPosts(context, data);
  });

export const getPopularPostsFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(
    z.object({ limit: z.number().int().min(1).max(20).optional() }),
  )
  .handler(({ data, context }) =>
    PageviewService.getPopularPosts(context, data.limit),
  );
