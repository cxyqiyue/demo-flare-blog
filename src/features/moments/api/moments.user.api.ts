import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  authMiddleware,
  createRateLimitMiddleware,
  dbMiddleware,
} from "@/lib/middlewares";
import { findMomentPage } from "../data/moments.data";
import {
  GetPublicMomentsPageInputSchema,
  ToggleMomentLikeInputSchema,
} from "../moments.schema";
import * as MomentService from "../moments.service";

export const getMomentPageFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(({ data, context }) => findMomentPage(context.db, data.id, 5));

export const getPublicMomentsPageFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(GetPublicMomentsPageInputSchema)
  .handler(async ({ data, context }) => {
    return await MomentService.getPublicMomentsPage(context, data);
  });

export const toggleMomentLikeFn = createServerFn({
  method: "POST",
})
  .middleware([
    createRateLimitMiddleware({
      capacity: 30,
      interval: "1m",
      key: "moments:like",
    }),
    authMiddleware,
  ])
  .inputValidator(ToggleMomentLikeInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentService.toggleMomentLike(context, data),
  );
