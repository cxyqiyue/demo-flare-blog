import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import * as PostService from "@/features/posts/services/posts.service";
import { getServiceContext, getViewerContext } from "@/lib/hono/helper";
import {
  baseMiddleware,
  privateNoStoreMiddleware,
} from "@/lib/hono/middlewares";

const app = new Hono<{ Bindings: Env }>();

app.use("*", privateNoStoreMiddleware, baseMiddleware);

const route = app.get(
  "/:slug/related",
  zValidator("param", z.object({ slug: z.string() })),
  zValidator("query", z.object({ limit: z.coerce.number().optional() })),
  async (c) => {
    const { slug } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    const viewer = await getViewerContext(c);
    const result = await PostService.getRelatedPosts(
      { ...getServiceContext(c), viewer },
      {
        slug,
        limit,
      },
    );
    return c.json(result);
  },
);

export default route;
