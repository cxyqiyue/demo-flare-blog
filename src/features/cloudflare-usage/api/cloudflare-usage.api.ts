import { createServerFn } from "@tanstack/react-start";
import { testCloudflareConnection } from "@/features/cloudflare-usage/lib/cf-graphql";
import {
  getCloudflareUsage,
  getCloudflareAlertStatus,
} from "@/features/cloudflare-usage/service/cloudflare-usage.service";
import { TestCloudflareConnectionInputSchema } from "@/features/cloudflare-usage/cloudflare-usage.schema";
import { adminMiddleware } from "@/lib/middlewares";

export const getCloudflareUsageFn = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(({ context }) => getCloudflareUsage(context));

export const getCloudflareAlertStatusFn = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(({ context }) => getCloudflareAlertStatus(context));

export const testCloudflareConnectionFn = createServerFn({
  method: "POST",
})
  .inputValidator(TestCloudflareConnectionInputSchema)
  .middleware([adminMiddleware])
  .handler(({ data }) =>
    testCloudflareConnection(data.accountId, data.apiToken),
  );
