import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { FindAdjacentPostsInputSchema } from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import { getServiceContext, getViewerContext } from "@/lib/hono/helper";
import {
  baseMiddleware,
  privateNoStoreMiddleware,
} from "@/lib/hono/middlewares";

const app = new Hono<{ Bindings: Env }>();

app.use("*", privateNoStoreMiddleware, baseMiddleware);

const route = app.get(
  "/:slug/adjacent",
  zValidator("param", FindAdjacentPostsInputSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const viewer = await getViewerContext(c);
    const result = await PostService.findAdjacentPosts(
      { ...getServiceContext(c), viewer },
      {
        slug,
      },
    );
    return c.json(result);
  },
);

export default route;
