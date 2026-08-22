import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/middlewares";
import * as SubscriptionService from "@/features/subscription/service/subscription.service";
import { ToggleBlogSubscriptionInputSchema } from "@/features/subscription/subscription.schema";

export const getBlogSubscriptionStatusFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => SubscriptionService.getSubscriptionStatus(context));

export const toggleBlogSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(ToggleBlogSubscriptionInputSchema)
  .handler(({ context, data }) =>
    SubscriptionService.toggleSubscription(context, data),
  );
