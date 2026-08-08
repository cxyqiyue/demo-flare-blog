import { createServerFn } from "@tanstack/react-start";
import {
  authMiddleware,
  createRateLimitMiddleware,
  dbMiddleware,
} from "@/lib/middlewares";
import {
  AddMomentCommentInputSchema,
  ToggleMomentLikeInputSchema,
} from "../moments.schema";
import * as MomentService from "../moments.service";

export const getPublicMomentsFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    return await MomentService.getPublicMoments(context);
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

export const addMomentCommentFn = createServerFn({
  method: "POST",
})
  .middleware([
    createRateLimitMiddleware({
      capacity: 10,
      interval: "1m",
      key: "moments:comment",
    }),
    authMiddleware,
  ])
  .inputValidator(AddMomentCommentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentService.addMomentComment(context, data),
  );
