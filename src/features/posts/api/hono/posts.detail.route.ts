import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { FindPostBySlugInputSchema } from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import {
  getServiceContext,
  getViewerContext,
  setCacheHeaders,
} from "@/lib/hono/helper";
import { baseMiddleware } from "@/lib/hono/middlewares";

const app = new Hono<{ Bindings: Env }>();

app.use("*", baseMiddleware);

const route = app.get(
  "/:slug",
  zValidator("param", FindPostBySlugInputSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const viewer = await getViewerContext(c);
    const result = await PostService.findPostBySlug(
      { ...getServiceContext(c), viewer },
      { slug },
    );
    // 受限文章（私密/密码）的响应依赖解锁 cookie，绝不能进入共享/CDN 缓存：
    // 否则已解锁用户在解锁后重拉该端点时可能命中缓存的门禁壳（gate 非空），
    // 前台门禁不会自动解除。仅公开文章可被公共缓存。
    const isRestricted = !!result && result.visibility !== "public";
    setCacheHeaders(c.res.headers, isRestricted ? "private" : "public");
    return c.json(result);
  },
);

export default route;
