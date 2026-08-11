import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { FindAdjacentPostsInputSchema } from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import { getServiceContext, setCacheHeaders } from "@/lib/hono/helper";
import { baseMiddleware } from "@/lib/hono/middlewares";

const app = new Hono<{ Bindings: Env }>();

app.use("*", baseMiddleware);

const route = app.get(
  "/:slug/adjacent",
  zValidator("param", FindAdjacentPostsInputSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const result = await PostService.findAdjacentPosts(getServiceContext(c), {
      slug,
    });
    setCacheHeaders(c.res.headers, "public");
    return c.json(result);
  },
);

export default route;
