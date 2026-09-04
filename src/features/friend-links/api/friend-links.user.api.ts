import { createServerFn } from "@tanstack/react-start";
import * as ConfigService from "@/features/config/service/config.service";
import {
  authMiddleware,
  createRateLimitMiddleware,
  dbMiddleware,
} from "@/lib/middlewares";
import { SubmitFriendLinkInputSchema } from "../friend-links.schema";
import * as FriendLinkService from "../friend-links.service";

export const submitFriendLinkFn = createServerFn({
  method: "POST",
})
  .middleware([
    createRateLimitMiddleware({
      capacity: 3,
      interval: "1h",
      key: "friend-links:submit",
    }),
    authMiddleware,
  ])
  .inputValidator(SubmitFriendLinkInputSchema)
  .handler(
    async ({ data, context }) =>
      await FriendLinkService.submitFriendLink(context, data),
  );

export const getApprovedFriendLinksFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    return await FriendLinkService.getApprovedFriendLinks(context);
  });

export const getFriendLinksConfigFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const config = await ConfigService.getSystemConfig(context);
    return config.friendLinks ?? { siteInfo: {}, applyRules: [] };
  });

export const getMyFriendLinksFn = createServerFn()
  .middleware([authMiddleware])
  .handler(
    async ({ context }) => await FriendLinkService.getMyFriendLinks(context),
  );
