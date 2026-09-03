import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { GetPublicPostsPageInputSchema } from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import { getServiceContext, getViewerContext, setCacheHeaders } from "@/lib/hono/helper";
import { baseMiddleware } from "@/lib/hono/middlewares";

const app = new Hono<{ Bindings: Env }>();

app.use("*", baseMiddleware);

const route = app.get(
  "/page",
  zValidator(
    "query",
    GetPublicPostsPageInputSchema.extend({
      offset: z.coerce.number().int().min(0).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    }),
  ),
  async (c) => {
    const data = c.req.valid("query");
    const viewer = await getViewerContext(c);
    const result = await PostService.getPublicPostsPage(
      { ...getServiceContext(c), viewer },
      data,
    );
    setCacheHeaders(c.res.headers, "public");
    return c.json(result);
  },
);

export default route;
