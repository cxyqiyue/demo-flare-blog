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
    setCacheHeaders(c.res.headers, "public");
    return c.json(result);
  },
);

export default route;
