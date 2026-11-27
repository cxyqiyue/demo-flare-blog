import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { GetPostsCursorInputSchema } from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import {
  getServiceContext,
  getViewerContext,
} from "@/lib/hono/helper";
import {
  baseMiddleware,
  privateNoStoreMiddleware,
} from "@/lib/hono/middlewares";

const app = new Hono<{ Bindings: Env }>();

app.use("*", privateNoStoreMiddleware, baseMiddleware);

const route = app.get(
  "/",
  zValidator(
    "query",
    GetPostsCursorInputSchema.extend({
      cursor: z.coerce.number().optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    }),
  ),
  async (c) => {
    const data = c.req.valid("query");
    const viewer = await getViewerContext(c);
    const result = await PostService.getPostsCursor(
      { ...getServiceContext(c), viewer },
      data,
    );
    return c.json(result);
  },
);

export default route;
