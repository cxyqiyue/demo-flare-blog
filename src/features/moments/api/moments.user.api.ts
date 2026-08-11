import { createServerFn } from "@tanstack/react-start";
import {
  authMiddleware,
  createRateLimitMiddleware,
  dbMiddleware,
} from "@/lib/middlewares";
import {
  GetPublicMomentsPageInputSchema,
  ToggleMomentLikeInputSchema,
} from "../moments.schema";
import * as MomentService from "../moments.service";

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
