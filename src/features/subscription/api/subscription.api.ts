import { createServerFn } from "@tanstack/react-start";
import * as SubscriptionService from "@/features/subscription/service/subscription.service";
import { ToggleBlogSubscriptionInputSchema } from "@/features/subscription/subscription.schema";
import { authMiddleware } from "@/lib/middlewares";

export const getBlogSubscriptionStatusFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => SubscriptionService.getSubscriptionStatus(context));

export const toggleBlogSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(ToggleBlogSubscriptionInputSchema)
  .handler(({ context, data }) =>
    SubscriptionService.toggleSubscription(context, data),
  );
