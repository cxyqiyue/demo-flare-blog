import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import * as PostRepo from "@/features/posts/data/posts.data";
import {
  buildUnlockCookieHeader,
  createUnlockCookieValue,
} from "@/features/posts/services/post-access.service";
import { verifyPassword } from "@/features/posts/utils/post-secret";
import { getServiceContext } from "@/lib/hono/helper";
import { baseMiddleware, rateLimitMiddleware } from "@/lib/hono/middlewares";

const VerifyPasswordInputSchema = z.object({
  slug: z.string().trim().min(1),
  password: z.string().min(1).max(512),
});

const app = new Hono<{ Bindings: Env }>();

app.use("*", baseMiddleware);

const route = app.post(
  "/verify-password",
  rateLimitMiddleware({
    capacity: 10,
    interval: "1m",
    identifier: (c) =>
      `${c.req.header("cf-connecting-ip") ?? "unknown"}:POST:${c.req.path}`,
  }),
  zValidator("json", VerifyPasswordInputSchema),
  async (c) => {
    const { slug, password } = c.req.valid("json");
    const serviceContext = getServiceContext(c);

    const gateMeta = await PostRepo.findPostGateBySlug(serviceContext.db, slug);
    if (
      !gateMeta ||
      gateMeta.visibility !== "password" ||
      !gateMeta.passwordHash
    ) {
      return c.json({ ok: false, code: "POST_NOT_FOUND" } as const, 404);
    }

    const passwordOk = await verifyPassword(password, gateMeta.passwordHash);
    if (!passwordOk) {
      return c.json({ ok: false, code: "WRONG_PASSWORD" } as const, 401);
    }

    const token = await createUnlockCookieValue(
      serviceContext.env,
      gateMeta.id,
      gateMeta.passwordHash,
    );
    c.header("Set-Cookie", buildUnlockCookieHeader(token));
    return c.json({ ok: true });
  },
);

export default route;